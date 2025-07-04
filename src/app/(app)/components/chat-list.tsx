
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, PlusCircle, MessageSquarePlus } from 'lucide-react';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Chat } from '@/lib/types';
import { useAppContext } from '@/providers/app-provider';
import { CreateGroupDialog } from './create-group-dialog';
import { NewChatDialog } from './new-chat-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatListProps {
  chats: Chat[];
}

export function ChatList({ chats }: ChatListProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const { loggedInUser } = useAppContext();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isCreateGroupOpen, setIsCreateGroupOpen] = React.useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = React.useState(false);


  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
  
  const getChatPartner = (chat: Chat) => {
    if (!loggedInUser || chat.type !== 'dm') return null;
    const partner = chat.participants?.find(p => p.user_id !== loggedInUser.id);
    return partner?.profiles ?? null;
  }
  
  const getChatDisplayInfo = (chat: Chat) => {
    if (chat.type === 'dm') {
      const partner = getChatPartner(chat);
      return {
        name: partner?.name || "DM Chat",
        avatar: partner?.avatar_url || "https://placehold.co/100x100.png"
      };
    }
    return {
      name: chat.name || "Group Chat",
      avatar: chat.avatar_url || "https://placehold.co/100x100.png"
    };
  }

  const filteredChats = React.useMemo(() => {
    if (!searchQuery) return chats;

    const lowercasedQuery = searchQuery.toLowerCase();
    return chats.filter(chat => {
      const info = getChatDisplayInfo(chat);
      return info.name.toLowerCase().includes(lowercasedQuery);
    });
  }, [chats, searchQuery, loggedInUser]);

  return (
    <div className="flex h-full flex-col">
       <CreateGroupDialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen} />
       <NewChatDialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen} />
      <div className="relative flex items-center gap-2 mb-2">
        <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chats..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
        <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => setIsNewChatOpen(true)}>
                  <MessageSquarePlus className="h-5 w-5" />
                  <span className="sr-only">New Chat</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">New Chat</TooltipContent>
            </Tooltip>
          {loggedInUser?.is_admin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => setIsCreateGroupOpen(true)}>
                  <PlusCircle className="h-5 w-5" />
                  <span className="sr-only">Create Group</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Create Group</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
      <ScrollArea className="flex-1 -mx-2">
        <SidebarMenu className="px-2">
          {filteredChats.length > 0 ? (
            filteredChats.map((chat) => {
              const { name, avatar } = getChatDisplayInfo(chat);
              return (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === `/chat/${chat.id}`}
                    className="w-full justify-start h-14 py-2 gap-3"
                  >
                    <Link
                      href={`/chat/${chat.id}`}
                      onClick={handleLinkClick}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={avatar}
                          alt={name}
                          data-ai-hint="avatar"
                        />
                        <AvatarFallback>
                          {name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate font-medium">{name}</span>
                      {chat.unreadCount && chat.unreadCount > 0 ? (
                        <SidebarMenuBadge>{chat.unreadCount}</SidebarMenuBadge>
                      ) : null}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No chats found.
            </div>
          )}
        </SidebarMenu>
      </ScrollArea>
    </div>
  );
}
