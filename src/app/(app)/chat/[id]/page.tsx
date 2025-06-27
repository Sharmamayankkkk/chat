
"use client"

import { notFound, useParams, useSearchParams } from "next/navigation"
import { Chat as ChatUI } from "../../components/chat"
import { useAppContext } from "@/providers/app-provider"
import { Icons } from "@/components/icons"
import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/utils"
import type { Chat, Message } from "@/lib/types"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

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

  const { loggedInUser, isReady: isAppReady, resetUnreadCount } = useAppContext()
  const [localChat, setLocalChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  const supabase = createClient()

  const fetchFullChatData = useCallback(
    async (chatId: string) => {
      try {
        const { data: chatData, error: chatError } = await supabase
          .from("chats")
          .select(`*, participants:participants!chat_id(*, profiles!user_id(*))`)
          .eq("id", chatId)
          .single()

        if (chatError || !chatData) throw chatError

        const { data: messagesData, error: messagesError } = await supabase
          .from("messages")
          .select(`*, profiles!user_id(*), replied_to_message:reply_to_message_id(*, profiles!user_id(*))`)
          .eq("chat_id", chatId)
          .order("created_at", { ascending: true })

        if (messagesError) throw messagesError

        setMessages(messagesData as unknown as Message[])
        setLocalChat(chatData as unknown as Chat)
      } catch (error) {
        console.error("Error fetching chat data:", error)
        setLocalChat(null)
        setMessages([])
      }
    },
    [supabase],
  )
  
  useEffect(() => {
    setIsInitialLoading(true)
    setLocalChat(null)
    setMessages([])

    if (isAppReady && loggedInUser) {
      fetchFullChatData(params.id).finally(() => {
        setIsInitialLoading(false)
      })
    }
  }, [params.id, isAppReady, loggedInUser?.id, fetchFullChatData])

  useEffect(() => {
    if (supabase && params.id && loggedInUser?.id) {
      const markAsRead = async () => {
        await supabase.rpc("mark_messages_as_read", {
          chat_id_param: params.id,
          user_id_param: loggedInUser.id,
        })
        resetUnreadCount(Number(params.id))
      }
      markAsRead()
      const focusListener = () => document.hasFocus() && markAsRead()
      window.addEventListener("focus", focusListener)
      return () => window.removeEventListener("focus", focusListener)
    }
  }, [params.id, loggedInUser?.id, supabase, resetUnreadCount])

  const handleNewMessage = useCallback(
    (payload: RealtimePostgresChangesPayload<Message>) => {
      const newMessageStub = payload.new

      // Perform a single, reliable fetch for the complete message data.
      // This ensures all joined data (profiles, replies) is present, preventing UI flicker.
      supabase
        .from("messages")
        .select(`*, profiles!user_id(*), replied_to_message:reply_to_message_id(*, profiles!user_id(*))`)
        .eq("id", newMessageStub.id)
        .single()
        .then(({ data: fullMessageData, error }) => {
          if (error) {
            console.error("Error fetching full new message:", error)
            return
          }
          if (fullMessageData) {
            setMessages((current) =>
              current.some((m) => m.id === fullMessageData.id) ? current : [...current, fullMessageData as Message],
            )
          }
        })
    },
    [supabase],
  )

  const handleUpdatedMessage = useCallback(
    (payload: RealtimePostgresChangesPayload<Message>) => {
      setMessages((current) =>
        current.map((m) => {
          if (m.id === payload.new.id) {
            // Merge new data, preserving existing profile/reply info to prevent flicker.
            return { ...m, ...payload.new }
          }
          return m
        }),
      )
    },
    [],
  )

  const handleDeletedMessage = useCallback((payload: RealtimePostgresChangesPayload<{ id: number }>) => {
    setMessages((current) => current.filter((m) => m.id !== payload.old.id))
  }, [])

  useEffect(() => {
    if (!isAppReady || !supabase || !params.id) return
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
  }, [params.id, supabase, isAppReady, handleNewMessage, handleUpdatedMessage, handleDeletedMessage])

  if (isInitialLoading || !isAppReady) {
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
    />
  )
}
