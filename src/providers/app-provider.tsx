"use client"

import { createContext, useContext, useState, type ReactNode, useEffect, useCallback, useRef } from "react"
import type { 
  User, Chat, ThemeSettings, Message, AppContextType, Relationship, Notification, Post, Comment, Media, Poll 
} from "@/lib" 
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

// --- UPDATED: This query is now specific to avoid ambiguity ---
const POST_QUERY = `
  id,
  user_id,
  content,
  media_urls,
  poll,
  quote_of_id,
  created_at,
  author:user_id (*),
  quote_of:quote_of_id (*, author:user_id (*)),
  comments (
    *,
    author:user_id (*),
    likes:comment_likes (user_id),
    replies:comments!parent_comment_id (
      *,
      author:user_id (*),
      likes:comment_likes (user_id)
    )
  ),
  likes:post_likes (user_id)
`

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

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
    setNotifications([])
    setPosts([])
    subscriptionsRef.current.forEach(sub => sub.unsubscribe())
    subscriptionsRef.current = []
  }, [])

  // --- HELPER: Format posts from DB data ---
  const formatPost = (post: any): Post => {
    // This function ensures the data from DB matches our Post type
    return {
      ...post,
      media_urls: post.media_urls || [],
      likes: (post.likes || []).map((l: any) => l.user_id),
      stats: {
        comments: (post.comments || []).reduce((acc: number, c: any) => acc + 1 + (c.replies?.length || 0), 0),
        likes: (post.likes || []).length,
        reposts: 0, // Placeholder
        quotes: 0,  // Placeholder
        views: 0,   // Placeholder
        bookmarks: 0 // Placeholder
      },
      comments: (post.comments || []).map((comment: any) => ({
        ...comment,
        author: comment.author, // Use 'author' key from query
        likes: (comment.likes || []).length,
        likedBy: (comment.likes || []).map((l: any) => l.user_id),
        replies: (comment.replies || []).map((reply: any) => ({
          ...reply,
          author: reply.author, // Use 'author' key from query
          likes: (reply.likes || []).length,
          likedBy: (reply.likes || []).map((l: any) => l.user_id),
        }))
      })).sort((a: Comment, b: Comment) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      author: post.author, // Use 'author' key from query
      quote_of: post.quote_of_id ? { ...post.quote_of, author: post.quote_of.author } : undefined
    }
  }

  // --- NEW: Fetch Posts Function ---
  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabaseRef.current
      .from('posts')
      .select(POST_QUERY)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      toast({ variant: 'destructive', title: 'Error fetching posts', description: error.message });
    } else {
      setPosts(data.map(formatPost));
    }
  }, [toast]);

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

        const [
            { data: allUsersData },
            { data: relationshipsData },
            { data: participantRecords },
            { data: notificationsData },
            { data: postsData }
        ] = await Promise.all([
            supabaseRef.current.from("profiles").select("*"),
            supabaseRef.current.from("relationships").select("*").or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`),
            supabaseRef.current.from('participants').select('chat_id').eq('user_id', user.id),
            supabaseRef.current.from("notifications").select("*, actor:actor_id(*)").eq("user_id", user.id).order("created_at", { ascending: false }),
            supabaseRef.current.from('posts').select(POST_QUERY).order('created_at', { ascending: false }).limit(50)
        ]);
        
        setAllUsers((allUsersData as User[]) || []);
        setRelationships((relationshipsData as Relationship[]) || []);
        setNotifications((notificationsData as Notification[]) || []);
        setPosts((postsData?.map(formatPost) as Post[]) || []);
        
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
  }, [toast, requestNotificationPermission, fetchPosts]);
  
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
          if(newSession?.user) fetchInitialData(newSession.user);
        }
      }
    );
  
    return () => {
      authListener.subscription.unsubscribe();
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, [fetchInitialData, resetState, router]);


  const handleNewMessage = useCallback(
    async (payload: RealtimePostgresChangesPayload<Message>) => {
      if (!loggedInUser) return;
      const newMessage = payload.new as Message;
      // ... (rest of function is unchanged)
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

    const handleNewNotification = (payload: RealtimePostgresChangesPayload<Notification>) => {
      const newNotificationPayload = payload.new as Notification;
      const actorProfile = allUsers.find(u => u.id === newNotificationPayload.actor_id);
      if (!actorProfile) return;
      const newNotification = { ...newNotificationPayload, actor: actorProfile } as Notification;
      setNotifications(current => [newNotification, ...current]);
      
      let title = 'New Notification';
      let body = 'You have a new update.';

      if (newNotification.type === 'follow_request') {
        title = "New Follow Request";
        body = `${actorProfile.name} (@${actorProfile.username}) wants to follow you.`;
      } else if (newNotification.type === 'new_follower') {
         title = "New Follower";
         body = `${actorProfile.name} (@${actorProfile.username}) started following you.`;
      } else if (newNotification.type === 'new_like') {
         title = "New Like";
         body = `${actorProfile.name} liked your post.`;
      } else if (newNotification.type === 'new_comment') {
         title = "New Comment";
         body = `${actorProfile.name} commented on your post.`;
      }
      
      toast({ title, description: body });
    };

    const handleNewPost = async (payload: RealtimePostgresChangesPayload<Post>) => {
      const { data, error } = await supabaseRef.current
        .from('posts')
        .select(POST_QUERY)
        .eq('id', (payload.new as Post).id)
        .single();
      if (error || !data) return;
      setPosts(current => [formatPost(data), ...current]);
    };

    const handlePostUpdate = async (payload: RealtimePostgresChangesPayload<Post>) => {
      const { data, error } = await supabaseRef.current
        .from('posts')
        .select(POST_QUERY)
        .eq('id', (payload.new as Post).id)
        .single();
      if (error || !data) return;
      const updatedPost = formatPost(data);
      setPosts(current => current.map(p => p.id === updatedPost.id ? updatedPost : p));
    };
    
    const handlePostDelete = (payload: RealtimePostgresChangesPayload<Post>) => {
      const oldPost = payload.old as Partial<Post>;
      if (oldPost.id) {
        setPosts(current => current.filter(p => p.id !== oldPost.id));
      }
    };

    const handleNewLike = (payload: RealtimePostgresChangesPayload<{post_id: number, user_id: string}>) => {
      const newLike = payload.new as {post_id: number, user_id: string};
      setPosts(current => current.map(p => {
        if (p.id === newLike.post_id) {
          const newLikes = [...p.likes, newLike.user_id];
          return { ...p, likes: newLikes, stats: { ...p.stats, likes: newLikes.length } };
        }
        return p;
      }));
    };
    
    const handleRemovedLike = (payload: RealtimePostgresChangesPayload<{post_id: number, user_id: string}>) => {
      const oldLike = payload.old as {post_id: number, user_id: string};
      setPosts(current => current.map(p => {
        if (p.id === oldLike.post_id) {
          const newLikes = p.likes.filter(id => id !== oldLike.user_id);
          return { ...p, likes: newLikes, stats: { ...p.stats, likes: newLikes.length } };
        }
        return p;
      }));
    };
    
    const handleCommentChange = async (payload: RealtimePostgresChangesPayload<Comment>) => {
       const postId = (payload.new as Comment)?.post_id || (payload.old as Partial<Comment>)?.post_id;
       if (!postId) return;
       
       const { data, error } = await supabaseRef.current
        .from('posts')
        .select(POST_QUERY)
        .eq('id', postId)
        .single();
      if (error || !data) return;
      const updatedPost = formatPost(data);
      setPosts(current => current.map(p => p.id === updatedPost.id ? updatedPost : p));
    };

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

      supabaseRef.current.channel('public-notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${loggedInUser.id}` }, 
          (payload) => handleNewNotification(payload as any)
        ),

      supabaseRef.current.channel('public:chats')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats' }, payload => {
            setChats(current => current.map(c => c.id === payload.new.id ? {...c, ...payload.new} : c))
        }),
      
      supabaseRef.current.channel('public-posts')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, handleNewPost)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, handlePostUpdate)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, handlePostDelete),
        
      supabaseRef.current.channel('public-post-likes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_likes' }, handleNewLike)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_likes' }, handleRemovedLike),
        
      supabaseRef.current.channel('public-comments')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, handleCommentChange)
    ];
    
    channels.forEach(c => c.subscribe());
    subscriptionsRef.current = channels;

  }, [loggedInUser, session, handleNewMessage, fetchInitialData, router, allUsers, toast]);
  // --- END OF REALTIME SUBSCRIPTIONS ---
  
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
      const { error } = await supabaseRef.current.from("profiles").update({ 
        name: updates.name, 
        username: updates.username, 
        bio: updates.bio, 
        avatar_url: updates.avatar_url,
        is_private: updates.is_private 
      }).eq("id", loggedInUser.id)
      
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

  const markNotificationsAsRead = useCallback(async () => {
    if (!loggedInUser) return;
    
    setNotifications(current => 
      current.map(n => ({ ...n, is_read: true }))
    );
    
    const { error } = await supabaseRef.current.rpc('mark_all_notifications_as_read');
    
    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Could not mark notifications as read." });
      if (session) await fetchInitialData(session.user);
    }
  }, [loggedInUser, session, fetchInitialData]);

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

  // --- NEW POST FUNCTIONS ---
  const createPost = useCallback(async (content: string, media?: Media[], poll?: Poll) => {
    if (!loggedInUser) return;
    
    const optimisticId = `temp-${Date.now()}`;
    const optimisticPost: Post = {
      id: optimisticId,
      user_id: loggedInUser.id,
      content: content || null,
      media_urls: media || null,
      poll: poll || null,
      quote_of_id: null,
      created_at: new Date().toISOString(),
      author: loggedInUser,
      comments: [],
      likes: [],
      stats: { comments: 0, likes: 0, reposts: 0, quotes: 0, views: 0, bookmarks: 0 },
    };
    
    setPosts(current => [optimisticPost, ...current]);
    
    const { data, error } = await supabaseRef.current.from('posts').insert({
      user_id: loggedInUser.id,
      content: content || null,
      media_urls: media || null,
      poll: poll || null
    }).select(POST_QUERY).single();
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error creating post', description: error.message });
      setPosts(current => current.filter(p => p.id !== optimisticId));
    } else {
      setPosts(current => current.map(p => p.id === optimisticId ? formatPost(data) : p));
      toast({ title: 'Post created!' });
    }
  }, [loggedInUser, toast]);

  const deletePost = useCallback(async (postId: number | string) => {
    if (typeof postId === 'string') return;
    
    const originalPosts = posts;
    setPosts(current => current.filter(p => p.id !== postId));
    
    const { error } = await supabaseRef.current.from('posts').delete().eq('id', postId);
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error deleting post', description: error.message });
      setPosts(originalPosts);
    } else {
      toast({ title: 'Post deleted' });
    }
  }, [posts, toast]);

  const togglePostLike = useCallback(async (postId: number | string) => {
    if (!loggedInUser || typeof postId === 'string') return;
    
    setPosts(current => current.map(p => {
      if (p.id === postId) {
        const isLiked = p.likes.includes(loggedInUser.id);
        const newLikes = isLiked
          ? p.likes.filter(id => id !== loggedInUser.id)
          : [...p.likes, loggedInUser.id];
        return { ...p, likes: newLikes, stats: { ...p.stats, likes: newLikes.length } };
      }
      return p;
    }));
    
    const { error } = await supabaseRef.current.rpc('toggle_post_like', { p_post_id: postId });
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      fetchPosts();
    }
  }, [loggedInUser, toast, fetchPosts]);

  const createComment = useCallback(async (postId: number | string, content: string, parentCommentId?: number | string) => {
    if (!loggedInUser || typeof postId === 'string') return;
    
    const { error } = await supabaseRef.current.from('comments').insert({
      user_id: loggedInUser.id,
      post_id: postId as number,
      content,
      parent_comment_id: parentCommentId as number
    }).select().single();
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error posting comment', description: error.message });
    } else {
      toast({ title: 'Comment posted!' });
    }
  }, [loggedInUser, toast]);

  const toggleCommentLike = useCallback(async (commentId: number | string) => {
    if (!loggedInUser || typeof commentId === 'string') return;
    
    const { error } = await supabaseRef.current.rpc('toggle_comment_like', { p_comment_id: commentId as number });
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  }, [loggedInUser, toast]);
  // --- END NEW POST FUNCTIONS ---

  if (!isReady) {
    return <AppLoading />
  }

  const value = {
    loggedInUser, allUsers, chats, 
    relationships, 
    notifications,
    posts,
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
    
    fetchPosts,
    createPost,
    deletePost,
    togglePostLike,
    createComment,
    toggleCommentLike,
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