
'use client'

import { notFound, useParams, useSearchParams } from "next/navigation";
import { Chat as ChatUI } from "../../components/chat";
import { useAppContext } from "@/providers/app-provider";
import { Icons } from "@/components/icons";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/utils";
import type { Chat, Message } from "@/lib/types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

function ChatPageLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
       <div className="flex flex-col items-center gap-4">
        <Icons.logo className="h-12 w-12 animate-pulse text-primary" />
        <p className="text-muted-foreground">Loading chat...</p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const highlightMessageId = searchParams.get('highlight');
  
  const { loggedInUser, allUsers, isReady: isAppReady, resetUnreadCount } = useAppContext();
  const [localChat, setLocalChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const fetchFullChatData = useCallback(async (chatId: string) => {
    if (!localChat) {
      setIsLoading(true);
    }
    
    const { data: chatData, error: chatError } = await supabase
      .from('chats')
      .select(`*, participants:participants!chat_id(*, profiles!user_id(*))`)
      .eq('id', chatId)
      .single();

    if (chatError || !chatData) {
      console.error(`Error fetching chat ${chatId}:`, chatError);
      setLocalChat(null);
      setIsLoading(false);
      return;
    }

    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select(`*, profiles(*), read_by`)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    
    if (messagesError) {
      console.error(`Error fetching messages for chat ${chatId}:`, messagesError);
      setMessages([]);
    } else {
      setMessages(messagesData as unknown as Message[]);
    }
    
    setLocalChat(chatData as unknown as Chat);
    setIsLoading(false);
  }, [supabase, localChat]);

  useEffect(() => {
    if (isAppReady && loggedInUser) {
      fetchFullChatData(params.id);
    }
  }, [params.id, isAppReady, loggedInUser, fetchFullChatData]);

  // Mark messages as read and reset local unread count
  useEffect(() => {
    if (supabase && params.id && loggedInUser?.id) {
      const markAsRead = async () => {
        // Mark as read in the database
        await supabase.rpc('mark_messages_as_read', {
          chat_id_param: params.id,
          user_id_param: loggedInUser.id,
        });
        // Reset the unread count in the client-side state
        resetUnreadCount(Number(params.id));
      };
      
      markAsRead();
      const focusListener = () => {
        if(document.hasFocus()){
            markAsRead();
        }
      }
      window.addEventListener('focus', focusListener);
      return () => {
        window.removeEventListener('focus', focusListener);
      };
    }
  }, [params.id, loggedInUser, supabase, resetUnreadCount]);
  
  const handleNewMessage = useCallback((payload: RealtimePostgresChangesPayload<Message>) => {
    const newMessage = payload.new as Message;
    // Find the sender's profile from the list of all users we already have
    const senderProfile = allUsers.find(u => u.id === newMessage.user_id);
    
    if (senderProfile) {
        // Construct the full message object without needing another fetch
        const fullMessage: Message = { ...newMessage, profiles: senderProfile };
        setMessages(currentMessages => {
            // Prevent duplicates
            if (currentMessages.some(m => m.id === fullMessage.id)) {
                return currentMessages;
            }
            return [...currentMessages, fullMessage];
        });
    } else {
        // Fallback to refetch if user profile not found (should be rare)
        fetchFullChatData(params.id);
    }
  }, [allUsers, fetchFullChatData, params.id]);

  // Real-time subscriptions
  useEffect(() => {
    // Guard clause to ensure all context data is ready before subscribing
    if (!isAppReady || !supabase || !params.id) return;

    const handleUpdatedMessage = (payload: RealtimePostgresChangesPayload<Message>) => {
        setMessages(current => current.map(m => {
            if (m.id === payload.new.id) {
                // Keep the existing profile data, as it's not included in the payload
                return { ...m, ...payload.new };
            }
            return m;
        }));
    };
    
    const handleDeletedMessage = (payload: RealtimePostgresChangesPayload<Message>) => {
        setMessages(current => current.filter(m => m.id !== payload.old.id));
    };

    const channel = supabase
      .channel(`chat-${params.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${params.id}` }, handleNewMessage)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${params.id}` }, handleUpdatedMessage)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `chat_id=eq.${params.id}` }, handleDeletedMessage)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.id, supabase, handleNewMessage, isAppReady]);
  
  if ((isLoading && !localChat) || !isAppReady) {
    return <ChatPageLoading />;
  }

  if (!localChat || !loggedInUser) {
    notFound();
  }

  return <ChatUI chat={{...localChat, messages}} loggedInUser={loggedInUser} setMessages={setMessages} highlightMessageId={highlightMessageId ? Number(highlightMessageId) : null} />;
}
