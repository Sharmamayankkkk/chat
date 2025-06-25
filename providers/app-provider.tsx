
'use client'

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react'
import type { User, Chat, ThemeSettings, Message, DmRequest } from '@/lib/types'
import { createClient } from '@/lib/utils'
import { Icons } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import type { Session, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { usePathname, useRouter } from 'next/navigation';

interface AppContextType {
  loggedInUser: User | null
  allUsers: User[]
  chats: Chat[]
  dmRequests: DmRequest[]
  sendDmRequest: (toUserId: string, reason: string) => Promise<void>
  addChat: (newChat: Chat) => void;
  updateUser: (updates: Partial<User>) => Promise<void>;
  leaveGroup: (chatId: number) => Promise<void>;
  deleteGroup: (chatId: number) => Promise<void>;
  themeSettings: ThemeSettings;
  setThemeSettings: (newSettings: Partial<ThemeSettings>) => void;
  isReady: boolean
  resetUnreadCount: (chatId: number) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined)

function AppLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Icons.logo className="h-16 w-16 animate-pulse text-primary" />
    </div>
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [dmRequests, setDmRequests] = useState<DmRequest[]>([]);
  const [themeSettings, setThemeSettingsState] = useState<ThemeSettings>({
    outgoingBubbleColor: 'hsl(221.2 83.2% 53.3%)',
    incomingBubbleColor: 'hsl(210 40% 96.1%)',
    usernameColor: 'hsl(var(--primary))',
    chatWallpaper: '/chat-bg.png',
    wallpaperBrightness: 100,
  });
  const [isReady, setIsReady] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const fetchInitialData = useCallback(async (session: Session) => {
    const { user } = session;

    // --- Start fetching data in parallel ---
    const profilePromise = supabase.from('profiles').select('*').eq('id', user.id).single();
    const allUsersPromise = supabase.from('profiles').select('*');
    const dmRequestsPromise = supabase.from('dm_requests').select('*, from:profiles!from_user_id(*), to:profiles!to_user_id(*)').or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
    const unreadCountsPromise = supabase.rpc('get_unread_counts', { p_user_id: user.id });
    const chatParticipantsPromise = supabase.from('participants').select('chat_id').eq('user_id', user.id);

    const [
      { data: profile, error: profileError },
      { data: allUsersData },
      { data: dmRequestsData },
      { data: unreadData, error: unreadError },
      { data: chatParticipants, error: participantError }
    ] = await Promise.all([
      profilePromise,
      allUsersPromise,
      dmRequestsPromise,
      unreadCountsPromise,
      chatParticipantsPromise,
    ]);
    // --- All parallel fetches are complete ---

    if (profileError || !profile) {
      console.error("Error fetching profile, signing out:", profileError);
      await supabase.auth.signOut();
      throw new Error("Could not fetch user profile.");
    }
    if (participantError) {
      throw new Error("Could not fetch user's chats.");
    }
    if (unreadError) {
      console.error("Failed to get unread counts:", unreadError);
    }
    
    // Set state for data that is ready
    const fullUserProfile = { ...profile, email: user.email } as User;
    setLoggedInUser(fullUserProfile);
    setAllUsers(allUsersData as User[] || []);
    setDmRequests(dmRequestsData as DmRequest[] || []);

    // Now, fetch chats based on the participant data
    const chatIds = chatParticipants?.map(p => p.chat_id) || [];
    let chatsData: any[] = [];
    if (chatIds.length > 0) {
      const { data, error: chatListError } = await supabase
        .from('chats')
        .select(`*, participants:participants!chat_id(*, profiles!user_id(*))`)
        .in('id', chatIds);

      if (chatListError) {
        throw new Error("Could not fetch chat list.");
      }
      chatsData = data || [];
    }
    
    // Map unread counts to chats
    const unreadMap = new Map<number, number>();
    if (unreadData) {
      (unreadData as any[]).forEach((item: any) => {
        unreadMap.set(item.chat_id_result, item.unread_count_result);
      });
    }

    const mappedChats = chatsData.map(chat => ({
      ...chat,
      messages: [],
      unreadCount: unreadMap.get(chat.id) || 0,
    }));
    
    setChats(mappedChats as unknown as Chat[]);
  }, [supabase]);


  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('themeSettings');
      if (savedSettings) setThemeSettingsState(JSON.parse(savedSettings));
    } catch (error) { console.error("Could not load theme settings:", error); }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // No need to refetch if we're already signed in with the same user
      if (_event === 'SIGNED_IN' && session?.user.id === loggedInUser?.id) {
          return; 
      }

      setSession(session);
      
      try {
        if (session) {
           await fetchInitialData(session);
        } else {
           setLoggedInUser(null);
           setChats([]);
           setAllUsers([]);
           setDmRequests([]);
        }
      } catch (error: any) {
         toast({ variant: 'destructive', title: 'Error loading data', description: error.message });
         setLoggedInUser(null);
         setChats([]);
         setDmRequests([]);
      } finally {
        if (!isReady) setIsReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchInitialData, toast, isReady, loggedInUser?.id]);

  useEffect(() => {
    if (!loggedInUser) return;

    const handleDmRequestChange = async () => {
       const { data, error } = await supabase
         .from('dm_requests')
         .select('*, from:profiles!from_user_id(*), to:profiles!to_user_id(*)')
         .or(`from_user_id.eq.${loggedInUser.id},to_user_id.eq.${loggedInUser.id}`);
       if (error) {
         console.error("Error re-fetching DM requests:", error);
         return;
       }
       setDmRequests(data as DmRequest[]);
    };

    const dmRequestChannel = supabase
      .channel('dm-requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_requests', filter: `or(from_user_id.eq.${loggedInUser.id},to_user_id.eq.${loggedInUser.id})` }, handleDmRequestChange)
      .subscribe();

    return () => {
      supabase.removeChannel(dmRequestChannel);
    }
  }, [loggedInUser, supabase]);

  const handleNewMessage = useCallback((payload: RealtimePostgresChangesPayload<Message>) => {
    if (!loggedInUser) return;

    const newMessage = payload.new as Message;
    if (newMessage.user_id === loggedInUser.id) return;

    const currentChatId = pathname.split('/chat/')[1];
    const isChatOpen = String(newMessage.chat_id) === currentChatId;
    const isWindowFocused = document.hasFocus();

    setChats(currentChats =>
      currentChats.map(c => {
        if (c.id === newMessage.chat_id) {
          const newUnreadCount = (!isChatOpen || !isWindowFocused) ? (c.unreadCount || 0) + 1 : c.unreadCount;
          return {
            ...c,
            last_message_content: newMessage.attachment_url
              ? (newMessage.attachment_metadata?.name || 'Sent an attachment')
              : newMessage.content,
            last_message_timestamp: newMessage.created_at,
            unreadCount: newUnreadCount,
          };
        }
        return c;
      })
    );

    if ((!isChatOpen || !isWindowFocused) && Notification.permission === 'granted') {
      const sender = allUsers.find(u => u.id === newMessage.user_id);
      if (!sender) return;

      const title = sender.name;
      const body = newMessage.content || (newMessage.attachment_metadata?.name ? `Sent: ${newMessage.attachment_metadata.name}` : 'Sent an attachment');
      
      const notification = new Notification(title, {
        body: body,
        icon: sender.avatar_url || '/logo/light_KCS.png',
        tag: String(newMessage.chat_id),
      });

      notification.onclick = () => {
        window.focus();
        router.push(`/chat/${newMessage.chat_id}`);
      };
    }
  }, [loggedInUser, pathname, allUsers, router]);

  const chatIdsString = useMemo(() => chats.map(c => c.id).sort().join(','), [chats]);

  useEffect(() => {
    if (!isReady || !loggedInUser || !chatIdsString) return;

    const handleChatUpdate = (payload: RealtimePostgresChangesPayload<Chat>) => {
      setChats(current => current.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c));
    };

    const handleChatDelete = (payload: RealtimePostgresChangesPayload<Chat>) => {
       setChats(current => current.filter(c => c.id !== payload.old.id));
    };
    
    const messageChannel = supabase
      .channel('new-message-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=in.(${chatIdsString})` }, handleNewMessage as any)
      .subscribe();
      
    const chatsChannel = supabase
      .channel('chats-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats', filter: `id=in.(${chatIdsString})` }, handleChatUpdate as any)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chats', filter: `id=in.(${chatIdsString})` }, handleChatDelete as any)
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(chatsChannel);
    }
  }, [isReady, loggedInUser, chatIdsString, supabase, handleNewMessage]);

  const setThemeSettings = useCallback((newSettings: Partial<ThemeSettings>) => {
    setThemeSettingsState(prev => {
      const updated = { ...prev, ...newSettings };
      try {
         localStorage.setItem('themeSettings', JSON.stringify(updated));
      } catch (error) {
         console.error("Could not save theme settings to localStorage", error);
      }
      return updated;
    });
  }, []);

  const addChat = (newChat: Chat) => {
    setChats(currentChats => {
      if (currentChats.some(c => c.id === newChat.id)) return currentChats;
      return [newChat, ...currentChats];
    });
  };

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!loggedInUser) return;
    
    const oldUser = { ...loggedInUser };
    setLoggedInUser(current => ({ ...current!, ...updates }));

    const { error } = await supabase
      .from('profiles')
      .update({
        name: updates.name,
        username: updates.username,
        bio: updates.bio,
        avatar_url: updates.avatar_url,
       })
      .eq('id', loggedInUser.id);
    
    if (error) {
        toast({ variant: 'destructive', title: "Error updating profile", description: error.message });
        setLoggedInUser(oldUser);
    }
  }, [loggedInUser, supabase, toast]);

  const leaveGroup = useCallback(async (chatId: number) => {
    if (!loggedInUser) return;
    const { error } = await supabase.from('participants').delete().match({ chat_id: chatId, user_id: loggedInUser.id });
    if (error) {
        toast({ variant: 'destructive', title: 'Error leaving group', description: error.message });
    } else {
        setChats(current => current.filter(c => c.id !== chatId));
    }
  }, [loggedInUser, supabase, toast]);
  
  const deleteGroup = useCallback(async (chatId: number) => {
      const { error } = await supabase.from('chats').delete().eq('id', chatId);
      if (error) {
          toast({ variant: 'destructive', title: 'Error deleting group', description: error.message });
      } else {
          setChats(current => current.filter(c => c.id !== chatId));
      }
  }, [supabase, toast]);

  const sendDmRequest = useCallback(async (toUserId: string, reason: string) => {
      if (!loggedInUser) return;
      const { error } = await supabase.from('dm_requests').insert({
          from_user_id: loggedInUser.id,
          to_user_id: toUserId,
          reason: reason,
      });

      if (error) {
          toast({ variant: 'destructive', title: 'Error sending request', description: error.message });
      } else {
          toast({ title: 'Request Sent!', description: 'Your request to message this user has been sent for approval.' });
      }
  }, [loggedInUser, supabase, toast]);

  const resetUnreadCount = useCallback((chatId: number) => {
      setChats(current => current.map(c => 
          c.id === chatId && c.unreadCount ? { ...c, unreadCount: 0 } : c
      ));
  }, []);

  if (!isReady) {
    return <AppLoading />;
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
    resetUnreadCount
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}
