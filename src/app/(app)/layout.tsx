
"use client"

import type React from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { SidebarProvider } from "@/components/ui/sidebar"
import { ChatLayout } from "./components/chat-layout"
import { useAppContext } from "@/providers/app-provider"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { chats } = useAppContext()

  // The main layout is now stable and always renders the ChatLayout.
  // The loading state is handled by individual components (like UserMenu)
  // showing skeletons until the data is ready. This prevents the "blink"
  // of replacing a full-page loader with the app layout.
  // The middleware.ts file is the single source of truth for protecting routes.
  return (
    <SidebarProvider defaultOpen>
      <ChatLayout chats={chats}>{children}</ChatLayout>
    </SidebarProvider>
  )
}
