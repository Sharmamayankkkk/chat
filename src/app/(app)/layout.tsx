"use client"

import type React from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { SidebarProvider } from "@/components/ui/sidebar"
import { ChatLayout } from "./components/chat-layout"
import { useAppContext } from "@/providers/app-provider"
import { Icons } from "@/components/icons"

function AppShellLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Icons.logo className="h-16 w-16 animate-pulse text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Initializing app...</p>
      </div>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { chats, loggedInUser, isReady } = useAppContext()
  const router = useRouter()

  useEffect(() => {
    // This is a client-side safety net. The middleware handles the initial server-side redirect.
    // This will catch cases like the user logging out, which changes the state on the client.
    if (isReady && !loggedInUser) {
      router.replace("/login")
    }
  }, [isReady, loggedInUser, router])

  // While the app is initializing, or if we know we need to redirect, show a loader.
  if (!isReady || !loggedInUser) {
    return <AppShellLoading />
  }

  // Once ready and the user is confirmed, render the main app layout.
  return (
    <SidebarProvider defaultOpen>
      <ChatLayout chats={chats}>{children}</ChatLayout>
    </SidebarProvider>
  )
}
