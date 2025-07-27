
"use client"

import { notFound, useParams, useSearchParams } from "next/navigation"
import { Chat as ChatUI } from "../../components/chat"
import { useAppContext } from "@/providers/app-provider"
import { Icons } from "@/components/icons"
import { useEffect, useRef, useMemo, useCallback, useState } from "react"
import type { Message, Chat } from "@/lib/types"
import { createClient } from "@/lib/utils"

function ChatPageLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Icons.logo className="h-12 w-12 animate-pulse text-primary" />
        <p className="text-muted-foreground">Loading chat...</p>
      </div>
    </div>
  )
}

// This is a constant string used in our Supabase database queries.
// It tells the database exactly which columns we want to fetch for a message,
// including related data like the sender's profile and the message being replied to.
const FULL_MESSAGE_SELECT_QUERY = `
    id, created_at, chat_id, user_id, content, attachment_url, attachment_metadata, is_edited, reactions, read_by, is_pinned, is_starred, reply_to_message_id, 
    profiles!user_id(*), 
    replied_to_message:reply_to_message_id(*, profiles!user_id(*))
`;

export default function ChatPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const highlightMessageId = searchParams.get("highlight")
  const chatId = Number(params.id)
  const supabase = createClient()

  const {
    loggedInUser,
    isReady: isAppReady,
    resetUnreadCount,
    chats,
  } = useAppContext()
  
  // This state variable holds the list of messages for the current chat.
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const topMessageSentinelRef = useRef<HTMLDivElement>(null)

  // `useMemo` is a performance hook. It only recalculates the chat object
  // when the `chats` array or the `chatId` changes.
  const chat = useMemo(() => chats.find((c) => c.id === chatId), [chats, chatId])
  const initialUnreadCount = useMemo(() => chat?.unreadCount || 0, [chat])

  // `useCallback` is another performance hook that memoizes the function itself.
  // This function fetches the initial batch of messages for the chat.
  const fetchMessages = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('messages')
      .select(FULL_MESSAGE_SELECT_QUERY)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } else {
      setMessages(data as Message[]);
    }
    setIsLoading(false);
  }, [chatId, supabase]);

  // This `useEffect` hook triggers the initial message fetch when the component is ready.
  useEffect(() => {
    if (isAppReady && loggedInUser?.id && chatId && !isNaN(chatId)) {
      console.log('Fetching messages for chat:', chatId);
      fetchMessages();
    }
  }, [chatId, isAppReady, loggedInUser?.id, fetchMessages])

  // This hook marks messages as read when the chat is opened or the window is focused.
  useEffect(() => {
    if (chatId && loggedInUser?.id && !isNaN(chatId)) {
      const markAsRead = async () => {
        try {
          resetUnreadCount(chatId)
          // This is a remote procedure call (RPC) to a custom database function
          // that efficiently marks all messages in the chat as read for the current user.
          await supabase.rpc('mark_messages_as_read', { p_chat_id: chatId, p_user_id: loggedInUser.id });
        } catch (error) {
          console.warn('Failed to mark messages as read:', error);
        }
      }
      markAsRead()
      window.addEventListener("focus", markAsRead)
      return () => window.removeEventListener("focus", markAsRead)
    }
  }, [chatId, loggedInUser?.id, resetUnreadCount, supabase])
  
  // *** THIS IS THE CORE OF THE REAL-TIME FIX ***
  // This `useEffect` hook sets up the real-time subscription for the current chat.
  useEffect(() => {
    // Only set up subscription if we have valid prerequisites
    if (!chatId || isNaN(chatId) || !loggedInUser?.id) {
      return;
    }

    console.log('Setting up real-time subscription for chat:', chatId);

    // This function will be called every time a new message is inserted into the database.
    const handleNewMessage = async (payload: any) => {
        console.log('New message received:', payload.new.id);
        // The payload only contains the basic new message. We need to fetch the full
        // message details (like the sender's profile) to display it correctly.
        try {
          const { data: fullMessage, error } = await supabase
            .from("messages")
            .select(FULL_MESSAGE_SELECT_QUERY)
            .eq("id", payload.new.id)
            .single()
          
          if (error) {
            console.error('Failed to fetch full message:', error);
            return;
          }

          if (!fullMessage) {
            console.warn('No message data returned for ID:', payload.new.id);
            return;
          }

          // We update our local `messages` state by adding the new message to the end.
          // We also check to make sure we don't accidentally add a duplicate message.
          setMessages(currentMessages => {
              if (currentMessages.some(m => m.id === fullMessage.id)) {
                  return currentMessages;
              }
              return [...currentMessages, fullMessage as Message]
          });
        } catch (error) {
          console.error('Error handling new message:', error);
        }
    }

    // This function handles real-time updates for edited messages.
    const handleUpdatedMessage = async (payload: any) => {
        console.log('Message updated:', payload.new.id);
        try {
          const { data: fullMessage, error } = await supabase
            .from("messages")
            .select(FULL_MESSAGE_SELECT_QUERY)
            .eq("id", payload.new.id)
            .single()
          
          if (error) {
            console.error('Failed to fetch updated message:', error);
            return;
          }

          if (!fullMessage) {
            console.warn('No updated message data returned for ID:', payload.new.id);
            return;
          }
          
          // We find the message in our local state and replace it with the updated version.
          setMessages(current => current.map(m => m.id === payload.new.id ? fullMessage as Message : m));
        } catch (error) {
          console.error('Error handling updated message:', error);
        }
    }

    // Here, we subscribe to the Supabase channel for our specific chat.
    // We listen for both 'INSERT' (new messages) and 'UPDATE' (edited messages) events.
    const channel = supabase
      .channel(`chat-${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, handleNewMessage)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
       }, handleUpdatedMessage)
      .subscribe((status) => {
        console.log(`Chat ${chatId} subscription status:`, status);
      });

    // The cleanup function is crucial. It unsubscribes from the channel when the user
    // navigates away from this chat, preventing memory leaks and unnecessary background updates.
    return () => {
      console.log('Cleaning up real-time subscription for chat:', chatId);
      supabase.removeChannel(channel);
    }
  }, [chatId, supabase, loggedInUser?.id]);


  // Add validation for chatId
  if (isNaN(chatId) || chatId <= 0) {
    notFound()
  }

  if (isLoading || !isAppReady || !loggedInUser) {
    return <ChatPageLoading />
  }

  if (!chat) {
    return <ChatPageLoading />
  }

  // Finally, we render the main ChatUI component, passing down all the necessary data and state.
  return (
    <ChatUI
      chat={{ ...chat, messages }}
      loggedInUser={loggedInUser}
      setMessages={setMessages}
      highlightMessageId={highlightMessageId ? Number(highlightMessageId) : null}
      isLoadingMore={false}
      hasMoreMessages={true}
      topMessageSentinelRef={topMessageSentinelRef}
      scrollContainerRef={scrollContainerRef}
      initialUnreadCount={initialUnreadCount}
    />
  )
}
