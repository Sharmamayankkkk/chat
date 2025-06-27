"use client"

import { createContext, useContext, useState, type ReactNode, useEffect, useCallback, useMemo, useRef } from "react"
import type { User, Chat, ThemeSettings, Message, DmRequest, Event, RSVPStatus } from "@/lib/types"
import { createClient } from "@/lib/utils"
import { Icons } from "@/components/icons"
import { useToast } from "@/hooks/use-toast"
import type { Session, RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { usePathname, useRouter } from "next/navigation"

interface AppContextType {
  loggedInUser: User | null
  allUsers: User[]
  chats: Chat[]
  dmRequests: DmRequest[]
  blockedUsers: string[]
  events: Event[]
  sendDmRequest: (toUserId: string, reason: string) => Promise<void>
  addChat: (newChat: Chat) => void
  updateUser: (updates: Partial<User>) => Promise<void>
  leaveGroup: (chatId: number) => Promise<void>
  deleteGroup: (chatId: number) => Promise<void>
  themeSettings: ThemeSettings
  setThemeSettings: (newSettings: Partial<ThemeSettings>) => void
  isReady: boolean
  resetUnreadCount: (chatId: number) => void
  forwardMessage: (message: Message, chatIds: number[]) => Promise<void>
  reportUser: (reportedUserId: string, reason: string, messageId?: number) => Promise<void>
  blockUser: (userIdToBlock: string) => Promise<void>
  unblockUser: (userIdToUnblock: string) => Promise<void>
  addEvent: (eventData: Omit<Event, "id" | "created_at" | "rsvps">) => Promise<void>
  updateEvent: (eventId: number, eventData: Partial<Event>) => Promise<void>
  rsvpToEvent: (eventId: number, status: RSVPStatus) => Promise<void>
  shareEventInChats: (event: Event, chatIds: number[]) => Promise<void>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

function AppLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Icons.logo className="h-16 w-16 animate-pulse text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading your data...</p>
      </div>
    </div>
  )
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [dmRequests, setDmRequests] = useState<DmRequest[]>([])
  const [blockedUsers, setBlockedUsers] = useState<string[]>([])
  const [themeSettings, setThemeSettingsState] = useState<ThemeSettings>({
    outgoingBubbleColor: "hsl(221.2 83.2% 53.3%)",
    incomingBubbleColor: "hsl(210 40% 96.1%)",
    usernameColor: "hsl(var(--primary))",
    chatWallpaper: "/chat-bg.png",
    wallpaperBrightness: 100,
  })
  const [isReady, setIsReady] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const initialSessionProcessed = useRef(false)
  const subscriptionsRef = useRef<any[]>([])

  const { toast } = useToast()
  const router = useRouter()
  
  // Use a ref for the pathname to stabilize the subscription's `useEffect` dependencies
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])


  const fetchInitialData = useCallback(
    async (session: Session) => {
      if (isInitializing) return
      setIsInitializing(true)
      try {
        const { user } = session
        const [
          { data: profile, error: profileError },
          { data: allUsersData },
          { data: dmRequestsData },
          { data: unreadData, error: unreadError },
          { data: chatParticipants, error: participantError },
          { data: blockedUsersData, error: blockedUsersError },
          { data: eventsData, error: eventsError },
        ] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase.from("profiles").select("*"),
          supabase
            .from("dm_requests")
            .select("*, from:profiles!from_user_id(*), to:profiles!to_user_id(*)")
            .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`),
          supabase.rpc("get_unread_counts", { p_user_id: user.id }),
          supabase.from("participants").select("chat_id").eq("user_id", user.id),
          supabase.from("blocked_users").select("blocked_id").eq("blocker_id", user.id),
          supabase.from("events").select("*, profiles:creator_id(*), rsvps:event_rsvps(*)"),
        ])

        if (profileError || !profile) throw new Error("Could not fetch user profile.")
        if (participantError) throw new Error("Could not fetch user's chats.")
        if (unreadError) console.error("Failed to get unread counts:", unreadError)
        if (blockedUsersError) console.error("Failed to get blocked users:", blockedUsersError)
        if (eventsError) console.error("Failed to get events:", eventsError)

        const fullUserProfile = { ...profile, email: user.email } as User
        setLoggedInUser(fullUserProfile)
        setAllUsers((allUsersData as User[]) || [])
        setDmRequests((dmRequestsData as DmRequest[]) || [])
        setBlockedUsers(blockedUsersData?.map((b) => b.blocked_id) || [])
        setEvents((eventsData as Event[]) || [])

        const chatIds = chatParticipants?.map((p) => p.chat_id) || []
        let chatsData: any[] = []
        if (chatIds.length > 0) {
          const { data, error: chatListError } = await supabase
            .from("chats")
            .select(`*, participants:participants!chat_id(*, profiles!user_id(*))`)
            .in("id", chatIds)
          if (chatListError) throw new Error("Could not fetch chat list.")
          chatsData = data || []
        }

        const unreadMap = new Map<number, number>()
        if (unreadData)
          (unreadData as any[]).forEach((item: any) => unreadMap.set(item.chat_id_result, item.unread_count_result))

        const mappedChats = chatsData.map((chat) => ({
          ...chat,
          messages: [],
          unreadCount: unreadMap.get(chat.id) || 0,
        }))
        setChats(mappedChats as unknown as Chat[])
      } catch (error: any) {
        throw error
      } finally {
        setIsInitializing(false)
      }
    },
    [supabase, isInitializing],
  )
  
  // Load theme settings from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("themeSettings")
      if (savedSettings) setThemeSettingsState(JSON.parse(savedSettings))
    } catch (error) {
      console.error("Could not load theme settings:", error)
    }
  }, [])

  // Handle auth state changes and initial data load
  useEffect(() => {
    let mounted = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (event === "SIGNED_IN" && session?.user.id === loggedInUser?.id && initialSessionProcessed.current) {
        return
      }

      setSession(session)
      try {
        if (session && event !== "TOKEN_REFRESHED") {
          await fetchInitialData(session)
          initialSessionProcessed.current = true
        } else if (!session) {
          setLoggedInUser(null)
          setChats([])
          setAllUsers([])
          setDmRequests([])
          setBlockedUsers([])
          setEvents([])
          initialSessionProcessed.current = false
        }
      } catch (error: any) {
        console.error("Error in auth state change:", error)
        if (mounted) {
          toast({ variant: "destructive", title: "Error loading data", description: error.message })
          setLoggedInUser(null)
          setChats([])
          setDmRequests([])
          setBlockedUsers([])
          setEvents([])
        }
      } finally {
        if (mounted && !isReady) {
          setIsReady(true)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchInitialData, toast, isReady, loggedInUser?.id])

  // --- START REAL-TIME SUBSCRIPTIONS ---

  // Handle incoming messages for non-active chats (notifications, sidebar updates)
  const handleNewMessageForInactiveChat = useCallback(
    (payload: RealtimePostgresChangesPayload<Message>) => {
      if (!loggedInUser) return;
      const newMessage = payload.new as Message;
      
      const currentPath = pathnameRef.current;
      const currentChatId = currentPath?.split("/chat/")[1];
      const isChatOpen = String(newMessage.chat_id) === currentChatId;

      // *** This is the key change: Provider ignores messages for the open chat. ***
      if (isChatOpen) return;

      setChats((currentChats) =>
        currentChats.map((c) => {
          if (c.id === newMessage.chat_id) {
            return {
              ...c,
              last_message_content: newMessage.attachment_url
                ? newMessage.attachment_metadata?.name || "Sent an attachment"
                : newMessage.content,
              last_message_timestamp: newMessage.created_at,
              unreadCount: (c.unreadCount || 0) + 1,
            };
          }
          return c;
        })
      );
      
      const isMyMessage = newMessage.user_id === loggedInUser.id;
      if (!isMyMessage && Notification.permission === "granted") {
        const sender = allUsers.find((u) => u.id === newMessage.user_id);
        if (sender && !blockedUsers.includes(sender.id)) {
          const title = sender.name || "New Message";
          const body =
            newMessage.content ||
            (newMessage.attachment_metadata?.name ? `Sent: ${newMessage.attachment_metadata.name}` : "Sent an attachment");
          
          try {
            const notification = new Notification(title, {
              body: body,
              icon: sender.avatar_url || "/logo/light_KCS.png",
              tag: `chat-${newMessage.chat_id}`,
            });
            notification.onclick = () => {
              window.focus();
              router.push(`/chat/${newMessage.chat_id}`);
              notification.close();
            };
            setTimeout(() => notification.close(), 8000);
          } catch (error) {
            console.error("Error showing notification:", error);
          }
        }
      }
    },
    [loggedInUser, allUsers, blockedUsers, router]
  );
  
  // Memoize chat IDs string to stabilize subscription dependencies
  const chatIdsString = useMemo(() => chats.map((c) => c.id).sort().join(","), [chats]);
  
  // Set up all real-time subscriptions
  useEffect(() => {
    if (!isReady || !loggedInUser) return;

    // --- Message subscription (for inactive chats) ---
    let messageChannel: any;
    if (chatIdsString) {
      messageChannel = supabase
        .channel(`global-messages-${loggedInUser.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=in.(${chatIdsString})` },
          handleNewMessageForInactiveChat as any
        )
        .subscribe();
    }
    
    // --- Other subscriptions ---
    const handleGenericUpdate = (setter: React.Dispatch<React.SetStateAction<any[]>>, payload: any) => {
        setter(current => {
            const oldId = payload.old?.id;
            const newId = payload.new?.id;
            if (payload.eventType === 'INSERT') return [...current, payload.new];
            if (payload.eventType === 'UPDATE') return current.map(item => item.id === newId ? payload.new : item);
            if (payload.eventType === 'DELETE') return current.filter(item => item.id !== oldId);
            return current;
        });
    };

    const dmRequestChannel = supabase.channel(`dm-requests-${loggedInUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_requests', filter: `or(from_user_id.eq.${loggedInUser.id},to_user_id.eq.${loggedInUser.id})` }, 
      (p:any) => handleGenericUpdate(setDmRequests, p))
      .subscribe();

    const blockedUsersChannel = supabase.channel(`blocked-users-${loggedInUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_users', filter: `blocker_id=eq.${loggedInUser.id}` }, 
      (p: any) => handleGenericUpdate(setBlockedUsers, p))
      .subscribe();

    const eventsChannel = supabase.channel(`events-global`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, 
      (p: any) => handleGenericUpdate(setEvents, p))
      .subscribe();
      
    const rsvpChannel = supabase.channel(`rsvps-global`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps' }, (payload: any) => {
          setEvents(currentEvents => currentEvents.map(e => {
              if (e.id === payload.new.event_id) {
                  const newRsvps = e.rsvps.filter(r => r.user_id !== payload.new.user_id);
                  newRsvps.push(payload.new);
                  return {...e, rsvps: newRsvps};
              }
              return e;
          }))
      })
      .subscribe();

    return () => {
      if (messageChannel) supabase.removeChannel(messageChannel);
      supabase.removeChannel(dmRequestChannel);
      supabase.removeChannel(blockedUsersChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(rsvpChannel);
    };
  }, [isReady, loggedInUser, chatIdsString, supabase, handleNewMessageForInactiveChat]);

  // --- END REAL-TIME SUBSCRIPTIONS ---

  const setThemeSettings = useCallback((newSettings: Partial<ThemeSettings>) => {
    setThemeSettingsState((prev) => {
      const updated = { ...prev, ...newSettings }
      try {
        localStorage.setItem("themeSettings", JSON.stringify(updated))
      } catch (error) {
        console.error("Failed to save theme settings:", error)
      }
      return updated
    })
  }, [])

  const addChat = useCallback((newChat: Chat) => {
    setChats((currentChats) =>
      currentChats.some((c) => c.id === newChat.id) ? currentChats : [newChat, ...currentChats],
    )
  }, [])

  const updateUser = useCallback(
    async (updates: Partial<User>) => {
      if (!loggedInUser) return
      const oldUser = { ...loggedInUser }
      setLoggedInUser((current) => ({ ...current!, ...updates }))
      const { error } = await supabase
        .from("profiles")
        .update({ name: updates.name, username: updates.username, bio: updates.bio, avatar_url: updates.avatar_url })
        .eq("id", loggedInUser.id)
      if (error) {
        toast({ variant: "destructive", title: "Error updating profile", description: error.message })
        setLoggedInUser(oldUser)
      }
    },
    [loggedInUser, supabase, toast],
  )

  const leaveGroup = useCallback(
    async (chatId: number) => {
      if (!loggedInUser) return
      const { error } = await supabase
        .from("participants")
        .delete()
        .match({ chat_id: chatId, user_id: loggedInUser.id })
      if (error) toast({ variant: "destructive", title: "Error leaving group", description: error.message })
      else setChats((current) => current.filter((c) => c.id !== chatId))
    },
    [loggedInUser, supabase, toast],
  )

  const deleteGroup = useCallback(
    async (chatId: number) => {
      const { error } = await supabase.from("chats").delete().eq("id", chatId)
      if (error) toast({ variant: "destructive", title: "Error deleting group", description: error.message })
      else setChats((current) => current.filter((c) => c.id !== chatId))
    },
    [supabase, toast],
  )

  const sendDmRequest = useCallback(
    async (toUserId: string, reason: string) => {
      if (!loggedInUser) return
      const { error } = await supabase
        .from("dm_requests")
        .insert({ from_user_id: loggedInUser.id, to_user_id: toUserId, reason: reason })
      if (error) toast({ variant: "destructive", title: "Error sending request", description: error.message })
      else
        toast({ title: "Request Sent!", description: "Your request to message this user has been sent for approval." })
    },
    [loggedInUser, supabase, toast],
  )

  const forwardMessage = useCallback(
    async (message: Message, chatIds: number[]) => {
      if (!loggedInUser) return
      const originalSenderName = message.profiles.name
      const messagesToInsert = chatIds.map((chatId) => {
        let content = ""
        const prefix = `Forwarded from **${originalSenderName}**`
        if (message.content)
          content = message.content.startsWith("Forwarded from") ? message.content : `${prefix}\n\n${message.content}`
        else content = prefix
        return {
          chat_id: chatId,
          user_id: loggedInUser.id,
          content: content,
          attachment_url: message.attachment_url,
          attachment_metadata: message.attachment_metadata,
        }
      })
      const { error } = await supabase.from("messages").insert(messagesToInsert)
      if (error) toast({ variant: "destructive", title: "Error forwarding message", description: error.message })
      else toast({ title: "Message Forwarded", description: `Your message was sent to ${chatIds.length} chat(s).` })
    },
    [loggedInUser, supabase, toast],
  )

  const resetUnreadCount = useCallback((chatId: number) => {
    setChats((current) => current.map((c) => (c.id === chatId && c.unreadCount ? { ...c, unreadCount: 0 } : c)))
  }, [])

  const reportUser = useCallback(
    async (reportedUserId: string, reason: string, messageId?: number) => {
      if (!loggedInUser) return
      const { error } = await supabase
        .from("reports")
        .insert({ reported_by: loggedInUser.id, reported_user_id: reportedUserId, reason, message_id: messageId })
      if (error) toast({ variant: "destructive", title: "Error submitting report", description: error.message })
      else toast({ title: "Report Submitted", description: "Thank you for helping keep our community safe." })
    },
    [loggedInUser, supabase, toast],
  )

  const blockUser = useCallback(
    async (userIdToBlock: string) => {
      if (!loggedInUser) return
      const { error } = await supabase
        .from("blocked_users")
        .insert({ blocker_id: loggedInUser.id, blocked_id: userIdToBlock })
      if (error && error.code !== "23505")
        toast({ variant: "destructive", title: "Error blocking user", description: error.message })
      else toast({ title: "User Blocked" })
    },
    [loggedInUser, supabase, toast],
  )

  const unblockUser = useCallback(
    async (userIdToUnblock: string) => {
      if (!loggedInUser) return
      const { error } = await supabase
        .from("blocked_users")
        .delete()
        .eq("blocker_id", loggedInUser.id)
        .eq("blocked_id", userIdToUnblock)
      if (error) toast({ variant: "destructive", title: "Error unblocking user", description: error.message })
      else toast({ title: "User Unblocked" })
    },
    [loggedInUser, supabase, toast],
  )

  const addEvent = useCallback(
    async (eventData: Omit<Event, "id" | "created_at" | "rsvps">) => {
      const { data, error } = await supabase
        .from("events")
        .insert(eventData)
        .select("*, profiles:creator_id(*), rsvps:event_rsvps(*)")
        .single()
      if (error) {
        toast({ variant: "destructive", title: "Error creating event", description: error.message })
      }
    },
    [supabase, toast],
  )

  const updateEvent = useCallback(
    async (eventId: number, eventData: Partial<Event>) => {
      const { data, error } = await supabase
        .from("events")
        .update(eventData)
        .eq("id", eventId)
        .select("*, profiles:creator_id(*), rsvps:event_rsvps(*)")
        .single()
      if (error) {
        toast({ variant: "destructive", title: "Error updating event", description: error.message })
      }
    },
    [supabase, toast],
  )

  const rsvpToEvent = useCallback(
    async (eventId: number, status: RSVPStatus) => {
      if (!loggedInUser) return
      const { error } = await supabase
        .from("event_rsvps")
        .upsert({ event_id: eventId, user_id: loggedInUser.id, status })
      if (error) toast({ variant: "destructive", title: "Error updating RSVP", description: error.message })
      else toast({ title: "RSVP updated!" })
    },
    [loggedInUser, supabase, toast],
  )

  const shareEventInChats = useCallback(
    async (event: Event, chatIds: number[]) => {
      if (!loggedInUser) return
      const messagesToInsert = chatIds.map((chatId) => ({
        chat_id: chatId,
        user_id: loggedInUser.id,
        content: null,
        attachment_url: `${window.location.origin}/events/${event.id}`,
        attachment_metadata: {
          type: "event_share",
          name: event.title,
          size: 0,
          eventId: event.id,
          eventDate: event.date_time,
          eventThumbnail: event.thumbnail,
        },
      }))

      const { error } = await supabase.from("messages").insert(messagesToInsert)
      if (error) toast({ variant: "destructive", title: "Error sharing event", description: error.message })
      else toast({ title: "Event Shared!", description: `Shared to ${chatIds.length} chat(s).` })
    },
    [loggedInUser, supabase, toast],
  )

  if (!isReady) return <AppLoading />

  const value = {
    loggedInUser,
    allUsers,
    chats,
    dmRequests,
    blockedUsers,
    events,
    sendDmRequest,
    addChat,
    updateUser,
    leaveGroup,
    deleteGroup,
    themeSettings,
    setThemeSettings,
    isReady,
    resetUnreadCount,
    forwardMessage,
    reportUser,
    blockUser,
    unblockUser,
    addEvent,
    updateEvent,
    rsvpToEvent,
    shareEventInChats,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) throw new Error("useAppContext must be used within an AppProvider")
  return context
}
