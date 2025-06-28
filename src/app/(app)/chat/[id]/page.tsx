
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
  const [localChat, setLocalChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const topMessageSentinelRef = useRef<HTMLDivElement>(null)

  const initialUnreadCount = useMemo(() => {
    if (!isAppReady || !params.id) return 0;
    const chatInList = chats.find(c => c.id === Number(params.id));
    return chatInList?.unreadCount || 0;
  }, [isAppReady, params.id, chats]);

  const fetchChatAndInitialMessages = useCallback(
    async (chatId: string) => {
      if (!loggedInUser?.id) return;
      setIsInitialLoading(true);
      try {
        const { data: chatData, error: chatError } = await supabase
          .from("chats")
          .select(`*, participants:participants!chat_id(*, profiles!user_id(*))`)
          .eq("id", chatId)
          .single()

        if (chatError || !chatData) throw chatError

        const isParticipant = chatData.participants.some(p => p.user_id === loggedInUser?.id);
        if (!isParticipant) {
          throw new Error("You are not a member of this chat.");
        }
        
        setLocalChat(chatData as unknown as Chat)

        const { data: messagesData, error: messagesError } = await supabase
          .from("messages")
          .select(`*, profiles!user_id(*), replied_to_message:reply_to_message_id(*, profiles!user_id(*))`)
          .eq("chat_id", chatId)
          .order("created_at", { ascending: false })
          .limit(MESSAGES_PER_PAGE)

        if (messagesError) throw messagesError

        const reversedMessages = (messagesData as unknown as Message[]).reverse()
        setMessages(reversedMessages)
        setHasMore(messagesData.length === MESSAGES_PER_PAGE)
      } catch (error) {
        console.error("Error fetching chat data:", error)
        setLocalChat(null) // This will trigger notFound() in the render
      } finally {
        setIsInitialLoading(false)
      }
    },
    [supabase, loggedInUser?.id],
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
      const { data, error } = await supabase
        .from("messages")
        .select(`*, profiles!user_id(*), replied_to_message:reply_to_message_id(*, profiles!user_id(*))`)
        .eq("chat_id", params.id)
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
  }, [isLoadingMore, hasMore, messages, supabase, params.id])

  useEffect(() => {
    if (isAppReady && loggedInUser) {
      fetchChatAndInitialMessages(params.id)
    }
  }, [params.id, isAppReady, loggedInUser?.id, fetchChatAndInitialMessages])

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

  useEffect(() => {
    if (supabase && params.id && loggedInUser?.id && messages.length > 0) {
      const markAsRead = async () => {
        await supabase.rpc("mark_messages_as_read", {
          chat_id_param: Number(params.id),
          user_id_param: loggedInUser.id,
        })
        resetUnreadCount(Number(params.id))
      }
      markAsRead()
      const focusListener = () => document.hasFocus() && markAsRead()
      window.addEventListener("focus", focusListener)
      return () => window.removeEventListener("focus", focusListener)
    }
  }, [params.id, loggedInUser?.id, supabase, resetUnreadCount, messages])

  const fetchFullMessage = useCallback(
    async (messageId: number) => {
      const { data: fullMessageData, error } = await supabase
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
    [supabase],
  )

  useEffect(() => {
    if (!isAppReady || !supabase || !params.id || !loggedInUser?.id) return;

    const handleNewMessage = async (payload: RealtimePostgresChangesPayload<Message>) => {
      if (payload.new.user_id === loggedInUser.id) {
        return;
      }
      
      const fullMessage = await fetchFullMessage(payload.new.id);
      if (fullMessage) {
        setMessages((current) => {
          if (current.some((m) => m.id === fullMessage.id)) return current;
          return [...current, fullMessage];
        });
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

    const channel = supabase
      .channel(`chat-room-${params.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${params.id}` },
        handleNewMessage as any,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `chat_id=eq.${params.id}` },
        handleUpdatedMessage as any,
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `chat_id=eq.${params.id}` },
        handleDeletedMessage as any,
      )
      .subscribe((status, err) => {
        if (err) console.error(`Subscription error for chat ${params.id}:`, err)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [params.id, supabase, isAppReady, fetchFullMessage, loggedInUser?.id]);

  if (isInitialLoading) {
    return <ChatPageLoading />
  }

  if (!localChat || !loggedInUser) {
    notFound()
  }

  return (
    <ChatUI
      chat={{ ...localChat, messages }}
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
