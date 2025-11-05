
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { useAppContext } from "@/providers/app-provider"
import type { User, Chat } from '@/lib/types'
import { createClient } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Search } from 'lucide-react'

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewChatDialog({ open, onOpenChange }: NewChatDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { loggedInUser, chats, addChat } = useAppContext();
  const [allUsers, setAllUsers] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const supabase = createClient();

  React.useEffect(() => {
    if (open && loggedInUser) {
      const fetchUsers = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .neq('id', loggedInUser.id); // Exclude self

        if (error) {
          toast({ variant: 'destructive', title: "Error fetching users", description: error.message });
          setAllUsers([]);
        } else {
          setAllUsers(data as User[]);
        }
        setIsLoading(false);
      };
      fetchUsers();
    } else {
        setSearchQuery('');
        setAllUsers([]);
    }
  }, [open, supabase, toast, loggedInUser]);
  
  const handleUserClick = async (targetUser: User) => {
    if (!loggedInUser) return;
    
    setIsLoading(true);

    // 1. Check if a DM chat already exists
    const existingChat = chats.find(c =>
      c.type === 'dm' &&
      c.participants?.length === 2 &&
      c.participants.some(p => p.user_id === loggedInUser.id) &&
      c.participants.some(p => p.user_id === targetUser.id)
    );

    if (existingChat) {
        router.push(`/chat/${existingChat.id}`);
        onOpenChange(false);
        return;
    }

    // 2. If not, create a new DM chat
    try {
      // Create the chat record. The `created_by` field is set automatically by the database.
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .insert({ type: 'dm' })
        .select()
        .single();
      
      if (chatError) throw chatError;
      const newChatId = chatData.id;

      // Add participants
      const participantData = [
        { chat_id: newChatId, user_id: loggedInUser.id },
        { chat_id: newChatId, user_id: targetUser.id }
      ];
      
      const { error: participantsError } = await supabase.from('participants').insert(participantData);
      if (participantsError) throw participantsError;
      
      // Fetch the full chat object to add to the context
      const { data: newFullChat, error: newChatError } = await supabase
        .from('chats')
        .select(`*, participants:participants!chat_id ( user_id, profiles:profiles!user_id (*) )`)
        .eq('id', newChatId)
        .single();
      
      if (newChatError || !newFullChat) {
          throw newChatError || new Error("Failed to fetch newly created chat.");
      }

      addChat({ ...newFullChat, messages: [] } as unknown as Chat);
      toast({ title: "Chat started!", description: `You can now message ${targetUser.name}.` });
      onOpenChange(false);
      router.push(`/chat/${newChatId}`);

    } catch (error: any) {
        console.error("Supabase error details:", error);
        toast({
          variant: 'destructive',
          title: 'Error starting chat',
          description: `Database error: ${error.message}. Please ensure RLS policies are correct or disabled for testing.`
        });
    } finally {
        setIsLoading(false);
    }
  }

  const filteredUsers = React.useMemo(() => {
    if (!loggedInUser) return [];

    const usersToShow = allUsers;

    if (!searchQuery) return usersToShow;

    const lowercasedQuery = searchQuery.toLowerCase();
    return usersToShow.filter(user =>
      user.name.toLowerCase().includes(lowercasedQuery) ||
      (user.username && user.username.toLowerCase().includes(lowercasedQuery))
    );
  }, [allUsers, searchQuery, loggedInUser]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Chat</DialogTitle>
          <DialogDescription>Select a user to start a conversation.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <ScrollArea className="h-72 w-full mt-4">
          {isLoading && !allUsers.length ? (
            <div className="space-y-3 pr-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-3 w-[100px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="space-y-1 pr-4">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-accent disabled:opacity-50"
                  onClick={() => handleUserClick(user)}
                  disabled={isLoading}
                >
                  <Avatar>
                    <AvatarImage src={user.avatar_url} alt={user.name} />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-center text-muted-foreground py-10">
              No users found.
            </p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
