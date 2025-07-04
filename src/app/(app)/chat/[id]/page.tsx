
"use client"

import { notFound, useParams, useSearchParams } from "next/navigation"
import { Chat as ChatUI } from "../../components/chat"
import { useAppContext } from "@/providers/app-provider"
import { Icons } from "@/components/icons"
import { useEffect, useRef, useMemo, useCallback } from "react"
import type { Message } from "@/lib/types"

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
  const chatId = Number(params.id)

  const {
    loggedInUser,
    isReady: isAppReady,
    resetUnreadCount,
    chats,
    loadMessagesForChat,
    setMessagesForChat
  } = useAppContext()

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const topMessageSentinelRef = useRef<HTMLDivElement>(null)

  const chat = useMemo(() => chats.find((c) => c.id === chatId), [chats, chatId])

  useEffect(() => {
    if (isAppReady && loggedInUser?.id && chatId) {
      loadMessagesForChat(chatId)
    }
  }, [chatId, isAppReady, loggedInUser?.id, loadMessagesForChat])

  useEffect(() => {
    if (chatId && loggedInUser?.id) {
      const markAsRead = () => resetUnreadCount(chatId)
      markAsRead()
      window.addEventListener("focus", markAsRead)
      return () => window.removeEventListener("focus", markAsRead)
    }
  }, [chatId, loggedInUser?.id, resetUnreadCount])

  const setMessages = useCallback(
    (updater: React.SetStateAction<Message[]>) => {
      setMessagesForChat(chatId, updater);
    },
    [chatId, setMessagesForChat]
  );
  
  const initialUnreadCount = useMemo(() => {
    if (!isAppReady || !chat) return 0;
    return chat?.unreadCount || 0;
  }, [isAppReady, chat]);


  // The chat from context might not have messages loaded yet, or might be loading
  if (!isAppReady || !chat || chat.isLoadingMessages) {
    return <ChatPageLoading />
  }

  // After loading, if the chat still isn't found, it's a 404
  if (!chat || !loggedInUser) {
    notFound()
  }

  return (
    <ChatUI
      chat={chat}
      loggedInUser={loggedInUser}
      setMessages={setMessages}
      highlightMessageId={highlightMessageId ? Number(highlightMessageId) : null}
      // These props are no longer managed here, but we can pass dummy values or refactor ChatUI
      isLoadingMore={false}
      hasMoreMessages={true} // Assume true for now, can implement pagination later
      topMessageSentinelRef={topMessageSentinelRef}
      scrollContainerRef={scrollContainerRef}
      initialUnreadCount={initialUnreadCount}
    />
  )
}
