
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

const FULL_MESSAGE_SELECT_QUERY = `
    *, 
    read_by,
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
  
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const topMessageSentinelRef = useRef<HTMLDivElement>(null)

  const chat = useMemo(() => chats.find((c) => c.id === chatId), [chats, chatId])
  const initialUnreadCount = useMemo(() => chat?.unreadCount || 0, [chat])

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

  useEffect(() => {
    if (isAppReady && loggedInUser?.id && chatId) {
      fetchMessages();
    }
  }, [chatId, isAppReady, loggedInUser?.id, fetchMessages])

  useEffect(() => {
    if (chatId && loggedInUser?.id) {
      const markAsRead = async () => {
        resetUnreadCount(chatId)
        // This is a simple implementation. A more robust system would use a server-side function.
        await supabase.rpc('mark_chat_as_read', { p_chat_id: chatId, p_user_id: loggedInUser.id });
      }
      markAsRead()
      window.addEventListener("focus", markAsRead)
      return () => window.removeEventListener("focus", markAsRead)
    }
  }, [chatId, loggedInUser?.id, resetUnreadCount, supabase])
  
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, async (payload) => {
          if (payload.new.user_id === loggedInUser?.id) return;

          const { data: fullMessage, error } = await supabase
            .from("messages")
            .select(FULL_MESSAGE_SELECT_QUERY)
            .eq("id", payload.new.id)
            .single()
          
          if (error || !fullMessage) return;

          setMessages(currentMessages => {
             if (currentMessages.some(m => m.id === fullMessage.id)) {
               return currentMessages;
             }
             return [...currentMessages, fullMessage as Message]
          });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
       }, async (payload) => {
          const { data: fullMessage, error } = await supabase
            .from("messages")
            .select(FULL_MESSAGE_SELECT_QUERY)
            .eq("id", payload.new.id)
            .single()
          
          if (error || !fullMessage) return;
          
          setMessages(current => current.map(m => m.id === payload.new.id ? fullMessage as Message : m));
       })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    }
  }, [chatId, supabase, loggedInUser?.id]);


  if (isLoading || !isAppReady || !chat) {
    return <ChatPageLoading />
  }

  if (!chat || !loggedInUser) {
    notFound()
  }

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
