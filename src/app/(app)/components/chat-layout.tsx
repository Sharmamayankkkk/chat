
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

export function ChatLayout({ chats, children }: ChatLayoutProps) {
  return (
    <div className="flex h-svh w-full">
      <Sidebar className="flex flex-col border-r">
        <SidebarHeader className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icons.logo className="h-8 w-8 text-primary" />
              <span className="text-lg font-semibold">Krishna Connect</span>
            </div>
            <SidebarTrigger className="hidden md:flex" />
          </div>
        </SidebarHeader>

        <SidebarContent className="flex flex-col p-2 pt-0">
            <MainNav />
            <Separator className="my-2" />
            <div className="flex-1 flex flex-col min-h-0">
                <ChatList chats={chats} />
            </div>
        </SidebarContent>

        <SidebarFooter className="p-2">
           <UserMenu />
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
