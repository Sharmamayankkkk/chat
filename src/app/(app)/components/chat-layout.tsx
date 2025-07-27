
"use client"

import * as React from "react"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Icons } from "@/components/icons"
import type { Chat } from "@/lib/types"
import { UserMenu } from "./user-menu"
import { ChatList } from "./chat-list"
import { MainNav } from "./main-nav"

interface ChatLayoutProps {
  chats: Chat[]
  children: React.ReactNode
}

// This is the main layout component for the entire chat application.
// It creates the two-column structure with the sidebar on the left and the main content on the right.
export function ChatLayout({ chats, children }: ChatLayoutProps) {
  return (
    <div className="flex h-svh w-full">
      {/* This is the sidebar component from our UI library. */}
      <Sidebar className="flex flex-col border-r">
        {/* The header of the sidebar, containing the logo and app name. */}
        <SidebarHeader className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icons.logo className="h-8 w-8 text-primary" />
              <span className="text-lg font-semibold">Krishna Connect</span>
            </div>
          </div>
        </SidebarHeader>

        {/* The main content area of the sidebar. */}
        <SidebarContent className="flex flex-col p-2 pt-0">
            {/* The main navigation links (Chats, Events, etc.). */}
            <MainNav />
            <Separator className="my-2" />
            <div className="flex-1 flex flex-col min-h-0">
                {/* The list of user's chats. */}
                <ChatList chats={chats} />
            </div>
        </SidebarContent>

        {/* The footer of the sidebar, which contains the user menu (profile, settings, logout). */}
        <SidebarFooter className="p-2">
           <UserMenu />
        </SidebarFooter>
      </Sidebar>
      {/* This is where the main content of the page (like the chat window) will be rendered. */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
