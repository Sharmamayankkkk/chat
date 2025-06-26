"use client"

import type React from "react"
import { useEffect, useState } from "react"
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
  const [hasRedirected, setHasRedirected] = useState(false)

  useEffect(() => {
    // Only redirect once when ready and no user
    if (isReady && !loggedInUser && !hasRedirected) {
      console.log("Redirecting to login - no user found")
      setHasRedirected(true)
      router.replace("/login")
      return
    }

    // Reset redirect flag when user is found
    if (loggedInUser && hasRedirected) {
      setHasRedirected(false)
    }
  }, [isReady, loggedInUser, router, hasRedirected])

  // Show loading while not ready
  if (!isReady) {
    return <AppShellLoading />
  }

  // Show loading while redirecting to login
  if (!loggedInUser && hasRedirected) {
    return <AppShellLoading />
  }

  // If no user and haven't redirected yet, show loading
  if (!loggedInUser) {
    return <AppShellLoading />
  }

  return (
    <SidebarProvider defaultOpen>
      <ChatLayout chats={chats}>{children}</ChatLayout>
    </SidebarProvider>
  )
}
