
"use client"

import { notFound, useParams, useSearchParams } from "next/navigation"
import { Chat as ChatUI } from "../../components/chat"
import { useAppContext } from "@/providers/app-provider"
import { Icons } from "@/components/icons"
import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { createClient } from "@/lib/utils"
import type { Chat, Message } from "@/lib/types"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

const MESSAGES_PER_PAGE = 50

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

export default function ChatPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const highlightMessageId = searchParams.get("highlight")

  const { loggedInUser, isReady: isAppReady, resetUnreadCount, chats } = useAppContext()
  const [messages, setMessages] = useState<Message[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const supabaseRef = useRef(createClient())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const topMessageSentinelRef = useRef<HTMLDivElement>(null)
  
  const chatId = Number(params.id);
  const chat = useMemo(() => chats.find(c => c.id === chatId), [chats, chatId]);

  const initialUnreadCount = useMemo(() => {
    if (!isAppReady || !chat) return 0;
    return chat?.unreadCount || 0;
  }, [isAppReady, chat]);

  const fetchChatAndInitialMessages = useCallback(
    async (id: number) => {
      if (!loggedInUser?.id) return;
      setIsInitialLoading(true);
      try {
        const { data: messagesData, error: messagesError } = await supabaseRef.current
          .from("messages")
          .select(`*, profiles!user_id(*), replied_to_message:reply_to_message_id(*, profiles!user_id(*))`)
          .eq("chat_id", id)
          .order("created_at", { ascending: false })
          .limit(MESSAGES_PER_PAGE)

        if (messagesError) throw messagesError

        const reversedMessages = (messagesData as unknown as Message[]).reverse()
        setMessages(reversedMessages)
        setHasMore(messagesData.length === MESSAGES_PER_PAGE)
      } catch (error) {
        console.error("Error fetching chat data:", error)
      } finally {
        setIsInitialLoading(false)
      }
    },
    [loggedInUser?.id],
  )

  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return

    setIsLoadingMore(true)
    const oldestMessage = messages[0]
    if (!oldestMessage) {
      setIsLoadingMore(false)
      return
    }

    try {
      const { data, error } = await supabaseRef.current
        .from("messages")
        .select(`*, profiles!user_id(*), replied_to_message:reply_to_message_id(*, profiles!user_id(*))`)
        .eq("chat_id", chatId)
        .lt("created_at", oldestMessage.created_at)
        .order("created_at", { ascending: false })
        .limit(MESSAGES_PER_PAGE)

      if (error) throw error

      const newMessages = (data as unknown as Message[]).reverse()
      setHasMore(data.length === MESSAGES_PER_PAGE)

      const scrollContainer = scrollContainerRef.current
      if (scrollContainer) {
        const previousScrollHeight = scrollContainer.scrollHeight
        setMessages((prev) => [...newMessages, ...prev])
        
        requestAnimationFrame(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight - previousScrollHeight
        })
      } else {
        setMessages((prev) => [...newMessages, ...prev])
      }
    } catch (error) {
      console.error("Error loading more messages:", error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMore, messages, chatId])

  // Fetch initial messages when chat ID changes
  useEffect(() => {
    if (isAppReady && loggedInUser?.id && chatId) {
      fetchChatAndInitialMessages(chatId)
    }
  }, [chatId, isAppReady, loggedInUser?.id, fetchChatAndInitialMessages])

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreMessages()
        }
      },
      { root: scrollContainerRef.current, threshold: 0.1 }
    )

    const sentinel = topMessageSentinelRef.current
    if (sentinel) {
      observer.observe(sentinel)
    }

    return () => {
      if (sentinel) {
        observer.unobserve(sentinel)
      }
    }
  }, [loadMoreMessages])

  // Mark chat as read
  useEffect(() => {
    if (chatId && loggedInUser?.id) {
      const markAsRead = () => resetUnreadCount(chatId);
      markAsRead()
      window.addEventListener("focus", markAsRead)
      return () => window.removeEventListener("focus", markAsRead)
    }
  }, [chatId, loggedInUser?.id, resetUnreadCount]);

  const fetchFullMessage = useCallback(
    async (messageId: number) => {
      const { data: fullMessageData, error } = await supabaseRef.current
        .from("messages")
        .select(`*, profiles!user_id(*), replied_to_message:reply_to_message_id(*, profiles!user_id(*))`)
        .eq("id", messageId)
        .single()

      if (error) {
        console.error("Error fetching full message:", error)
        return null
      }
      return fullMessageData as Message
    },
    [],
  )

  // Set up real-time subscription for this chat only
  useEffect(() => {
    if (!chatId || !loggedInUser?.id) return;

    const handleNewMessage = async (payload: RealtimePostgresChangesPayload<Message>) => {
      const newMessageId = payload.new.id as number;
      // If we already have this message (e.g. from an optimistic update), just update its ID to be the final one
      const optimisticMessageIndex = messages.findIndex(m => m.id === `temp-${newMessageId}`);
      if (optimisticMessageIndex > -1) {
          setMessages(current => current.map(m => m.id === `temp-${newMessageId}` ? { ...m, id: newMessageId } : m));
          return;
      }
      
      const fullMessage = await fetchFullMessage(newMessageId);
      if (fullMessage) {
        // Only add if it's not our own message and we don't already have it
        if (fullMessage.user_id !== loggedInUser.id && !messages.some(m => m.id === fullMessage.id)) {
          setMessages((current) => [...current, fullMessage]);
        }
      }
    };

    const handleUpdatedMessage = async (payload: RealtimePostgresChangesPayload<Message>) => {
      setMessages((current) =>
        current.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m)),
      )
    }

    const handleDeletedMessage = (payload: RealtimePostgresChangesPayload<{ id: number }>) => {
      setMessages((current) => current.filter((m) => m.id !== payload.old.id))
    }

    const channel = supabaseRef.current
      .channel(`chat-room-${chatId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` }, handleNewMessage as any)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` }, handleUpdatedMessage as any)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` }, handleDeletedMessage as any)
      .subscribe();

    return () => {
      supabaseRef.current.removeChannel(channel)
    }
  }, [chatId, fetchFullMessage, loggedInUser?.id, messages]);

  if (isInitialLoading) {
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
      isLoadingMore={isLoadingMore}
      hasMoreMessages={hasMore}
      topMessageSentinelRef={topMessageSentinelRef}
      scrollContainerRef={scrollContainerRef}
      initialUnreadCount={initialUnreadCount}
    />
  )
}
