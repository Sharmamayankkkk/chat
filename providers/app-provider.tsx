"use client"

import { createContext, useContext, useState, type ReactNode, useEffect, useCallback, useMemo, useRef } from "react"
import type { User, Chat, ThemeSettings, Message, DmRequest } from "@/lib/types"
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
  sendDmRequest: (toUserId: string, reason: string) => Promise<void>
  addChat: (newChat: Chat) => void
  updateUser: (updates: Partial<User>) => Promise<void>
  leaveGroup: (chatId: number) => Promise<void>
  deleteGroup: (chatId: number) => Promise<void>
  themeSettings: ThemeSettings
  setThemeSettings: (newSettings: Partial<ThemeSettings>) => void
  isReady: boolean
  resetUnreadCount: (chatId: number) => void
}

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
  const [themeSettings, setThemeSettingsState] = useState<ThemeSettings>({
    outgoingBubbleColor: "hsl(221.2 83.2% 53.3%)",
    incomingBubbleColor: "hsl(210 40% 96.1%)",
    usernameColor: "hsl(var(--primary))",
    chatWallpaper: "/chat-bg.png",
    wallpaperBrightness: 100,
  })
  const [isReady, setIsReady] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)

  // Use refs to prevent infinite loops
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const initialSessionProcessed = useRef(false)
  const subscriptionsRef = useRef<any[]>([])
  const notificationPermissionRequested = useRef(false)

  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()

  // Request notification permission early
  const requestNotificationPermission = useCallback(async () => {
    if (notificationPermissionRequested.current) return
    notificationPermissionRequested.current = true

    if ("Notification" in window && Notification.permission === "default") {
      try {
        const permission = await Notification.requestPermission()
        console.log("Notification permission:", permission)

        if (permission === "granted") {
          // Test notification
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
      if (isInitializing) return // Prevent multiple simultaneous fetches
      setIsInitializing(true)

      try {
        const { user } = session

        // Fetch data in parallel for better performance
        const [
          { data: profile, error: profileError },
          { data: allUsersData, error: usersError },
          { data: dmRequestsData, error: dmError },
          { data: unreadData, error: unreadError },
          { data: chatParticipants, error: participantError },
        ] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase.from("profiles").select("*"),
          supabase
            .from("dm_requests")
            .select("*, from:profiles!from_user_id(*), to:profiles!to_user_id(*)")
            .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`),
          supabase.rpc("get_unread_counts", { p_user_id: user.id }),
          supabase.from("participants").select("chat_id").eq("user_id", user.id),
        ])

        if (profileError || !profile) {
          console.error("Error fetching profile:", profileError)
          await supabase.auth.signOut()
          throw new Error("Could not fetch user profile")
        }

        if (participantError) {
          throw new Error("Could not fetch user's chats")
        }

        // Set user data
        const fullUserProfile = { ...profile, email: user.email } as User
        setLoggedInUser(fullUserProfile)
        setAllUsers((allUsersData as User[]) || [])
        setDmRequests((dmRequestsData as DmRequest[]) || [])

        // Fetch chats
        const chatIds = chatParticipants?.map((p) => p.chat_id) || []
        let chatsData: any[] = []

        if (chatIds.length > 0) {
          const { data, error: chatListError } = await supabase
            .from("chats")
            .select(`*, participants:participants!chat_id(*, profiles!user_id(*))`)
            .in("id", chatIds)

          if (chatListError) {
            console.error("Error fetching chats:", chatListError)
          } else {
            chatsData = data || []
          }
        }

        // Map unread counts
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

        // Request notification permission after successful login
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
      } finally {
        setIsInitializing(false)
      }
    },
    [supabase, toast, requestNotificationPermission, isInitializing],
  )

  // Initialize app and handle auth state changes
  useEffect(() => {
    let mounted = true

    // Load theme settings
    try {
      const savedSettings = localStorage.getItem("themeSettings")
      if (savedSettings) {
        setThemeSettingsState(JSON.parse(savedSettings))
      }
    } catch (error) {
      console.error("Could not load theme settings:", error)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log("Auth state change:", event, session?.user?.id)

      try {
        if (session && !initialSessionProcessed.current) {
          initialSessionProcessed.current = true
          setSession(session)
          await fetchInitialData(session)
        } else if (!session) {
          // Clear state when signed out
          initialSessionProcessed.current = false
          setSession(null)
          setLoggedInUser(null)
          setChats([])
          setAllUsers([])
          setDmRequests([])
        }
      } catch (error: any) {
        console.error("Error handling auth state change:", error)
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: error.message,
        })
      } finally {
        if (mounted) {
          setIsReady(true)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchInitialData, toast])

  // Enhanced notification handler
  const handleNewMessage = useCallback(
    (payload: RealtimePostgresChangesPayload<Message>) => {
      if (!loggedInUser) return

      const newMessage = payload.new as Message

      // Don't notify for own messages
      if (newMessage.user_id === loggedInUser.id) return

      const currentChatId = pathname.split("/chat/")[1]
      const isChatOpen = String(newMessage.chat_id) === currentChatId
      const isWindowFocused = document.hasFocus()

      // Update chat state
      setChats((currentChats) =>
        currentChats.map((c) => {
          if (c.id === newMessage.chat_id) {
            const shouldIncreaseUnread = !isChatOpen || !isWindowFocused
            const newUnreadCount = shouldIncreaseUnread ? (c.unreadCount || 0) + 1 : c.unreadCount

            return {
              ...c,
              last_message_content: newMessage.attachment_url
                ? newMessage.attachment_metadata?.name || "Sent an attachment"
                : newMessage.content,
              last_message_timestamp: newMessage.created_at,
              unreadCount: newUnreadCount,
            }
          }
          return c
        }),
      )

      // Show notification if conditions are met
      const shouldShowNotification = Notification.permission === "granted" && (!isChatOpen || !isWindowFocused)

      if (shouldShowNotification) {
        const sender = allUsers.find((u) => u.id === newMessage.user_id)

        if (sender) {
          const title = sender.name || "New Message"
          const body =
            newMessage.content ||
            (newMessage.attachment_metadata?.name
              ? `Sent: ${newMessage.attachment_metadata.name}`
              : "Sent an attachment")

          try {
            const notification = new Notification(title, {
              body: body,
              icon: sender.avatar_url || "/logo/light_KCS.png",
              tag: `chat-${newMessage.chat_id}`,
              badge: "/logo/light_KCS.png",
              requireInteraction: false,
              silent: false,
            })

            notification.onclick = () => {
              window.focus()
              notification.close()
              router.push(`/chat/${newMessage.chat_id}`)
            }

            // Auto close after 5 seconds
            setTimeout(() => {
              notification.close()
            }, 5000)
          } catch (error) {
            console.error("Error showing notification:", error)
          }
        } else {
          console.warn("Sender not found for notification:", newMessage.user_id)
        }
      }
    },
    [loggedInUser, pathname, allUsers, router],
  )

  // Set up realtime subscriptions
  const chatIdsString = useMemo(
    () =>
      chats
        .map((c) => c.id)
        .sort()
        .join(","),
    [chats],
  )

  useEffect(() => {
    if (!isReady || !loggedInUser || !chatIdsString) return

    // Clean up existing subscriptions
    subscriptionsRef.current.forEach((sub) => {
      supabase.removeChannel(sub)
    })
    subscriptionsRef.current = []

    const handleChatUpdate = (payload: RealtimePostgresChangesPayload<Chat>) => {
      setChats((current) => current.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c)))
    }

    const handleChatDelete = (payload: RealtimePostgresChangesPayload<Chat>) => {
      setChats((current) => current.filter((c) => c.id !== payload.old.id))
    }

    // Message notifications channel
    const messageChannel = supabase
      .channel("new-message-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=in.(${chatIdsString})`,
        },
        handleNewMessage as any,
      )
      .subscribe()

    // Chat updates channel
    const chatsChannel = supabase
      .channel("chats-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chats",
          filter: `id=in.(${chatIdsString})`,
        },
        handleChatUpdate as any,
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chats",
          filter: `id=in.(${chatIdsString})`,
        },
        handleChatDelete as any,
      )
      .subscribe()

    subscriptionsRef.current = [messageChannel, chatsChannel]

    return () => {
      subscriptionsRef.current.forEach((sub) => {
        supabase.removeChannel(sub)
      })
      subscriptionsRef.current = []
    }
  }, [isReady, loggedInUser, chatIdsString, supabase, handleNewMessage])

  // DM requests subscription
  useEffect(() => {
    if (!loggedInUser) return

    const handleDmRequestChange = async () => {
      try {
        const { data, error } = await supabase
          .from("dm_requests")
          .select("*, from:profiles!from_user_id(*), to:profiles!to_user_id(*)")
          .or(`from_user_id.eq.${loggedInUser.id},to_user_id.eq.${loggedInUser.id}`)

        if (error) {
          console.error("Error re-fetching DM requests:", error)
          return
        }
        setDmRequests(data as DmRequest[])
      } catch (error) {
        console.error("Error in DM request handler:", error)
      }
    }

    const dmRequestChannel = supabase
      .channel("dm-requests-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dm_requests",
          filter: `or(from_user_id.eq.${loggedInUser.id},to_user_id.eq.${loggedInUser.id})`,
        },
        handleDmRequestChange,
      )
      .subscribe()

    return () => {
      supabase.removeChannel(dmRequestChannel)
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
        const { error } = await supabase
          .from("profiles")
          .update({
            name: updates.name,
            username: updates.username,
            bio: updates.bio,
            avatar_url: updates.avatar_url,
          })
          .eq("id", loggedInUser.id)

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

  const leaveGroup = useCallback(
    async (chatId: number) => {
      if (!loggedInUser) return

      try {
        const { error } = await supabase.from("participants").delete().match({
          chat_id: chatId,
          user_id: loggedInUser.id,
        })

        if (error) {
          toast({ variant: "destructive", title: "Error leaving group", description: error.message })
        } else {
          setChats((current) => current.filter((c) => c.id !== chatId))
        }
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error leaving group", description: error.message })
      }
    },
    [loggedInUser, supabase, toast],
  )

  const deleteGroup = useCallback(
    async (chatId: number) => {
      try {
        const { error } = await supabase.from("chats").delete().eq("id", chatId)
        if (error) {
          toast({ variant: "destructive", title: "Error deleting group", description: error.message })
        } else {
          setChats((current) => current.filter((c) => c.id !== chatId))
        }
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error deleting group", description: error.message })
      }
    },
    [supabase, toast],
  )

  const sendDmRequest = useCallback(
    async (toUserId: string, reason: string) => {
      if (!loggedInUser) return

      try {
        const { error } = await supabase.from("dm_requests").insert({
          from_user_id: loggedInUser.id,
          to_user_id: toUserId,
          reason: reason,
        })

        if (error) {
          toast({ variant: "destructive", title: "Error sending request", description: error.message })
        } else {
          toast({
            title: "Request Sent!",
            description: "Your request to message this user has been sent for approval.",
          })
        }
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error sending request", description: error.message })
      }
    },
    [loggedInUser, supabase, toast],
  )

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
    sendDmRequest,
    addChat,
    updateUser,
    leaveGroup,
    deleteGroup,
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
