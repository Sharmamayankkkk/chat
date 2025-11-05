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
import type { User, Chat } from '@/lib/'
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
  
  // --- UPDATED: Get allUsers and relationships from context ---
  const { loggedInUser, chats, addChat, allUsers, relationships, isReady } = useAppContext();
  // --- END UPDATE ---

  const [isLoading, setIsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const supabase = createClient();

  // --- REMOVED: useEffect for fetching all users ---
  // We no longer need this, as allUsers is now provided by AppProvider
  // --- END REMOVAL ---
  
  React.useEffect(() => {
    // Clear search when dialog is closed
    if (!open) {
      setSearchQuery('');
    }
  }, [open]);

  // This function is still valid. It will only be called for users
  // we are allowed to message (thanks to the logic in `filteredUsers`).
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
        setIsLoading(false);
        return;
    }

    // 2. If not, create a new DM chat
    try {
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .insert({ type: 'dm', created_by: loggedInUser.id }) // Set the creator
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
          description: `Database error: ${error.message}.`
        });
    } finally {
        setIsLoading(false);
    }
  }

  // --- UPDATED: filteredUsers logic ---
  // This is the most important change.
  const filteredUsers = React.useMemo(() => {
    if (!loggedInUser || !allUsers || !relationships) return [];

    // 1. Get all users *except* the logged-in user
    const otherUsers = allUsers.filter(u => u.id !== loggedInUser.id);

    // 2. Find users with a mutual, approved follow
    const usersToShow = otherUsers.filter(user => {
      // Check: Do I follow them?
      const iFollowThem = relationships.some(r => 
        r.user_one_id === loggedInUser.id && 
        r.user_two_id === user.id && 
        r.status === 'approved'
      );
      
      // Check: Do they follow me?
      const theyFollowMe = relationships.some(r => 
        r.user_one_id === user.id && 
        r.user_two_id === loggedInUser.id && 
        r.status === 'approved'
      );
      
      // You can only message if both are true
      return iFollowThem && theyFollowMe;
    });

    // 3. Apply search query to the pre-filtered list
    if (!searchQuery) return usersToShow;

    const lowercasedQuery = searchQuery.toLowerCase();
    return usersToShow.filter(user =>
      user.name.toLowerCase().includes(lowercasedQuery) ||
      (user.username && user.username.toLowerCase().includes(lowercasedQuery))
    );
  }, [allUsers, relationships, loggedInUser, searchQuery]);
  // --- END UPDATE ---


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          {/* UPDATED Description */}
          <DialogDescription>
            Select a mutual follower to start a conversation.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search mutual followers..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <ScrollArea className="h-72 w-full mt-4">
          {/* Use isReady from context to know when users are loaded */}
          {!isReady ? (
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
            // UPDATED empty state message
            <p className="text-sm text-center text-muted-foreground py-10">
              No mutual followers found.
            </p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}