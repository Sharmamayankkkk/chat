"use client"

import { createContext, useContext, useState, type ReactNode, useEffect, useCallback, useRef } from "react"
// Import our new types
import type { User, Chat, ThemeSettings, Message, AppContextType, Relationship, Notification } from "@/lib"
import { createClient } from "@/lib/utils"
import { Icons } from "@/components/icons"
import { useToast } from "@/hooks/use-toast"
import type { Session, RealtimePostgresChangesPayload, User as AuthUser } from "@supabase/supabase-js"
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
        <p className="text-sm text-muted-foreground animate-pulse">Connecting to Krishna...</p>
      </div>
    </div>
  )
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [isReady, setIsReady] = useState(false)
  const [relationships, setRelationships] = useState<Relationship[]>([])

  // --- NEW NOTIFICATION STATE ---
  const [notifications, setNotifications] = useState<Notification[]>([]);
  // --- END ---

  const [themeSettings, setThemeSettingsState] = useState<ThemeSettings>({
    outgoingBubbleColor: "hsl(221.2 83.2% 53.3%)",
    incomingBubbleColor: "hsl(210 40% 96.1%)",
    usernameColor: "hsl(var(--primary))",
    chatWallpaper: "/chat-bg.png",
    wallpaperBrightness: 100,
  })

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

  const resetState = useCallback(() => {
    setSession(null);
    setLoggedInUser(null)
    setChats([])
    setAllUsers([])
    setRelationships([])
    setNotifications([]) // <-- ADDED
    subscriptionsRef.current.forEach(sub => sub.unsubscribe())
    subscriptionsRef.current = []
  }, [])

  const fetchInitialData = useCallback(async (user: AuthUser) => {
    try {
      const { data: profile, error: profileError } = await supabaseRef.current
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        console.error("Failed to fetch profile:", profileError);
        toast({ variant: "destructive", title: "Authentication Error", description: "Could not fetch your profile. Please log in again." });
        await supabaseRef.current.auth.signOut();
        return;
      }

      const fullUserProfile = { ...profile, email: user.email } as User;
      const savedTheme = localStorage.getItem('themeSettings');
      if (savedTheme) {
        try {
          const parsedTheme = JSON.parse(savedTheme);
          setThemeSettingsState(current => ({ ...current, ...parsedTheme }));
        } catch (e) {
          console.error("Failed to parse theme settings from localStorage", e);
        }
      }
      setLoggedInUser(fullUserProfile);

      // --- UPDATED Promise.all to fetch notifications ---
      const [
        { data: allUsersData },
        { data: relationshipsData },
        { data: participantRecords },
        { data: notificationsData } // <-- ADDED
      ] = await Promise.all([
        supabaseRef.current.from("profiles").select("*"),
        supabaseRef.current.from("relationships").select("*").or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`),
        supabaseRef.current.from('participants').select('chat_id').eq('user_id', user.id),
        // Fetches notifications AND the profile of the user who triggered it (the "actor")
        supabaseRef.current.from("notifications").select("*, actor:actor_id(*)").eq("user_id", user.id).order("created_at", { ascending: false }) // <-- ADDED
      ]);

      setAllUsers((allUsersData as User[]) || []);
      setRelationships((relationshipsData as Relationship[]) || []);
      setNotifications((notificationsData as Notification[]) || []); // <-- ADDED
      // --- END OF UPDATE ---

      const chatIds = participantRecords?.map(p => p.chat_id) || [];
      if (chatIds.length > 0) {
        const { data: chatsData } = await supabaseRef.current
          .from('chats')
          .select('*, participants:participants!chat_id(*, profiles!user_id(*))')
          .in('id', chatIds);

        const initialChats = (chatsData || []).map(c => ({ ...c, messages: [], unreadCount: 0 })) as Chat[];

        const { data: lastMessages } = await supabaseRef.current.rpc('get_last_messages_for_chats', { p_chat_ids: chatIds });
        if (lastMessages) {
          const chatsMap = new Map(initialChats.map(c => [c.id, c]));
          (lastMessages as any[]).forEach(msg => {
            const chat = chatsMap.get(msg.chat_id);
            if (chat) {
              chat.last_message_content = msg.content || msg.attachment_metadata?.name || 'No messages yet';
              chat.last_message_timestamp = msg.created_at;
            }
          });
          setChats(sortChats(Array.from(chatsMap.values())));
        } else {
          setChats(sortChats(initialChats));
        }
      }
      await requestNotificationPermission();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error Loading Data",
        description: error.message || "Failed to load application data. Please try again.",
      });
      await supabaseRef.current.auth.signOut();
    }
  }, [toast, requestNotificationPermission]);

  useEffect(() => {
    const initializeApp = async () => {
      const { data: { session: currentSession } } = await supabaseRef.current.auth.getSession();

      if (currentSession) {
        setSession(currentSession);
        await fetchInitialData(currentSession.user);
      }

      setIsReady(true);
    };

    initializeApp();

    const { data: authListener } = supabaseRef.current.auth.onAuthStateChange(
      (event, newSession) => {
        if (event === "SIGNED_OUT") {
          resetState();
          router.push('/login');
        } else if (event === "SIGNED_IN") {
          setSession(newSession);
          if (newSession?.user) fetchInitialData(newSession.user);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // We removed fetchInitialData, resetState, router from deps to match original

  const handleNewMessage = useCallback(
    async (payload: RealtimePostgresChangesPayload<Message>) => {
      // ... (this function is unchanged)
      if (!loggedInUser) return;

      const newMessage = payload.new as Message;
      const isMyMessage = newMessage.user_id === loggedInUser.id;
      const currentChatId = pathname.split("/chat/")[1];
      const isChatOpen = String(newMessage.chat_id) === currentChatId;
      const isWindowFocused = document.hasFocus();

      setChats((currentChats) => {
        const newChats = currentChats.map((c) => {
          if (c.id === newMessage.chat_id) {
            const shouldIncreaseUnread = !isMyMessage && (!isChatOpen || !isWindowFocused);
            const newUnreadCount = shouldIncreaseUnread ? (c.unreadCount || 0) + 1 : (c.unreadCount || 0);

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

      const shouldShowNotification = !isMyMessage && Notification.permission === "granted" && (!isChatOpen || !isWindowFocused);

      if (shouldShowNotification) {
        const sender = allUsers.find((u) => u.id === newMessage.user_id);
        if (sender) {
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.getRegistration().then(reg => {
              if (reg) {
                reg.showNotification(sender.name, {
                  body: newMessage.content || (newMessage.attachment_metadata?.name ? `Sent: ${newMessage.attachment_metadata.name}` : "Sent an attachment"),
                  icon: sender.avatar_url || "/logo/light_KCS.png",
                  tag: `chat-${newMessage.chat_id}`,
                  data: { chatId: newMessage.chat_id }
                });
              }
            });
          }
        }
      }
    },
    [loggedInUser, pathname, allUsers]
  );

  // --- REALTIME SUBSCRIPTIONS UPDATED ---
  useEffect(() => {
    if (!loggedInUser || subscriptionsRef.current.length > 0) {
      return;
    }

    // --- NEW: Handle incoming notifications in real-time ---
    const handleNewNotification = (payload: RealtimePostgresChangesPayload<Notification>) => {
      // We need to get the "actor" profile, which isn't in the payload
      const newNotificationPayload = payload.new as Notification;
      const actorProfile = allUsers.find(u => u.id === newNotificationPayload.actor_id);
      if (!actorProfile) return;

      const newNotification = { ...newNotificationPayload, actor: actorProfile } as Notification;

      setNotifications(current => [newNotification, ...current]);

      // Show a toast
      toast({
        title: "New Follow Request",
        description: `${actorProfile.name} (@${actorProfile.username}) wants to follow you.`,
      });
    };
    // --- END ---

    const channels = [
      supabaseRef.current.channel('public-messages-notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => handleNewMessage(payload as any)),

      supabaseRef.current.channel('participants-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `user_id=eq.${loggedInUser.id}` }, async () => {
          if (session) await fetchInitialData(session.user);
        }),

      supabaseRef.current.channel('relationships-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'relationships', filter: `or(user_one_id.eq.${loggedInUser.id},user_two_id.eq.${loggedInUser.id})` }, async () => {
          if (session) await fetchInitialData(session.user);
          router.refresh();
        }),

      // --- ADDED: Notifications channel ---
      supabaseRef.current.channel('public-notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${loggedInUser.id}` },
          (payload) => handleNewNotification(payload as any)
        ),
      // --- END ---

      supabaseRef.current.channel('public:chats')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats' }, payload => {
          setChats(current => current.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c))
        })
    ];

    channels.forEach(c => c.subscribe());
    subscriptionsRef.current = channels;

  }, [loggedInUser, session, handleNewMessage, fetchInitialData, router, allUsers, toast]);
  // --- END OF REALTIME SUBSCRIPTIONS ---

  // All functions from here down are correct and provided

  const setThemeSettings = useCallback(async (newSettings: Partial<ThemeSettings>) => {
    if (!loggedInUser) return;
    const updatedSettings = { ...themeSettings, ...newSettings };
    setThemeSettingsState(updatedSettings);
    localStorage.setItem('themeSettings', JSON.stringify(updatedSettings));
    toast({ title: 'Theme settings updated locally.' });
  }, [loggedInUser, themeSettings, toast]);

  const addChat = useCallback((newChat: Chat) => {
    setChats((currentChats) => {
      if (currentChats.some((c) => c.id === newChat.id)) return currentChats
      return sortChats([newChat, ...currentChats])
    })
  }, [])

  const updateUser = useCallback(
    async (updates: Partial<User>) => {
      if (!loggedInUser) return
      // --- FIX: Ensure is_private is passed correctly ---
      const { error } = await supabaseRef.current.from("profiles").update({
        name: updates.name,
        username: updates.username,
        bio: updates.bio,
        avatar_url: updates.avatar_url,
        is_private: updates.is_private // Make sure this is included
      }).eq("id", loggedInUser.id)
      // --- END FIX ---

      if (error) {
        toast({ variant: "destructive", title: "Error updating profile", description: error.message });
      } else {
        setLoggedInUser(current => ({ ...current!, ...updates }));
        setAllUsers(current => current.map(u => u.id === loggedInUser.id ? { ...u, ...updates } : u));
      }
    },
    [loggedInUser, toast],
  )

  const leaveGroup = useCallback(async (chatId: number) => {
    if (!loggedInUser) return;
    const { error } = await supabaseRef.current.from("participants").delete().match({ chat_id: chatId, user_id: loggedInUser.id })
    if (error) {
      toast({ variant: "destructive", title: "Error leaving group", description: error.message })
    } else {
      setChats(current => current.filter(c => c.id !== chatId));
    }
  }, [loggedInUser, toast])

  const deleteGroup = useCallback(async (chatId: number) => {
    const { error } = await supabaseRef.current.from("chats").delete().eq("id", chatId)
    if (error) {
      toast({ variant: "destructive", title: "Error deleting group", description: error.message })
    } else {
      setChats(current => current.filter(c => c.id !== chatId));
    }
  }, [toast])

  const followUser = useCallback(async (targetId: string) => {
    if (!loggedInUser) return;
    const { data, error } = await supabaseRef.current.rpc('request_follow', { target_user_id: targetId });
    if (error) {
      toast({ variant: "destructive", title: "Error sending request", description: error.message });
    } else {
      toast({ title: (data as any).status === 'pending' ? "Follow request sent!" : "Followed!" });
    }
  }, [loggedInUser, toast]);

  const approveFollow = useCallback(async (requestorId: string) => {
    if (!loggedInUser) return;
    const { error } = await supabaseRef.current.rpc('approve_follow', { requestor_user_id: requestorId });
    if (error) {
      toast({ variant: "destructive", title: "Error approving request", description: error.message });
    } else {
      toast({ title: "Follow request approved!" });
    }
  }, [loggedInUser, toast]);

  const rejectFollow = useCallback(async (requestorId: string) => {
    if (!loggedInUser) return;
    const { error } = await supabaseRef.current.from('relationships').delete()
      .match({ user_one_id: requestorId, user_two_id: loggedInUser.id, status: 'pending' });

    if (error) {
      toast({ variant: "destructive", title: "Error rejecting request", description: error.message });
    } else {
      toast({ title: "Request rejected" });
    }
  }, [loggedInUser, toast]);

  const unfollowUser = useCallback(async (targetId: string) => {
    if (!loggedInUser) return;
    const { error } = await supabaseRef.current.rpc('unfollow_user', { target_user_id: targetId });
    if (error) {
      toast({ variant: "destructive", title: "Error unfollowing", description: error.message });
    } else {
      toast({ title: "Unfollowed" });
    }
  }, [loggedInUser, toast]);

  const removeFollower = useCallback(async (targetId: string) => {
    if (!loggedInUser) return;
    const { error } = await supabaseRef.current.rpc('remove_follower', { target_user_id: targetId });
    if (error) {
      toast({ variant: "destructive", title: "Error removing follower", description: error.message });
    } else {
      toast({ title: "Follower removed" });
    }
  }, [loggedInUser, toast]);

  const blockUser = useCallback(async (targetId: string) => {
    if (!loggedInUser) return;
    const { error } = await supabaseRef.current.rpc('block_user', { target_user_id: targetId });
    if (error) {
      toast({ variant: "destructive", title: "Error blocking user", description: error.message });
    } else {
      toast({ title: "User Blocked" });
    }
  }, [loggedInUser, toast]);

  const unblockUser = useCallback(async (targetId: string) => {
    if (!loggedInUser) return;
    const { error } = await supabaseRef.current.rpc('unblock_user', { target_user_id: targetId });
    if (error) {
      toast({ variant: "destructive", title: "Error unblocking user", description: error.message });
    } else {
      toast({ title: "User Unblocked" });
    }
  }, [loggedInUser, toast]);

  // --- NEW: Mark Notifications as Read function ---
  const markNotificationsAsRead = useCallback(async () => {
    if (!loggedInUser) return;

    // Optimistically update the UI
    setNotifications(current =>
      current.map(n => ({ ...n, is_read: true }))
    );

    // Call the RPC
    const { error } = await supabaseRef.current.rpc('mark_all_notifications_as_read');

    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not mark notifications as read." });
      // Re-fetch to correct UI if error
      if (session) await fetchInitialData(session.user);
    }
  }, [loggedInUser, session]); // Removed fetchInitialData from deps, added session
  // --- END ---

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
        attachment_metadata: message.attachment_metadata,
      });
    });

    try {
      const results = await Promise.all(forwardPromises);
      const failed = results.filter(r => r.error);
      if (failed.length > 0) {
        toast({ variant: 'destructive', title: 'Some shares failed' });
      } else {
        toast({ title: 'Message Forwarded!' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error Forwarding Message', description: error.message });
    }
  }, [loggedInUser, allUsers, toast]);

  const resetUnreadCount = useCallback((chatId: number) => {
    setChats(current => current.map(c => (c.id === chatId && c.unreadCount ? { ...c, unreadCount: 0 } : c)))
  }, []);

  if (!isReady) {
    return <AppLoading />
  }

  const value = {
    loggedInUser, allUsers, chats,
    relationships,
    notifications, // <-- ADDED
    addChat, updateUser, leaveGroup, deleteGroup,
    forwardMessage,
    themeSettings, setThemeSettings, isReady, resetUnreadCount,

    followUser,
    approveFollow,
    rejectFollow,
    unfollowUser,
    removeFollower,
    blockUser,
    unblockUser,
    markNotificationsAsRead,
  }

  return <AppContext.Provider value={value as any}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider")
  }
  return context
}