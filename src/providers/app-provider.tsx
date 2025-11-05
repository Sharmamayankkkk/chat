"use client"

import { createContext, useContext, useState, type ReactNode, useEffect, useCallback, useRef } from "react"
// We've removed DmRequest and updated the types import
import type { User, Chat, ThemeSettings, Message, AppContextType, Relationship } from "@/lib/" 
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
  
  // --- STATE CHANGES ---
  // Removed dmRequests and blockedUsers state
  const [relationships, setRelationships] = useState<Relationship[]>([])
  // --- END OF STATE CHANGES ---

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
  
  // --- RESET STATE UPDATED ---
  const resetState = useCallback(() => {
    setSession(null); // Added this to clear session on reset
    setLoggedInUser(null)
    setChats([])
    setAllUsers([])
    setRelationships([]) // Updated
    subscriptionsRef.current.forEach(sub => sub.unsubscribe())
    subscriptionsRef.current = []
  }, [])
  // --- END OF RESET STATE ---

  // --- FETCH INITIAL DATA UPDATED ---
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
            setThemeSettingsState(current => ({...current, ...parsedTheme}));
          } catch(e) {
            console.error("Failed to parse theme settings from localStorage", e);
          }
        }
        setLoggedInUser(fullUserProfile);

        // Updated Promise.all to fetch relationships instead of dm_requests and blocked_users
        const [
            { data: allUsersData },
            { data: relationshipsData }, // Changed
            { data: participantRecords }
        ] = await Promise.all([
            supabaseRef.current.from("profiles").select("*"),
            // Fetches all relationships (follows, pending, blocks) involving this user
            supabaseRef.current.from("relationships").select("*").or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`), // Changed
            supabaseRef.current.from('participants').select('chat_id').eq('user_id', user.id)
        ]);
        
        setAllUsers((allUsersData as User[]) || []);
        setRelationships((relationshipsData as Relationship[]) || []); // Changed
        
        // This chat-fetching logic remains the same
        const chatIds = participantRecords?.map(p => p.chat_id) || [];
        if (chatIds.length > 0) {
            const { data: chatsData } = await supabaseRef.current
                .from('chats')
                .select('*, participants:participants!chat_id(*, profiles!user_id(*))')
                .in('id', chatIds);
            
            const initialChats = (chatsData || []).map(c => ({...c, messages: [], unreadCount: 0})) as Chat[];
            
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
  // --- END OF FETCH INITIAL DATA ---
  
  // This useEffect remains largely the same
  useEffect(() => {
    // This effect runs once on initial mount to check for a session
    const initializeApp = async () => {
        const { data: { session: currentSession } } = await supabaseRef.current.auth.getSession();
        
        if (currentSession) {
            setSession(currentSession);
            await fetchInitialData(currentSession.user);
        }
        
        // Mark the app as ready only after the initial check is complete.
        setIsReady(true);
    };
    
    initializeApp();

    // This listener only handles live auth events (login/logout) after the app is running.
    const { data: authListener } = supabaseRef.current.auth.onAuthStateChange(
      (event, newSession) => {
        if (event === "SIGNED_OUT") {
          resetState();
          router.push('/login');
        } else if (event === "SIGNED_IN") {
          setSession(newSession);
          if(newSession?.user) fetchInitialData(newSession.user);
        }
      }
    );
  
    return () => {
      authListener.subscription.unsubscribe();
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchInitialData, resetState, router]);


  // This (handleNewMessage) remains unchanged
  const handleNewMessage = useCallback(
    async (payload: RealtimePostgresChangesPayload<Message>) => {
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

    const channels = [
      supabaseRef.current.channel('public-messages-notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => handleNewMessage(payload as any)),
      
      supabaseRef.current.channel('participants-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `user_id=eq.${loggedInUser.id}` }, async () => {
          if (session) await fetchInitialData(session.user);
        }),
      
      // NEW: Listen for changes to relationships
      supabaseRef.current.channel('relationships-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'relationships', filter: `or(user_one_id.eq.${loggedInUser.id},user_two_id.eq.${loggedInUser.id})` }, async () => {
            if (session) await fetchInitialData(session.user);
            router.refresh(); // Force refresh profile pages
        }),
      
      // REMOVED: dm-requests-changes
      // REMOVED: blocked-users-changes

      supabaseRef.current.channel('public:chats')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats' }, payload => {
            setChats(current => current.map(c => c.id === payload.new.id ? {...c, ...payload.new} : c))
        })
    ];
    
    channels.forEach(c => c.subscribe());
    subscriptionsRef.current = channels;

  }, [loggedInUser, session, handleNewMessage, fetchInitialData, router]);
  // --- END OF REALTIME SUBSCRIPTIONS ---

  // These functions (setThemeSettings, addChat, updateUser, leaveGroup, deleteGroup) remain the same
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
      const { error } = await supabaseRef.current.from("profiles").update({ name: updates.name, username: updates.username, bio: updates.bio, avatar_url: updates.avatar_url }).eq("id", loggedInUser.id)
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

  // --- REMOVED FUNCTIONS ---
  // const sendDmRequest = ... (REMOVED)
  // const reportUser = ... (REMOVED)
  // --- END OF REMOVED FUNCTIONS ---


  // --- NEW SOCIAL/RELATIONSHIP FUNCTIONS ---
  const followUser = useCallback(async (targetId: string) => {
    if (!loggedInUser) return;
    const { data, error } = await supabaseRef.current.rpc('request_follow', { target_user_id: targetId });
    if (error) {
      toast({ variant: "destructive", title: "Error sending request", description: error.message });
    } else {
      // The RPC returns { status: 'pending' | 'approved' }
      toast({ title: (data as any).status === 'pending' ? "Follow request sent!" : "Followed!" });
      // Realtime subscription will handle updating the state
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
    // We just delete the pending request.
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
  // --- END OF NEW FUNCTIONS ---


  // This (forwardMessage) remains unchanged
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

  // This (resetUnreadCount) remains unchanged
  const resetUnreadCount = useCallback((chatId: number) => {
    setChats(current => current.map(c => (c.id === chatId && c.unreadCount ? { ...c, unreadCount: 0 } : c)))
  }, []);

  if (!isReady) {
    return <AppLoading />
  }

  // --- CONTEXT VALUE UPDATED ---
  // This is the part that fixes your error
  const value = {
    loggedInUser, allUsers, chats, 
    relationships, 
    addChat, updateUser, leaveGroup, deleteGroup,
    forwardMessage,
    themeSettings, setThemeSettings, isReady, resetUnreadCount,
    
    // All the functions are now correctly defined above and passed in here
    followUser,
    approveFollow,
    rejectFollow,
    unfollowUser,
    removeFollower,
    blockUser,
    unblockUser,
  }
  // --- END OF CONTEXT VALUE ---

  return <AppContext.Provider value={value as any}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider")
  }
  return context
}