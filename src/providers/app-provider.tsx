
"use client"

import { createContext, useContext, useState, type ReactNode, useEffect, useCallback, useMemo, useRef } from "react"
import type { User, Chat, ThemeSettings, Message, DmRequest, AppContextType } from "@/lib/types"
import { createClient } from "@/lib/utils"
import { Icons } from "@/components/icons"
import { useToast } from "@/hooks/use-toast"
import type { Session, RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { usePathname, useRouter } from "next/navigation"

const AppContext = createContext<AppContextType | undefined>(undefined)

const sortChats = (chatArray: Chat[]) => {
  return [...(chatArray || [])].sort((a, b) => {
    const dateA = a.last_message_timestamp ? new Date(a.last_message_timestamp) : new Date(0)
    const dateB = b.last_message_timestamp ? new Date(b.last_message_timestamp) : new Date(0)
    return dateB.getTime() - dateA.getTime()
  })
}

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
  const [blockedUsers, setBlockedUsers] = useState<string[]>([])
  const [themeSettings, setThemeSettingsState] = useState<ThemeSettings>({
    outgoingBubbleColor: "hsl(221.2 83.2% 53.3%)",
    incomingBubbleColor: "hsl(210 40% 96.1%)",
    usernameColor: "hsl(var(--primary))",
    chatWallpaper: "/chat-bg.png",
    wallpaperBrightness: 100,
  })
  const [isReady, setIsReady] = useState(false)

  const supabaseRef = useRef(createClient())
  const subscriptionsRef = useRef<any[]>([])
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()

  const requestNotificationPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission()
    }
  }, [])

  const fetchInitialData = useCallback(async (session: Session) => {
    try {
        const { user } = session;

        // Fetch critical user profile first
        const { data: profile, error: profileError } = await supabaseRef.current.from("profiles").select("*").eq("id", user.id).single();
        if (profileError || !profile) {
            throw new Error("Could not fetch user profile. Please sign out and sign in again.");
        }
        const fullUserProfile = { ...profile, email: user.email } as User;
        setLoggedInUser(fullUserProfile);

        // Fetch other data in parallel, with individual error handling
        const [
            { data: allUsersData, error: usersError },
            { data: dmRequestsData, error: dmError },
            { data: blockedData, error: blockedError },
            { data: participantRecords, error: participantError }
        ] = await Promise.all([
            supabaseRef.current.from("profiles").select("*"),
            supabaseRef.current.from("dm_requests").select("*, from:profiles!from_user_id(*), to:profiles!to_user_id(*)").or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`),
            supabaseRef.current.from("blocked_users").select("blocked_id").eq("blocker_id", user.id),
            supabaseRef.current.from('participants').select('chat_id').eq('user_id', user.id)
        ]);

        if (usersError) console.error("Could not fetch all users:", usersError);
        if (dmError) console.error("Could not fetch DM requests:", dmError);
        if (blockedError) console.error("Could not fetch blocked users:", blockedError);
        if (participantError) console.error("Could not fetch user's chats list:", participantError);

        setAllUsers((allUsersData as User[]) || []);
        setDmRequests((dmRequestsData as DmRequest[]) || []);
        setBlockedUsers(blockedData?.map((b) => b.blocked_id) || []);

        const chatIds = participantRecords?.map(p => p.chat_id) || [];
        let initialChats: Chat[] = [];

        if (chatIds.length > 0) {
            const { data: chatDetails, error: chatDetailsError } = await supabaseRef.current
                .from('chats')
                .select('*, participants:participants(*, profiles!user_id(*))')
                .in('id', chatIds);
            
            if (chatDetailsError) {
              console.error("Error fetching chat details:", chatDetailsError);
            } else {
              const mappedChats = (chatDetails || []).map((chat) => ({
                  ...chat,
                  messages: [],
                  unreadCount: 0,
                  last_message_content: "...",
                  last_message_timestamp: chat.created_at,
              }));
              initialChats = mappedChats as unknown as Chat[];
            }
        }
        
        setChats(sortChats(initialChats));
        await requestNotificationPermission();

    } catch (error: any) {
        console.error("Error loading initial data:", error);
        toast({
            variant: "destructive",
            title: "Error Loading Application",
            description: error.message || "Failed to load application data. Please try again.",
        });
        await supabaseRef.current.auth.signOut();
    }
  }, [toast, requestNotificationPermission]);

  useEffect(() => {
    let mounted = true;

    try {
        const savedSettings = localStorage.getItem("themeSettings");
        if (savedSettings) {
            setThemeSettingsState(JSON.parse(savedSettings));
        }
    } catch (error) {
        console.error("Could not load theme settings:", error);
    }

    const { data: { subscription } } = supabaseRef.current.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;

        setSession(session);

        if (session) {
            await fetchInitialData(session);
        } else {
            setLoggedInUser(null);
            setChats([]);
            setAllUsers([]);
            setDmRequests([]);
            setBlockedUsers([]);
        }
        setIsReady(true);
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, [fetchInitialData]);
  
  const handleNewMessage = useCallback(
    async (payload: RealtimePostgresChangesPayload<Message>) => {
      if (!loggedInUser) return

      const newMessage = payload.new as Message;
      const isMyMessage = newMessage.user_id === loggedInUser.id;
      const currentChatId = pathname.split("/chat/")[1];
      const isChatOpen = String(newMessage.chat_id) === currentChatId;
      const isWindowFocused = document.hasFocus();

      // Update chat list for sidebar preview
      setChats((currentChats) => {
        const newChats = currentChats.map((c) => {
          if (c.id === newMessage.chat_id) {
            const shouldIncreaseUnread = !isMyMessage && (!isChatOpen || !isWindowFocused);
            const newUnreadCount = shouldIncreaseUnread ? (c.unreadCount || 0) + 1 : c.unreadCount;

            return {
              ...c,
              last_message_content: newMessage.attachment_url ? newMessage.attachment_metadata?.name || "Sent an attachment" : newMessage.content,
              last_message_timestamp: newMessage.created_at,
              unreadCount: newUnreadCount,
            };
          }
          return c;
        });
        return sortChats(newChats);
      });

      // Show notification if conditions are met
      const shouldShowNotification = !isMyMessage && Notification.permission === "granted" && (!isChatOpen || !isWindowFocused);
      if (shouldShowNotification) {
        const sender = allUsers.find((u) => u.id === newMessage.user_id);
        if (sender) {
          const notification = new Notification(sender.name, {
            body: newMessage.content || (newMessage.attachment_metadata?.name ? `Sent: ${newMessage.attachment_metadata.name}` : "Sent an attachment"),
            icon: sender.avatar_url || "/logo/light_KCS.png",
            tag: `chat-${newMessage.chat_id}`,
          });
          notification.onclick = () => {
            window.focus();
            notification.close();
            router.push(`/chat/${newMessage.chat_id}`);
          };
        }
      }
    },
    [loggedInUser, pathname, allUsers, router],
  );

  useEffect(() => {
    if (!loggedInUser || !session) {
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];
      return;
    }

    const messageChannel = supabaseRef.current.channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        handleNewMessage(payload as any);
      })
      .subscribe();

    const participantChannel = supabaseRef.current.channel('participants-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `user_id=eq.${loggedInUser.id}` }, () => fetchInitialData(session))
      .subscribe();
      
    const dmRequestChannel = supabaseRef.current.channel('dm-requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_requests', filter: `or(from_user_id.eq.${loggedInUser.id},to_user_id.eq.${loggedInUser.id})` }, () => fetchInitialData(session))
      .subscribe();
    
    const blockedUserChannel = supabaseRef.current.channel('blocked-users-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_users', filter: `blocker_id=eq.${loggedInUser.id}` }, () => fetchInitialData(session))
      .subscribe();

    subscriptionsRef.current = [messageChannel, participantChannel, dmRequestChannel, blockedUserChannel];

    return () => {
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, [loggedInUser, session, handleNewMessage, fetchInitialData]);

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
      return sortChats([newChat, ...currentChats])
    })
  }, [])

  const updateUser = useCallback(
    async (updates: Partial<User>) => {
      if (!loggedInUser) return
      const { error } = await supabaseRef.current.from("profiles").update({ name: updates.name, username: updates.username, bio: updates.bio, avatar_url: updates.avatar_url }).eq("id", loggedInUser.id)
      if (error) {
        toast({ variant: "destructive", title: "Error updating profile", description: error.message })
      } else {
        setLoggedInUser(current => ({ ...current!, ...updates }))
      }
    },
    [loggedInUser, toast],
  )

  const leaveGroup = useCallback(async (chatId: number) => {
    if (!loggedInUser) return
    const { error } = await supabaseRef.current.from("participants").delete().match({ chat_id: chatId, user_id: loggedInUser.id })
    if (error) toast({ variant: "destructive", title: "Error leaving group", description: error.message })
  }, [loggedInUser, toast])

  const deleteGroup = useCallback(async (chatId: number) => {
    const { error } = await supabaseRef.current.from("chats").delete().eq("id", chatId)
    if (error) toast({ variant: "destructive", title: "Error deleting group", description: error.message })
  }, [toast])

  const sendDmRequest = useCallback(async (toUserId: string, reason: string) => {
    if (!loggedInUser) return
    const { error } = await supabaseRef.current.from("dm_requests").insert({ from_user_id: loggedInUser.id, to_user_id: toUserId, reason: reason })
    if (error) toast({ variant: "destructive", title: "Error sending request", description: error.message })
    else toast({ title: "Request Sent!" })
  }, [loggedInUser, toast])

  const blockUser = useCallback(async (userId: string) => {
    if (!loggedInUser) return
    const { error } = await supabaseRef.current.from("blocked_users").insert({ blocker_id: loggedInUser.id, blocked_id: userId })
    if (error) toast({ variant: "destructive", title: "Error blocking user", description: error.message })
    else toast({ title: "User Blocked" })
  }, [loggedInUser, toast])

  const unblockUser = useCallback(async (userId: string) => {
    if (!loggedInUser) return
    const { error } = await supabaseRef.current.from("blocked_users").delete().match({ blocker_id: loggedInUser.id, blocked_id: userId })
    if (error) toast({ variant: "destructive", title: "Error unblocking user", description: error.message })
    else toast({ title: "User Unblocked" })
  }, [loggedInUser, toast])

  const reportUser = useCallback(async (reportedUserId: string, reason: string, messageId?: number) => {
    if (!loggedInUser) return
    const { error } = await supabaseRef.current.from("reports").insert({ reported_by: loggedInUser.id, reported_user_id: reportedUserId, reason: reason, message_id: messageId })
    if (error) toast({ variant: "destructive", title: "Error submitting report", description: error.message })
    else toast({ title: "Report Submitted" })
  }, [loggedInUser, toast])

  const forwardMessage = useCallback(async (message: Message, chatIds: number[]) => {
    if (!loggedInUser) return
    const originalSender = allUsers.find(u => u.id === message.user_id)?.name || 'Unknown User';
    const forwardContent = `Forwarded from **${originalSender}**\n${message.content || ''}`;
    const forwardPromises = chatIds.map(chatId => {
        return supabaseRef.current.from('messages').insert({
            chat_id: chatId,
            user_id: loggedInUser.id,
            content: forwardContent,
            attachment_url: message.attachment_url,
            attachment_metadata: message.attachment_metadata
        });
    });
    try {
        await Promise.all(forwardPromises);
        toast({ title: 'Message Forwarded!' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error Forwarding Message', description: error.message });
    }
  }, [loggedInUser, allUsers, toast]);

  const resetUnreadCount = useCallback((chatId: number) => {
    setChats(current => current.map(c => (c.id === chatId && c.unreadCount ? { ...c, unreadCount: 0 } : c)))
  }, [])

  if (!isReady) {
    return <AppLoading />
  }

  const value = {
    loggedInUser, allUsers, chats, dmRequests, blockedUsers,
    sendDmRequest, addChat, updateUser, leaveGroup, deleteGroup,
    blockUser, unblockUser, reportUser, forwardMessage,
    themeSettings, setThemeSettings, isReady, resetUnreadCount,
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
