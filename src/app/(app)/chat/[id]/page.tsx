"use client"

import { notFound, useParams, useSearchParams } from "next/navigation"
import { Chat as ChatUI } from "../../components/chat"
import { useAppContext } from "@/providers/app-provider"
import { Icons } from "@/components/icons"
import { useEffect, useState, useCallback, useRef } from "react"
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
  const [isLoading, setIsLoading] = useState(true)

  // Use a ref to ensure the supabase client is stable across renders.
  const supabase = useRef(createClient()).current

  // Fetch the initial chat and message data.
  const fetchFullChatData = useCallback(
    async (chatId: string) => {
      setIsLoading(true)

      const { data: chatData, error: chatError } = await supabase
        .from("chats")
        .select(`*, participants:participants!chat_id(*, profiles!user_id(*))`)
        .eq("id", chatId)
        .single()

      if (chatError || !chatData) {
        console.error(`Error fetching chat ${chatId}:`, chatError)
        setLocalChat(null)
        setIsLoading(false)
        return
      }

      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select(`*, profiles!user_id(*), replied_to_message:reply_to_message_id(*, profiles!user_id(*))`)
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })

      if (messagesError) {
        console.error(`Error fetching messages for chat ${chatId}:`, messagesError)
        setMessages([])
      } else {
        setMessages(messagesData as unknown as Message[])
      }

      setLocalChat(chatData as unknown as Chat)
      setIsLoading(false)
    },
    [supabase], // supabase is stable, so this function is stable.
  )

  // Trigger initial data fetch when component mounts or chat ID changes.
  useEffect(() => {
    if (isAppReady && loggedInUser && params.id) {
      fetchFullChatData(params.id)
    }
  }, [params.id, isAppReady, loggedInUser, fetchFullChatData])

  // Mark messages as read when chat is opened or focused.
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
      const focusListener = () => {
        if (document.hasFocus()) {
          markAsRead()
        }
      }
      window.addEventListener("focus", focusListener)
      return () => {
        window.removeEventListener("focus", focusListener)
      }
    }
  }, [params.id, loggedInUser?.id, supabase, resetUnreadCount])

  // Define stable handlers for real-time events.
  const handleNewMessage = useCallback(
    (payload: RealtimePostgresChangesPayload<{ id: number }>) => {
      const newMessageId = payload.new.id

      // Fetch the complete message from the DB to ensure all relations (profiles, replies) are correctly loaded.
      // This is more robust than trying to build the object on the client.
      const fetchSingleMessage = async (messageId: number) => {
        try {
          const { data, error } = await supabase
            .from("messages")
            .select(`*, profiles!user_id(*), replied_to_message:reply_to_message_id(*, profiles!user_id(*))`)
            .eq("id", messageId)
            .single()

          if (error) throw error

          if (data) {
            setMessages((current) => {
              if (current.some((m) => m.id === data.id)) return current // Prevent duplicates
              return [...current, data as Message]
            })
          }
        } catch (error) {
          console.error("Error fetching single new message:", error)
        }
      }
      fetchSingleMessage(newMessageId)
    },
    [supabase],
  )

  const handleUpdatedMessage = useCallback((payload: RealtimePostgresChangesPayload<Message>) => {
    const updatedMessage = payload.new
    setMessages((current) =>
      current.map((m) => {
        if (m.id === updatedMessage.id) {
          // Merge updates, preserving existing profile/reply data if the payload is partial.
          return { ...m, ...updatedMessage }
        }
        return m
      }),
    )
  }, [])

  const handleDeletedMessage = useCallback((payload: RealtimePostgresChangesPayload<{ id: number }>) => {
    const deletedMessageId = payload.old.id
    if (deletedMessageId) {
      setMessages((current) => current.filter((m) => m.id !== deletedMessageId))
    }
  }, [])

  // The main effect for setting up the real-time subscription.
  useEffect(() => {
    if (!isAppReady || !supabase || !params.id) return

    // Use a unique channel name for each chat page instance.
    const channel = supabase
      .channel(`chat-room-${params.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${params.id}` },
        handleNewMessage,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `chat_id=eq.${params.id}` },
        handleUpdatedMessage,
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `chat_id=eq.${params.id}` },
        handleDeletedMessage,
      )
      .subscribe((status, err) => {
        if (err) {
          console.error(`Subscription error for chat ${params.id}:`, err)
        }
      })

    // Cleanup function to remove the subscription when the component unmounts or dependencies change.
    return () => {
      supabase.removeChannel(channel)
    }
  }, [params.id, supabase, isAppReady, handleNewMessage, handleUpdatedMessage, handleDeletedMessage])

  // Render logic
  if ((isLoading && !localChat) || !isAppReady) {
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
