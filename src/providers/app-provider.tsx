
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
      const [
        { data: profile, error: profileError },
        { data: allUsersData, error: usersError },
        { data: dmRequestsData, error: dmError },
        { data: blockedData, error: blockedError },
        { data: chatParticipants, error: participantError },
      ] = await Promise.all([
        supabaseRef.current.from("profiles").select("*").eq("id", user.id).single(),
        supabaseRef.current.from("profiles").select("*"),
        supabaseRef.current.from("dm_requests").select("*, from:profiles!from_user_id(*), to:profiles!to_user_id(*)").or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`),
        supabaseRef.current.from("blocked_users").select("blocked_user_id").eq("user_id", user.id),
        supabaseRef.current.from("participants").select("chat_id").eq("user_id", user.id),
      ]);

      if (profileError) throw profileError;

      const fullUserProfile = { ...profile, email: user.email } as User;
      setLoggedInUser(fullUserProfile);
      setAllUsers((allUsersData as User[]) || []);
      setDmRequests((dmRequestsData as DmRequest[]) || []);
      setBlockedUsers(blockedData?.map(b => b.blocked_user_id) || []);
      
      const chatIds = chatParticipants?.map(p => p.chat_id) || [];
      if (chatIds.length > 0) {
        const { data: chatsData, error: chatListError } = await supabaseRef.current
          .rpc('get_chats_with_unread_counts', { p_user_id: user.id });

        if (!chatListError) {
          const mappedChats = (chatsData || []).map((chat: any) => ({
            ...chat,
            participants: chat.participants_data, // Use the pre-joined participant data
            messages: [],
            unreadCount: chat.unread_count,
            last_message_content: chat.last_message_content,
            last_message_timestamp: chat.last_message_timestamp,
          }));
          setChats(sortChats(mappedChats as any));
        }
      } else {
        setChats([]);
      }
      
      await requestNotificationPermission();
    } catch (error: any) {
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

  // Real-time subscriptions
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

      setChats(currentChats => {
        let chatExists = false;
        const newChats = currentChats.map(c => {
          if (c.id === newMessage.chat_id) {
            chatExists = true;
            const isChatOpen = String(newMessage.chat_id) === pathnameRef.current.split("/chat/")[1];
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
        // If the chat doesn't exist, it means we were just added.
        // A full refetch is triggered by the participants subscription, so we don't need to handle it here.
        return chatExists ? sortChats(newChats) : currentChats;
      });

      if (!isMyMessage && Notification.permission === "granted") {
        const isChatOpen = String(newMessage.chat_id) === pathnameRef.current.split("/chat/")[1];
        if (!isChatOpen || !document.hasFocus()) {
           const sender = allUsersRef.current.find(u => u.id === newMessage.user_id);
           if (sender) {
             const notification = new Notification(sender.name, {
               body: newMessage.content || "Sent an attachment",
               icon: sender.avatar_url || "/logo/light_KCS.png",
               tag: `chat-${newMessage.chat_id}`
             });
             notification.onclick = () => routerRef.current.push(`/chat/${newMessage.chat_id}`);
           }
        }
      }
    };

    const handleParticipantChange = () => {
      // Re-fetch all data if our participation in any chat changes.
      if (session) fetchInitialData(session);
    };
    
    const handleDmRequestChange = async () => {
        const { data } = await supabaseRef.current.from("dm_requests").select("*, from:profiles!from_user_id(*), to:profiles!to_user_id(*)").or(`from_user_id.eq.${loggedInUser.id},to_user_id.eq.${loggedInUser.id}`)
        setDmRequests((data as DmRequest[]) || [])
    };
    
    const handleBlockedUserChange = async () => {
        const { data } = await supabaseRef.current.from("blocked_users").select("blocked_user_id").eq("user_id", loggedInUser.id)
        setBlockedUsers(data?.map(b => b.blocked_user_id) || []);
    };
    
    const messagesSub = supabaseRef.current.channel('public:messages').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, handleNewMessage).subscribe();
    const participantsSub = supabaseRef.current.channel('public:participants').on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `user_id=eq.${loggedInUser.id}` }, handleParticipantChange).subscribe();
    const dmRequestsSub = supabaseRef.current.channel('dm-requests-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'dm_requests', filter: `or(from_user_id.eq.${loggedInUser.id},to_user_id.eq.${loggedInUser.id})` }, handleDmRequestChange).subscribe();
    const blockedUsersSub = supabaseRef.current.channel('blocked-users-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_users', filter: `user_id.eq.${loggedInUser.id}` }, handleBlockedUserChange).subscribe();

    subscriptionsRef.current = [messagesSub, participantsSub, dmRequestsSub, blockedUsersSub];

  }, [loggedInUser, session, fetchInitialData]);

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
    const { error } = await supabaseRef.current.from("blocked_users").insert({ user_id: loggedInUser.id, blocked_user_id: userId });
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else toast({ title: 'User Blocked' });
  }, [loggedInUser, toast]);

  const unblockUser = useCallback(async (userId: string) => {
    if (!loggedInUser) return;
    const { error } = await supabaseRef.current.from("blocked_users").delete().match({ user_id: loggedInUser.id, blocked_user_id: userId });
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
  }, []);

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
