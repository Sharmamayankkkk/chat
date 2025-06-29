
"use client"

import { createContext, useContext, useState, type ReactNode, useEffect, useCallback, useMemo, useRef } from "react"
import type { User, Chat, ThemeSettings, Message, DmRequest, AppContextType } from "@/lib/types"
import { createClient } from "@/lib/utils"
import { Icons } from "@/components/icons"
import { useToast } from "@/hooks/use-toast"
import type { Session, RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { usePathname, useRouter } from "next/navigation"

const AppContext = createContext<AppContextType | undefined>(undefined)

// Helper function to sort chats by the most recent message
const sortChats = (chatArray: Chat[]) => {
  return [...chatArray].sort((a, b) => {
    const dateA = a.last_message_timestamp ? new Date(a.last_message_timestamp) : new Date(0);
    const dateB = b.last_message_timestamp ? new Date(b.last_message_timestamp) : new Date(0);
    return dateB.getTime() - dateA.getTime();
  });
};

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
  const [themeSettings, setThemeSettingsState] = useState<ThemeSettings>({
    outgoingBubbleColor: "hsl(221.2 83.2% 53.3%)",
    incomingBubbleColor: "hsl(210 40% 96.1%)",
    usernameColor: "hsl(var(--primary))",
    chatWallpaper: "/chat-bg.png",
    wallpaperBrightness: 100,
  })
  const [isReady, setIsReady] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true);

  const supabaseRef = useRef(createClient());
  const subscriptionsRef = useRef<any[]>([]);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  
  // Use refs for state accessed in callbacks to prevent stale closures
  const allUsersRef = useRef(allUsers);
  useEffect(() => { allUsersRef.current = allUsers }, [allUsers]);
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname }, [pathname]);
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router }, [router]);

  const requestNotificationPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }, []);

  const fetchInitialData = useCallback(async (session: Session) => {
    setIsInitializing(true);
    try {
        const { user } = session;

        // Fetch non-chat-specific data first
        const [
            { data: profile, error: profileError },
            { data: allUsersData, error: usersError },
            { data: dmRequestsData, error: dmError },
            { data: blockedData, error: blockedError },
        ] = await Promise.all([
            supabaseRef.current.from("profiles").select("*").eq("id", user.id).single(),
            supabaseRef.current.from("profiles").select("*"),
            supabaseRef.current.from("dm_requests").select("*, from:profiles!from_user_id(*), to:profiles!to_user_id(*)").or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`),
            supabaseRef.current.from("blocked_users").select("blocked_id").eq("blocker_id", user.id),
        ]);

        if (profileError) throw profileError;

        const fullUserProfile = { ...profile, email: user.email } as User;
        setLoggedInUser(fullUserProfile);
        setAllUsers((allUsersData as User[]) || []);
        setDmRequests((dmRequestsData as DmRequest[]) || []);
        setBlockedUsers(blockedData?.map(b => b.blocked_id) || []);

        // Fetch chats with their participants and last message details
        const { data: chatsData, error: chatListError } = await supabaseRef.current.rpc('get_user_chats_with_details', { p_user_id: user.id });

        if (chatListError) {
          console.error("Error fetching chats with details:", chatListError);
          // Fallback to simpler chat fetching if RPC fails
          const { data: basicChatsData, error: basicChatsError } = await supabaseRef.current
            .from('chats')
            .select('*, participants:participants!chat_id(*, profiles!user_id(*))')
            .in('id', (await supabaseRef.current.from('participants').select('chat_id').eq('user_id', user.id)).data?.map(p => p.chat_id) || []);
            
            if (basicChatsError) throw basicChatsError;
            setChats(sortChats((basicChatsData || []) as any));
        } else {
           setChats(sortChats((chatsData || []) as any));
        }
      
      await requestNotificationPermission();
    } catch (error: any) {
      console.error("Error loading initial data:", error);
      toast({ variant: "destructive", title: "Error loading data", description: error.message });
      await supabaseRef.current.auth.signOut();
    } finally {
      setIsInitializing(false);
      setIsReady(true);
    }
  }, [toast, requestNotificationPermission]);
  
  // Auth state change handler
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("themeSettings");
      if (savedSettings) setThemeSettingsState(JSON.parse(savedSettings));
    } catch (error) { console.error("Could not load theme settings:", error); }

    const { data: { subscription } } = supabaseRef.current.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          await fetchInitialData(session);
        } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
          setLoggedInUser(null);
          setChats([]);
          setAllUsers([]);
          setDmRequests([]);
          setBlockedUsers([]);
          setIsInitializing(false);
          setIsReady(true);
          if (subscriptionsRef.current.length > 0) {
            subscriptionsRef.current.forEach(sub => sub.unsubscribe());
            subscriptionsRef.current = [];
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchInitialData]);

  // Real-time subscriptions for the sidebar and notifications
  useEffect(() => {
    if (!loggedInUser) {
      if (subscriptionsRef.current.length > 0) {
          subscriptionsRef.current.forEach(sub => sub.unsubscribe());
          subscriptionsRef.current = [];
      }
      return;
    };
    
    // Ensure we only have one set of subscriptions running
    if (subscriptionsRef.current.length > 0) return;

    const handleNewMessage = (payload: RealtimePostgresChangesPayload<any>) => {
      const newMessage = payload.new as Message;
      const isMyMessage = newMessage.user_id === loggedInUser.id;
      const isChatOpen = String(newMessage.chat_id) === pathnameRef.current.split("/chat/")[1];

      // Don't handle updates for the currently open chat, as it has its own listener.
      // But do handle our own messages to update the sidebar.
      if (isChatOpen && !isMyMessage) {
        return;
      }

      setChats(currentChats => {
        const newChats = currentChats.map(c => {
          if (c.id === newMessage.chat_id) {
            const shouldIncreaseUnread = !isMyMessage && !isChatOpen;
            return {
              ...c,
              last_message_content: newMessage.attachment_url ? "Sent an attachment" : newMessage.content,
              last_message_timestamp: newMessage.created_at,
              unreadCount: shouldIncreaseUnread ? (c.unreadCount || 0) + 1 : c.unreadCount,
            };
          }
          return c;
        });
        return sortChats(newChats);
      });

      if (!isMyMessage && Notification.permission === "granted") {
        if (!isChatOpen || !document.hasFocus()) {
           const sender = allUsersRef.current.find(u => u.id === newMessage.user_id);
           if (sender) {
             const notification = new Notification(sender.name, {
               body: newMessage.content || "Sent an attachment",
               icon: sender.avatar_url || "/logo/light_KCS.png",
               tag: `chat-${newMessage.chat_id}`
             });
             notification.onclick = () => {
                window.focus();
                notification.close();
                routerRef.current.push(`/chat/${newMessage.chat_id}`);
             }
           }
        }
      }
    };

    const handleParticipantChange = () => {
      if (session) fetchInitialData(session);
    };
    
    const handleDmRequestChange = async () => {
        const { data } = await supabaseRef.current.from("dm_requests").select("*, from:profiles!from_user_id(*), to:profiles!to_user_id(*)").or(`from_user_id.eq.${loggedInUser.id},to_user_id.eq.${loggedInUser.id}`)
        setDmRequests((data as DmRequest[]) || [])
    };
    
    const handleBlockedUserChange = async () => {
        const { data } = await supabaseRef.current.from("blocked_users").select("blocked_id").eq("blocker_id", loggedInUser.id)
        setBlockedUsers(data?.map(b => b.blocked_id) || []);
    };
    
    // Listen to all message inserts user is involved in.
    const chatIds = chats.map(c => c.id).join(',');
    const messagesSub = supabaseRef.current.channel('public:messages:sidebar')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=in.(${chatIds})` }, handleNewMessage)
        .subscribe();

    const participantsSub = supabaseRef.current.channel('public:participants:sidebar').on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `user_id=eq.${loggedInUser.id}` }, handleParticipantChange).subscribe();
    const dmRequestsSub = supabaseRef.current.channel('dm-requests-changes:sidebar').on('postgres_changes', { event: '*', schema: 'public', table: 'dm_requests', filter: `or(from_user_id.eq.${loggedInUser.id},to_user_id.eq.${loggedInUser.id})` }, handleDmRequestChange).subscribe();
    const blockedUsersSub = supabaseRef.current.channel('blocked-users-changes:sidebar').on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_users', filter: `blocker_id=eq.${loggedInUser.id}` }, handleBlockedUserChange).subscribe();

    subscriptionsRef.current = [messagesSub, participantsSub, dmRequestsSub, blockedUsersSub];

    return () => {
        subscriptionsRef.current.forEach(sub => sub.unsubscribe());
        subscriptionsRef.current = [];
    }

  }, [loggedInUser, session, fetchInitialData, chats]);

  const setThemeSettings = useCallback((newSettings: Partial<ThemeSettings>) => {
    setThemeSettingsState((prev) => {
      const updated = { ...prev, ...newSettings }
      try { localStorage.setItem("themeSettings", JSON.stringify(updated)) } catch (e) {}
      return updated
    })
  }, [])

  const addChat = useCallback((newChat: Chat) => {
    setChats(currentChats => {
      if (currentChats.some((c) => c.id === newChat.id)) return currentChats
      return sortChats([newChat, ...currentChats]);
    })
  }, [])

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!loggedInUser) return;
    const { error } = await supabaseRef.current.from("profiles").update({ name: updates.name, username: updates.username, bio: updates.bio, avatar_url: updates.avatar_url }).eq("id", loggedInUser.id);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else setLoggedInUser(current => ({ ...current!, ...updates }));
  }, [loggedInUser, toast]);

  const leaveGroup = useCallback(async (chatId: number) => {
    if (!loggedInUser) return;
    const { error } = await supabaseRef.current.from("participants").delete().match({ chat_id: chatId, user_id: loggedInUser.id });
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
  }, [loggedInUser, toast]);

  const deleteGroup = useCallback(async (chatId: number) => {
    const { error } = await supabaseRef.current.from("chats").delete().eq("id", chatId);
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
  }, [toast]);

  const sendDmRequest = useCallback(async (toUserId: string, reason: string) => {
    if (!loggedInUser) return;
    const { error } = await supabaseRef.current.from("dm_requests").insert({ from_user_id: loggedInUser.id, to_user_id: toUserId, reason });
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else toast({ title: "Request Sent" });
  }, [loggedInUser, toast]);

  const blockUser = useCallback(async (userId: string) => {
    if (!loggedInUser) return;
    const { error } = await supabaseRef.current.from("blocked_users").insert({ blocker_id: loggedInUser.id, blocked_id: userId });
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else toast({ title: 'User Blocked' });
  }, [loggedInUser, toast]);

  const unblockUser = useCallback(async (userId: string) => {
    if (!loggedInUser) return;
    const { error } = await supabaseRef.current.from("blocked_users").delete().match({ blocker_id: loggedInUser.id, blocked_id: userId });
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else toast({ title: 'User Unblocked' });
  }, [loggedInUser, toast]);

  const reportUser = useCallback(async (reportedUserId: string, reason: string, messageId?: number) => {
    if (!loggedInUser) return;
    const { error } = await supabaseRef.current.from('reports').insert({ reported_by: loggedInUser.id, reported_user_id: reportedUserId, reason, message_id: messageId });
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else toast({ title: 'Report Submitted' });
  }, [loggedInUser, toast]);

  const forwardMessage = useCallback(async (message: Message, chatIds: number[]) => {
      if (!loggedInUser) return;
      const originalSender = allUsersRef.current.find(u => u.id === message.user_id)?.name || 'Unknown User';
      const forwardContent = `Forwarded from **${originalSender}**\n${message.content || ''}`;
      const forwardPromises = chatIds.map(chatId => supabaseRef.current.from('messages').insert({ chat_id: chatId, user_id: loggedInUser.id, content: forwardContent, attachment_url: message.attachment_url, attachment_metadata: message.attachment_metadata }));
      const results = await Promise.all(forwardPromises);
      if (results.some(r => r.error)) toast({ variant: 'destructive', title: 'Error forwarding' });
      else toast({ title: 'Message Forwarded' });
  }, [loggedInUser, toast]);

  const resetUnreadCount = useCallback((chatId: number) => {
    setChats(current => current.map(c => (c.id === chatId ? { ...c, unreadCount: 0 } : c)));
    // Also mark as read in DB
    supabaseRef.current.rpc('mark_chat_as_read', { p_chat_id: chatId, p_user_id: loggedInUser?.id }).then(({error}) => {
        if(error) console.error("Failed to mark chat as read:", error);
    });
  }, [loggedInUser]);

  if (isInitializing) {
    return <AppLoading />;
  }

  const value = {
    loggedInUser, allUsers, chats, dmRequests, blockedUsers, sendDmRequest, addChat, updateUser, leaveGroup, deleteGroup, blockUser, unblockUser, reportUser, forwardMessage, themeSettings, setThemeSettings, isReady, resetUnreadCount,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) { throw new Error("useAppContext must be used within an AppProvider") }
  return context;
}
