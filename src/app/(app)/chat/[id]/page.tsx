
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

  const { loggedInUser, allUsers, isReady: isAppReady, resetUnreadCount } = useAppContext()
  const [localChat, setLocalChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

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
        .select(`*, profiles(*), replied_to_message:reply_to_message_id(*, profiles!user_id(*))`)
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
    if (isAppReady && loggedInUser) {
      fetchFullChatData(params.id)
    }
  }, [params.id, isAppReady, loggedInUser, fetchFullChatData])

  // Mark messages as read and reset local unread count
  useEffect(() => {
    if (supabase && params.id && loggedInUser?.id) {
      const markAsRead = async () => {
        // Mark as read in the database
        await supabase.rpc("mark_messages_as_read", {
          chat_id_param: params.id,
          user_id_param: loggedInUser.id,
        })
        // Reset the unread count in the client-side state
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
  }, [params.id, loggedInUser, supabase, resetUnreadCount])

 const handleNewMessage = useCallback(
    (payload: RealtimePostgresChangesPayload<any>) => {
      const newMessage = payload.new as Message;
      console.log("New message received in chat page:", newMessage);

      const senderProfile = allUsers.find((u) => u.id === newMessage.user_id);
      
      const constructMessage = async (msg: Message): Promise<Message> => {
        const fullMessage: Message = { ...msg, profiles: senderProfile! };
        
        // If it's a reply, we need to fetch the message it replied to,
        // as this won't be in the realtime payload.
        if (msg.reply_to_message_id && !msg.replied_to_message) {
          const { data: repliedToData, error } = await supabase
            .from('messages')
            .select('*, profiles!user_id(*)')
            .eq('id', msg.reply_to_message_id)
            .single();
            
          if (!error && repliedToData) {
            fullMessage.replied_to_message = repliedToData as Message;
          }
        }
        return fullMessage;
      }
      
      if (senderProfile) {
        constructMessage(newMessage).then(fullMessage => {
            setMessages((currentMessages) => {
              if (currentMessages.some((m) => m.id === fullMessage.id)) {
                return currentMessages;
              }
              console.log("Adding new message to UI:", fullMessage);
              return [...currentMessages, fullMessage];
            });
        });
      } else {
        console.warn("Sender profile not found for new message:", newMessage.user_id);
      }
    },
    [allUsers, supabase]
  );
  
  // Real-time subscriptions
  useEffect(() => {
    if (!isAppReady || !supabase || !params.id) return

    console.log("Setting up real-time subscription for chat:", params.id)

    const handleUpdatedMessage = (payload: RealtimePostgresChangesPayload<Message>) => {
      console.log("Message updated:", payload.new)
      setMessages((current) =>
        current.map((m) => {
          if (m.id === payload.new.id) {
            // Keep the existing profile data, as it's not included in the payload
            return { ...m, ...payload.new }
          }
          return m
        }),
      )
    }

    const handleDeletedMessage = (payload: RealtimePostgresChangesPayload<Message>) => {
      console.log("Message deleted:", payload.old)
      setMessages((current) => current.filter((m) => m.id !== payload.old.id))
    }

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
      .subscribe((status) => {
        console.log("Chat subscription status:", status)
      })

    return () => {
      console.log("Cleaning up chat subscription")
      supabase.removeChannel(channel)
    }
  }, [params.id, supabase, handleNewMessage, isAppReady])

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
