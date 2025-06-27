
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
  const isInitializingRef = useRef(false)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const subscriptionsRef = useRef<any[]>([])

  const fetchInitialData = useCallback(
    async (session: Session) => {
      if (isInitializingRef.current) return
      isInitializingRef.current = true
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
        if (unreadData) (unreadData as any[]).forEach((item: any) => unreadMap.set(item.chat_id_result, item.unread_count_result))
        const mappedChats = chatsData.map((chat) => ({
          ...chat,
          messages: [],
          unreadCount: unreadMap.get(chat.id) || 0,
        }))
        setChats(mappedChats as unknown as Chat[])
      } catch (error: any) {
        console.error("Error in fetchInitialData:", error)
        toast({ variant: "destructive", title: "Error loading data", description: error.message })
        setLoggedInUser(null);
        setChats([]);
        setAllUsers([]);
        setDmRequests([]);
        setBlockedUsers([]);
        setEvents([]);
      } finally {
        isInitializingRef.current = false
      }
    },
    [supabase, toast],
  )
  
  // Initialization and Auth State Change Handler
  useEffect(() => {
    let mounted = true;

    // Load theme settings from localStorage
    try {
      const savedSettings = localStorage.getItem("themeSettings");
      if (savedSettings) setThemeSettingsState(JSON.parse(savedSettings));
    } catch (error) {
      console.error("Could not load theme settings:", error);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      setSession(session);
      
      if (session) {
        // Only fetch data on initial session or when user explicitly signs in.
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          await fetchInitialData(session);
        }
      } else {
        // User is signed out. Clear all data.
        setLoggedInUser(null);
        setChats([]);
        setAllUsers([]);
        setDmRequests([]);
        setBlockedUsers([]);
        setEvents([]);
      }

      // Mark the app as "ready" to be displayed after the first auth event is processed.
      if (mounted) {
        setIsReady(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchInitialData, supabase.auth]); // Stable dependencies


  // Realtime subscriptions
  useEffect(() => {
    if (!loggedInUser || !isReady) {
      // Clean up all subscriptions if user logs out or app isn't ready
      subscriptionsRef.current.forEach((sub) => supabase.removeChannel(sub));
      subscriptionsRef.current = [];
      return;
    }
  
    // At this point, we know we have a logged-in user.
    // We setup or reset subscriptions.
    subscriptionsRef.current.forEach((sub) => supabase.removeChannel(sub));
    subscriptionsRef.current = [];
  
    const handleDmRequestChange = async () => {
      const { data, error } = await supabase
        .from("dm_requests")
        .select("*, from:profiles!from_user_id(*), to:profiles!to_user_id(*)")
        .or(`from_user_id.eq.${loggedInUser.id},to_user_id.eq.${loggedInUser.id}`);
      if (error) console.error("Error re-fetching DM requests:", error);
      else setDmRequests(data as DmRequest[]);
    };
  
    const handleBlockedUsersChange = (payload: RealtimePostgresChangesPayload<{ blocked_id: string }>) => {
      if (payload.eventType === "INSERT") setBlockedUsers((current) => [...current, payload.new.blocked_id]);
      else if (payload.eventType === "DELETE")
        setBlockedUsers((current) => current.filter((id) => id !== (payload.old as any).blocked_id));
    };
  
    const handleEventChange = (payload: RealtimePostgresChangesPayload<Event>) => {
      setEvents((current) => {
        if (payload.eventType === "INSERT") {
          const newEvent = { ...payload.new, profiles: allUsers.find((u) => u.id === payload.new.creator_id) } as Event;
          return [...current, newEvent];
        }
        if (payload.eventType === "UPDATE") return current.map((e) => (e.id === payload.new.id ? { ...e, ...payload.new } : e));
        if (payload.eventType === "DELETE") return current.filter((e) => e.id !== (payload.old as any).id);
        return current;
      });
    };
  
    const handleRsvpChange = (payload: RealtimePostgresChangesPayload<any>) => {
      const rsvp = payload.new;
      setEvents((currentEvents) =>
        currentEvents.map((e) => {
          if (e.id === rsvp.event_id) {
            const newRsvps = e.rsvps.filter(r => r.user_id !== rsvp.user_id);
            newRsvps.push({ event_id: rsvp.event_id, user_id: rsvp.user_id, status: rsvp.status });
            return { ...e, rsvps: newRsvps };
          }
          return e;
        }),
      );
    };
  
    const dmRequestChannel = supabase.channel(`dm-requests-${loggedInUser.id}`).on("postgres_changes", { event: "*", schema: "public", table: "dm_requests", filter: `or(from_user_id.eq.${loggedInUser.id},to_user_id.eq.${loggedInUser.id})` }, handleDmRequestChange).subscribe();
    const blockedUsersChannel = supabase.channel(`blocked-users-${loggedInUser.id}`).on("postgres_changes", { event: "*", schema: "public", table: "blocked_users", filter: `blocker_id=eq.${loggedInUser.id}` }, handleBlockedUsersChange as any).subscribe();
    const eventsChannel = supabase.channel(`events`).on("postgres_changes", { event: "*", schema: "public", table: "events" }, handleEventChange as any).subscribe();
    const rsvpChannel = supabase.channel(`rsvp`).on("postgres_changes", { event: "*", schema: "public", table: "event_rsvps" }, handleRsvpChange as any).subscribe();
  
    subscriptionsRef.current = [dmRequestChannel, blockedUsersChannel, eventsChannel, rsvpChannel];
  
    return () => {
      subscriptionsRef.current.forEach((sub) => supabase.removeChannel(sub));
      subscriptionsRef.current = [];
    };
  }, [loggedInUser, isReady, supabase, allUsers]);

  const chatIdsString = useMemo(() => chats.map((c) => c.id).sort().join(","), [chats]);
  
  useEffect(() => {
    if (!isReady || !loggedInUser || !chatIdsString) return;

    const handleNewMessage = (payload: RealtimePostgresChangesPayload<Message>) => {
        const newMessage = payload.new as Message
        if (newMessage.user_id === loggedInUser.id) return

        const currentChatId = pathname.split("/chat/")[1]
        const isChatOpen = String(newMessage.chat_id) === currentChatId

        if (isChatOpen) return;

        setChats((currentChats) =>
          currentChats.map((c) => {
            if (c.id === newMessage.chat_id) {
              const newUnreadCount = (c.unreadCount || 0) + 1
              return { ...c, last_message_content: newMessage.content, last_message_timestamp: newMessage.created_at, unreadCount: newUnreadCount }
            }
            return c
          }),
        )

        const isWindowFocused = document.hasFocus()
        if (!isWindowFocused && Notification.permission === "granted" && !blockedUsers.includes(newMessage.user_id)) {
          const sender = allUsers.find((u) => u.id === newMessage.user_id)
          if (sender) {
            const notification = new Notification(sender.name || "New Message", {
              body: newMessage.content || "Sent an attachment",
              icon: sender.avatar_url || "/logo/light_KCS.png",
              tag: `chat-${newMessage.chat_id}`,
            })
            notification.onclick = () => {
              window.focus()
              router.push(`/chat/${newMessage.chat_id}`)
              notification.close()
            }
          }
        }
      }

    const handleChatUpdate = (payload: any) => setChats((current) => current.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c)))
    const handleChatDelete = (payload: any) => setChats((current) => current.filter((c) => c.id !== payload.old.id))

    const messageChannel = supabase.channel(`global-messages-provider-${loggedInUser.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=in.(${chatIdsString})` }, handleNewMessage as any).subscribe()
    const chatsChannel = supabase.channel(`chats-provider-${loggedInUser.id}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "chats", filter: `id=in.(${chatIdsString})` }, handleChatUpdate).on("postgres_changes", { event: "DELETE", schema: "public", table: "chats", filter: `id=in.(${chatIdsString})` }, handleChatDelete).subscribe()

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(chatsChannel);
    };
  }, [isReady, loggedInUser, chatIdsString, supabase, pathname, allUsers, blockedUsers, router]);


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
      const { error } = await supabase.from("profiles").update({ name: updates.name, username: updates.username, bio: updates.bio, avatar_url: updates.avatar_url }).eq("id", loggedInUser.id)
      if (error) {
        toast({ variant: "destructive", title: "Error updating profile", description: error.message })
        setLoggedInUser(oldUser)
      }
    },
    [loggedInUser, supabase, toast],
  )

  const leaveGroup = useCallback(async (chatId: number) => {
    if (!loggedInUser) return
    const { error } = await supabase.from("participants").delete().match({ chat_id: chatId, user_id: loggedInUser.id })
    if (error) toast({ variant: "destructive", title: "Error leaving group", description: error.message })
    else setChats((current) => current.filter((c) => c.id !== chatId))
  }, [loggedInUser, supabase, toast])

  const deleteGroup = useCallback(async (chatId: number) => {
    const { error } = await supabase.from("chats").delete().eq("id", chatId)
    if (error) toast({ variant: "destructive", title: "Error deleting group", description: error.message })
    else setChats((current) => current.filter((c) => c.id !== chatId))
  }, [supabase, toast])

  const sendDmRequest = useCallback(async (toUserId: string, reason: string) => {
    if (!loggedInUser) return
    const { error } = await supabase.from("dm_requests").insert({ from_user_id: loggedInUser.id, to_user_id: toUserId, reason: reason })
    if (error) toast({ variant: "destructive", title: "Error sending request", description: error.message })
    else toast({ title: "Request Sent!", description: "Your request to message this user has been sent for approval." })
  }, [loggedInUser, supabase, toast])

  const forwardMessage = useCallback(async (message: Message, chatIds: number[]) => {
    if (!loggedInUser) return
    const originalSenderName = message.profiles.name
    const messagesToInsert = chatIds.map((chatId) => {
      let content = ""
      const prefix = `Forwarded from **${originalSenderName}**`
      if (message.content) content = message.content.startsWith("Forwarded from") ? message.content : `${prefix}\n\n${message.content}`
      else content = prefix
      return { chat_id: chatId, user_id: loggedInUser.id, content: content, attachment_url: message.attachment_url, attachment_metadata: message.attachment_metadata }
    })
    const { error } = await supabase.from("messages").insert(messagesToInsert)
    if (error) toast({ variant: "destructive", title: "Error forwarding message", description: error.message })
    else toast({ title: "Message Forwarded", description: `Your message was sent to ${chatIds.length} chat(s).` })
  }, [loggedInUser, supabase, toast])

  const resetUnreadCount = useCallback((chatId: number) => {
    setChats((current) => current.map((c) => (c.id === chatId && c.unreadCount ? { ...c, unreadCount: 0 } : c)))
  }, [])

  const reportUser = useCallback(async (reportedUserId: string, reason: string, messageId?: number) => {
    if (!loggedInUser) return
    const { error } = await supabase.from("reports").insert({ reported_by: loggedInUser.id, reported_user_id: reportedUserId, reason, message_id: messageId })
    if (error) toast({ variant: "destructive", title: "Error submitting report", description: error.message })
    else toast({ title: "Report Submitted", description: "Thank you for helping keep our community safe." })
  }, [loggedInUser, supabase, toast])

  const blockUser = useCallback(async (userIdToBlock: string) => {
    if (!loggedInUser) return
    const { error } = await supabase.from("blocked_users").insert({ blocker_id: loggedInUser.id, blocked_id: userIdToBlock })
    if (error && error.code !== "23505") toast({ variant: "destructive", title: "Error blocking user", description: error.message })
    else toast({ title: "User Blocked" })
  }, [loggedInUser, supabase, toast])

  const unblockUser = useCallback(async (userIdToUnblock: string) => {
    if (!loggedInUser) return
    const { error } = await supabase.from("blocked_users").delete().eq("blocker_id", loggedInUser.id).eq("blocked_id", userIdToUnblock)
    if (error) toast({ variant: "destructive", title: "Error unblocking user", description: error.message })
    else toast({ title: "User Unblocked" })
  }, [loggedInUser, supabase, toast])

  const addEvent = useCallback(async (eventData: Omit<Event, "id" | "created_at" | "rsvps">) => {
    await supabase.from("events").insert(eventData).select("*, profiles:creator_id(*), rsvps:event_rsvps(*)")
  }, [supabase])

  const updateEvent = useCallback(async (eventId: number, eventData: Partial<Event>) => {
    await supabase.from("events").update(eventData).eq("id", eventId).select("*, profiles:creator_id(*), rsvps:event_rsvps(*)")
  }, [supabase])

  const rsvpToEvent = useCallback(async (eventId: number, status: RSVPStatus) => {
    if (!loggedInUser) return
    const { error } = await supabase.from("event_rsvps").upsert({ event_id: eventId, user_id: loggedInUser.id, status })
    if (error) toast({ variant: "destructive", title: "Error updating RSVP", description: error.message })
    else toast({ title: "RSVP updated!" })
  }, [loggedInUser, supabase, toast])

  const shareEventInChats = useCallback(async (event: Event, chatIds: number[]) => {
    if (!loggedInUser) return
    const messagesToInsert = chatIds.map((chatId) => ({
      chat_id: chatId, user_id: loggedInUser.id, content: null,
      attachment_url: `${window.location.origin}/events/${event.id}`,
      attachment_metadata: { type: "event_share", name: event.title, size: 0, eventId: event.id, eventDate: event.date_time, eventThumbnail: event.thumbnail },
    }))
    const { error } = await supabase.from("messages").insert(messagesToInsert)
    if (error) toast({ variant: "destructive", title: "Error sharing event", description: error.message })
    else toast({ title: "Event Shared!", description: `Shared to ${chatIds.length} chat(s).` })
  }, [loggedInUser, supabase, toast])

  if (!isReady) return <AppLoading />

  const value = { loggedInUser, allUsers, chats, dmRequests, blockedUsers, events, sendDmRequest, addChat, updateUser, leaveGroup, deleteGroup, themeSettings, setThemeSettings, isReady, resetUnreadCount, forwardMessage, reportUser, blockUser, unblockUser, addEvent, updateEvent, rsvpToEvent, shareEventInChats }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) throw new Error("useAppContext must be used within an AppProvider")
  return context
}
