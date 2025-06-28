
"use client"

import { createContext, useContext, useState, type ReactNode, useEffect, useCallback, useMemo, useRef } from "react"
import type { User, Chat, ThemeSettings, Message, DmRequest, Event, EventRSVP, RSVPStatus, AppContextType } from "@/lib/types"
import { createClient } from "@/lib/utils"
import { Icons } from "@/components/icons"
import { useToast } from "@/hooks/use-toast"
import type { Session, RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { usePathname, useRouter } from "next/navigation"

const AppContext = createContext<AppContextType | undefined>(undefined)

function AppLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Icons.logo className="h-16 w-16 animate-pulse text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading your chats...</p>
      </div>
    </div>
  )
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [dmRequests, setDmRequests] = useState<DmRequest[]>([])
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [themeSettings, setThemeSettingsState] = useState<ThemeSettings>({
    outgoingBubbleColor: "hsl(221.2 83.2% 53.3%)",
    incomingBubbleColor: "hsl(210 40% 96.1%)",
    usernameColor: "hsl(var(--primary))",
    chatWallpaper: "/chat-bg.png",
    wallpaperBrightness: 100,
  })
  const [isReady, setIsReady] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)

  // Use refs to prevent infinite loops and stale closures
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const initialSessionProcessed = useRef(false)
  const subscriptionsRef = useRef<any[]>([])
  const notificationPermissionRequested = useRef(false)
  const pathnameRef = useRef('')

  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()

  // Keep pathnameRef updated
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Request notification permission early
  const requestNotificationPermission = useCallback(async () => {
    if (notificationPermissionRequested.current) return
    notificationPermissionRequested.current = true

    if ("Notification" in window && Notification.permission === "default") {
      try {
        const permission = await Notification.requestPermission()
        if (permission === "granted") {
          new Notification("Notifications Enabled", {
            body: "You will now receive message notifications",
            icon: "/logo/light_KCS.png",
            tag: "permission-granted",
          })
        }
      } catch (error) {
        console.error("Error requesting notification permission:", error)
      }
    }
  }, [])

  const fetchInitialData = useCallback(
    async (session: Session) => {
      if (isInitializing) return
      setIsInitializing(true)

      try {
        const { user } = session
        const [
          { data: profile, error: profileError },
          { data: allUsersData, error: usersError },
          { data: dmRequestsData, error: dmError },
          { data: blockedData, error: blockedError },
          { data: unreadData, error: unreadError },
          { data: chatParticipants, error: participantError },
          { data: eventsData, error: eventsError },
        ] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase.from("profiles").select("*"),
          supabase.from("dm_requests").select("*, from:profiles!from_user_id(*), to:profiles!to_user_id(*)").or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`),
          supabase.from("blocked_users").select("blocked_user_id").eq("user_id", user.id),
          supabase.rpc("get_unread_counts", { p_user_id: user.id }),
          supabase.from("participants").select("chat_id").eq("user_id", user.id),
          supabase.from("events").select("*, rsvps:event_rsvps(*), profiles:creator_id(*)"),
        ])

        if (profileError || !profile) {
          console.error("Error fetching profile:", profileError)
          await supabase.auth.signOut()
          throw new Error("Could not fetch user profile")
        }

        if (participantError || usersError || dmError || blockedError || unreadError || eventsError) {
          console.error({ participantError, usersError, dmError, blockedError, unreadError, eventsError })
        }

        const fullUserProfile = { ...profile, email: user.email } as User
        setLoggedInUser(fullUserProfile)
        setAllUsers((allUsersData as User[]) || [])
        setDmRequests((dmRequestsData as DmRequest[]) || [])
        setBlockedUsers(blockedData?.map(b => b.blocked_user_id) || [])
        setEvents((eventsData as Event[]) || [])
        
        const chatIds = chatParticipants?.map((p) => p.chat_id) || []
        let chatsData: any[] = []

        if (chatIds.length > 0) {
          const { data, error: chatListError } = await supabase
            .from("chats").select(`*, participants:participants!chat_id(*, profiles!user_id(*))`).in("id", chatIds)
          if (!chatListError) chatsData = data || []
        }

        const unreadMap = new Map<number, number>()
        if (unreadData && !unreadError) {
          ;(unreadData as any[]).forEach((item: any) => {
            unreadMap.set(item.chat_id_result, item.unread_count_result)
          })
        }

        const mappedChats = chatsData.map((chat) => ({
          ...chat,
          messages: [],
          unreadCount: unreadMap.get(chat.id) || 0,
        }))

        setChats(mappedChats as unknown as Chat[])
        await requestNotificationPermission()

      } catch (error: any) {
        console.error("Error in fetchInitialData:", error)
        toast({
          variant: "destructive",
          title: "Error loading data",
          description: error.message || "Failed to load application data",
        })
        setLoggedInUser(null)
        setChats([])
        setAllUsers([])
        setDmRequests([])
        setEvents([])
        setBlockedUsers([])
      } finally {
        setIsInitializing(false)
      }
    },
    [supabase, toast, requestNotificationPermission, isInitializing],
  )

  useEffect(() => {
    let mounted = true
    try {
      const savedSettings = localStorage.getItem("themeSettings")
      if (savedSettings) setThemeSettingsState(JSON.parse(savedSettings))
    } catch (error) {
      console.error("Could not load theme settings:", error)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      setSession(session);
      if (event === "SIGNED_IN" && session && !initialSessionProcessed.current) {
        initialSessionProcessed.current = true;
        await fetchInitialData(session);
      } else if (event === "SIGNED_OUT") {
        initialSessionProcessed.current = false;
        setLoggedInUser(null);
        setChats([]);
        setAllUsers([]);
        setDmRequests([]);
        setEvents([]);
        setBlockedUsers([]);
      }
      if (mounted) setIsReady(true);
    })

    return () => {
      mounted = false;
      subscription.unsubscribe();
    }
  }, [supabase, fetchInitialData, toast, router])

  const handleNewMessage = useCallback(
    (payload: RealtimePostgresChangesPayload<Message>) => {
      if (!loggedInUser) return

      const newMessage = payload.new as Message
      if (newMessage.user_id === loggedInUser.id) return

      const openChatId = pathnameRef.current.split("/chat/")[1];
      const isChatOpen = String(newMessage.chat_id) === openChatId;

      if (isChatOpen) return;

      setChats((currentChats) =>
        currentChats.map((c) => {
          if (c.id === newMessage.chat_id) {
            return {
              ...c,
              unreadCount: (c.unreadCount || 0) + 1,
              last_message_content: newMessage.attachment_url
                ? newMessage.attachment_metadata?.name || "Sent an attachment"
                : newMessage.content,
              last_message_timestamp: newMessage.created_at,
            }
          }
          return c
        }),
      )

      if (Notification.permission === "granted") {
        const sender = allUsers.find((u) => u.id === newMessage.user_id)
        if (sender) {
          const title = sender.name || "New Message"
          const body = newMessage.content || (newMessage.attachment_metadata?.name ? `Sent: ${newMessage.attachment_metadata.name}` : "Sent an attachment")
          
          const notification = new Notification(title, {
              body: body,
              icon: sender.avatar_url || "/logo/light_KCS.png",
              tag: `chat-${newMessage.chat_id}`,
          });

          notification.onclick = () => {
              window.focus();
              router.push(`/chat/${newMessage.chat_id}`);
          };
        }
      }
    },
    [loggedInUser, allUsers, router],
  )
  
  const chatIdsString = useMemo(() => chats.map((c) => c.id).sort().join(","), [chats])

  useEffect(() => {
    if (!isReady || !loggedInUser || !chatIdsString) return

    subscriptionsRef.current.forEach((sub) => supabase.removeChannel(sub));
    subscriptionsRef.current = [];

    const handleChatUpdate = (payload: RealtimePostgresChangesPayload<Chat>) => setChats((current) => current.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c)))
    const handleChatDelete = (payload: RealtimePostgresChangesPayload<Chat>) => setChats((current) => current.filter((c) => c.id !== payload.old.id))

    const messageChannel = supabase.channel("new-message-notifications-provider").on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=in.(${chatIdsString})` }, handleNewMessage as any).subscribe()
    const chatsChannel = supabase.channel("chats-changes-provider").on("postgres_changes", { event: "UPDATE", schema: "public", table: "chats", filter: `id=in.(${chatIdsString})` }, handleChatUpdate as any).on("postgres_changes", { event: "DELETE", schema: "public", table: "chats", filter: `id=in.(${chatIdsString})` }, handleChatDelete as any).subscribe()
    
    subscriptionsRef.current = [messageChannel, chatsChannel];

    return () => {
      subscriptionsRef.current.forEach((sub) => supabase.removeChannel(sub))
      subscriptionsRef.current = [];
    }
  }, [isReady, loggedInUser, chatIdsString, supabase, handleNewMessage])

  useEffect(() => {
    if (!loggedInUser) return

    const handleRealtimeChanges = async (table: string) => {
        if (table === 'dm_requests') {
            const { data, error } = await supabase.from("dm_requests").select("*, from:profiles!from_user_id(*), to:profiles!to_user_id(*)").or(`from_user_id.eq.${loggedInUser.id},to_user_id.eq.${loggedInUser.id}`)
            if (!error) setDmRequests(data as DmRequest[]);
        } else if (table === 'blocked_users') {
            const { data, error } = await supabase.from("blocked_users").select("blocked_user_id").eq("user_id", loggedInUser.id)
            if (!error) setBlockedUsers(data?.map(b => b.blocked_user_id) || []);
        } else if (table === 'events' || table === 'event_rsvps') {
            const { data, error } = await supabase.from("events").select("*, rsvps:event_rsvps(*), profiles:creator_id(*)")
            if (!error) setEvents(data as Event[]);
        }
    }

    const dmRequestChannel = supabase.channel("dm-requests-changes").on("postgres_changes", { event: "*", schema: "public", table: "dm_requests", filter: `or(from_user_id.eq.${loggedInUser.id},to_user_id.eq.${loggedInUser.id})` }, () => handleRealtimeChanges('dm_requests')).subscribe()
    const blockedUsersChannel = supabase.channel("blocked-users-changes").on("postgres_changes", { event: "*", schema: "public", table: "blocked_users", filter: `user_id.eq.${loggedInUser.id}` }, () => handleRealtimeChanges('blocked_users')).subscribe()
    const eventsChannel = supabase.channel("events-changes").on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => handleRealtimeChanges('events')).subscribe()
    const rsvpChannel = supabase.channel("rsvp-changes").on("postgres_changes", { event: "*", schema: "public", table: "event_rsvps" }, () => handleRealtimeChanges('events')).subscribe()
    
    return () => {
      supabase.removeChannel(dmRequestChannel);
      supabase.removeChannel(blockedUsersChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(rsvpChannel);
    }
  }, [loggedInUser, supabase])

  const setThemeSettings = useCallback((newSettings: Partial<ThemeSettings>) => {
    setThemeSettingsState((prev) => {
      const updated = { ...prev, ...newSettings }
      try {
        localStorage.setItem("themeSettings", JSON.stringify(updated))
      } catch (error) {
        console.error("Could not save theme settings to localStorage", error)
      }
      return updated
    })
  }, [])

  const addChat = useCallback((newChat: Chat) => {
    setChats((currentChats) => {
      if (currentChats.some((c) => c.id === newChat.id)) return currentChats
      return [newChat, ...currentChats]
    })
  }, [])

  const updateUser = useCallback(
    async (updates: Partial<User>) => {
      if (!loggedInUser) return
      const oldUser = { ...loggedInUser }
      setLoggedInUser((current) => ({ ...current!, ...updates }))
      try {
        const { error } = await supabase.from("profiles").update({ name: updates.name, username: updates.username, bio: updates.bio, avatar_url: updates.avatar_url }).eq("id", loggedInUser.id)
        if (error) {
          toast({ variant: "destructive", title: "Error updating profile", description: error.message })
          setLoggedInUser(oldUser)
        }
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error updating profile", description: error.message })
        setLoggedInUser(oldUser)
      }
    },
    [loggedInUser, supabase, toast],
  )

  const leaveGroup = useCallback(async (chatId: number) => {
    if (!loggedInUser) return
    try {
      const { error } = await supabase.from("participants").delete().match({ chat_id: chatId, user_id: loggedInUser.id, })
      if (error) throw error;
      setChats((current) => current.filter((c) => c.id !== chatId))
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error leaving group", description: error.message })
    }
  }, [loggedInUser, supabase, toast])

  const deleteGroup = useCallback(async (chatId: number) => {
    try {
      const { error } = await supabase.from("chats").delete().eq("id", chatId)
      if (error) throw error;
      setChats((current) => current.filter((c) => c.id !== chatId))
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error deleting group", description: error.message })
    }
  }, [supabase, toast])

  const sendDmRequest = useCallback(async (toUserId: string, reason: string) => {
    if (!loggedInUser) return
    try {
      const { error } = await supabase.from("dm_requests").insert({ from_user_id: loggedInUser.id, to_user_id: toUserId, reason: reason })
      if (error) throw error;
      toast({ title: "Request Sent!", description: "Your request to message this user has been sent for approval." })
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error sending request", description: error.message })
    }
  }, [loggedInUser, supabase, toast])

  const blockUser = useCallback(async (userId: string) => {
    if (!loggedInUser) return
    setBlockedUsers(prev => [...prev, userId]);
    const { error } = await supabase.from("blocked_users").insert({ user_id: loggedInUser.id, blocked_user_id: userId })
    if (error) {
        setBlockedUsers(prev => prev.filter(id => id !== userId));
        toast({ variant: 'destructive', title: 'Error blocking user', description: error.message });
    } else {
        toast({ title: 'User Blocked', description: 'You will no longer see messages from this user.' });
    }
  }, [loggedInUser, supabase, toast]);

  const unblockUser = useCallback(async (userId: string) => {
    if (!loggedInUser) return
    setBlockedUsers(prev => prev.filter(id => id !== userId));
    const { error } = await supabase.from("blocked_users").delete().match({ user_id: loggedInUser.id, blocked_user_id: userId })
    if (error) {
        setBlockedUsers(prev => [...prev, userId]);
        toast({ variant: 'destructive', title: 'Error unblocking user', description: error.message });
    } else {
        toast({ title: 'User Unblocked' });
    }
  }, [loggedInUser, supabase, toast]);

  const reportUser = useCallback(async (reportedUserId: string, reason: string, messageId?: number) => {
    if (!loggedInUser) return;
    const { error } = await supabase.from('reports').insert({
        reported_by: loggedInUser.id,
        reported_user_id: reportedUserId,
        reason: reason,
        message_id: messageId
    });
    if (error) {
        toast({ variant: 'destructive', title: 'Error submitting report', description: error.message });
    } else {
        toast({ title: 'Report Submitted', description: 'Thank you for helping keep the community safe.' });
    }
  }, [loggedInUser, supabase, toast]);

  const forwardMessage = useCallback(async (message: Message, chatIds: number[]) => {
      if (!loggedInUser) return;
      const originalSender = allUsers.find(u => u.id === message.user_id)?.name || 'Unknown User';

      const forwardPromises = chatIds.map(chatId => {
          return supabase.from('messages').insert({
              chat_id: chatId,
              user_id: loggedInUser.id,
              content: `Forwarded from **${originalSender}**\n${message.content || ''}`,
              attachment_url: message.attachment_url,
              attachment_metadata: message.attachment_metadata,
          });
      });

      try {
          const results = await Promise.all(forwardPromises);
          const failed = results.filter(r => r.error);
          if (failed.length > 0) {
              toast({ variant: 'destructive', title: 'Some messages failed to forward', description: `Could not forward to ${failed.length} chats.` });
          } else {
              toast({ title: 'Message Forwarded', description: `Successfully forwarded to ${chatIds.length} chat(s).` });
          }
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Error forwarding messages', description: error.message });
      }
  }, [loggedInUser, supabase, toast, allUsers]);

  const shareEventInChats = useCallback(async (event: Event, chatIds: number[]) => {
    if (!loggedInUser) return;
    
    const sharePromises = chatIds.map(chatId => {
      return supabase.from('messages').insert({
        chat_id: chatId,
        user_id: loggedInUser.id,
        content: `Check out this event: ${event.title}`,
        attachment_url: event.thumbnail, 
        attachment_metadata: {
            type: 'event_share',
            name: event.title,
            size: 0,
            eventId: event.id,
            eventDate: event.date_time,
            eventThumbnail: event.thumbnail,
        },
      });
    });

    try {
      const results = await Promise.all(sharePromises);
      const failed = results.filter(r => r.error);
      if (failed.length > 0) {
        toast({ variant: 'destructive', title: 'Some shares failed', description: `Could not share in ${failed.length} chats.` });
      } else {
        toast({ title: 'Event Shared!', description: `Successfully shared in ${chatIds.length} chat(s).` });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error sharing event', description: error.message });
    }
  }, [loggedInUser, supabase, toast]);

  const addEvent = useCallback(async (event: Omit<Event, 'id' | 'created_at' | 'rsvps' | 'profiles'>) => {
    const { error } = await supabase.from('events').insert(event);
    if (error) throw new Error(error.message);
  }, [supabase]);

  const updateEvent = useCallback(async (eventId: number, updates: Partial<Event>) => {
    const { error } = await supabase.from('events').update(updates).eq('id', eventId);
    if (error) throw new Error(error.message);
  }, [supabase]);

  const rsvpToEvent = useCallback(async (eventId: number, status: RSVPStatus) => {
    if (!loggedInUser) return;
    const { error } = await supabase.from('event_rsvps').upsert({
        event_id: eventId,
        user_id: loggedInUser.id,
        status: status
    }, { onConflict: 'event_id, user_id' });
     if (error) {
        toast({ variant: 'destructive', title: 'Error RSVPing', description: error.message });
    } else {
        toast({ title: `You're now marked as ${status}!` });
    }
  }, [loggedInUser, supabase, toast]);

  const resetUnreadCount = useCallback((chatId: number) => {
    setChats((current) => current.map((c) => (c.id === chatId && c.unreadCount ? { ...c, unreadCount: 0 } : c)))
  }, [])

  if (!isReady) {
    return <AppLoading />
  }

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
    blockUser,
    unblockUser,
    reportUser,
    forwardMessage,
    shareEventInChats,
    addEvent,
    updateEvent,
    rsvpToEvent,
    themeSettings,
    setThemeSettings,
    isReady,
    resetUnreadCount,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider")
  }
  return context
}
