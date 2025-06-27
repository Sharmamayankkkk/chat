
"use client"

import { notFound, useParams, useSearchParams } from "next/navigation"
import { Chat as ChatUI } from "../../components/chat"
import { useAppContext } from "@/providers/app-provider"
import { Icons } from "@/components/icons"
import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/utils"
import type { Chat, Message, User } from "@/lib/types"
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
  
  const supabase = useRef(createClient()).current
  
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
    [supabase],
  )

  useEffect(() => {
    if (isAppReady && loggedInUser && params.id) {
      fetchFullChatData(params.id)
    }
  }, [params.id, isAppReady, loggedInUser, fetchFullChatData])

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
  
  const handleNewMessage = useCallback((payload: RealtimePostgresChangesPayload<Message>) => {
    const newMessage = payload.new as Message;
    
    // This is a much more robust approach. Instead of trying to patch the object
    // on the client, we fetch the complete, new message from the DB. This ensures
    // all relations (like profiles and replied_to_message) are correctly loaded.
    const fetchSingleMessage = async (messageId: number) => {
        const { data, error } = await supabase
           .from("messages")
           .select(`*, profiles!user_id(*), replied_to_message:reply_to_message_id(*, profiles!user_id(*))`)
           .eq("id", messageId)
           .single();
       
       if (!error && data) {
            setMessages(current => {
               if (current.some(m => m.id === data.id)) return current;
               return [...current, data as Message];
           });
       } else if (error) {
         console.error("Error fetching single new message:", error);
       }
   }
   fetchSingleMessage(newMessage.id);

  }, [supabase]);

  const handleUpdatedMessage = useCallback((payload: RealtimePostgresChangesPayload<Message>) => {
    const updatedMessage = payload.new
    setMessages((current) =>
      current.map((m) => {
        if (m.id === updatedMessage.id) {
          // Preserve the already loaded profile and reply data, and merge updates
          return { ...m, ...updatedMessage };
        }
        return m;
      })
    );
  }, []);

  const handleDeletedMessage = useCallback((payload: RealtimePostgresChangesPayload<Message>) => {
    const deletedMessageId = (payload.old as Message)?.id
    if (deletedMessageId) {
      setMessages((current) => current.filter((m) => m.id !== deletedMessageId))
    }
  }, []);

  useEffect(() => {
    if (!isAppReady || !supabase || !params.id) return

    const channel = supabase
      .channel(`chat-${params.id}`)
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
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [params.id, supabase, isAppReady, handleNewMessage, handleUpdatedMessage, handleDeletedMessage])

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
