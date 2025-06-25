
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2 } from 'lucide-react';
import { useAppContext } from '@/providers/app-provider';
import type { Message, Chat } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface ForwardMessageDialogProps {
  message: Message | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ForwardMessageDialog({ message, open, onOpenChange }: ForwardMessageDialogProps) {
  const { chats, forwardMessage, loggedInUser } = useAppContext();
  const [selectedChats, setSelectedChats] = React.useState<number[]>([]);
  const [isSending, setIsSending] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (!open) {
      setSelectedChats([]);
      setIsSending(false);
    }
  }, [open]);

  const handleShare = async () => {
    if (!message || selectedChats.length === 0) return;
    setIsSending(true);
    await forwardMessage(message, selectedChats);
    setIsSending(false);
    onOpenChange(false);
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

  // Exclude channel chats where user is not an admin, as they can't post there
  const shareableChats = chats.filter(c => {
    if (c.type === 'channel') {
        const currentUserParticipant = c.participants.find(p => p.user_id === loggedInUser?.id);
        return currentUserParticipant?.is_admin;
    }
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Forward message to...</DialogTitle>
          <DialogDescription>Select one or more chats to send this message to.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="py-4 max-h-[60vh]">
          <div className="pr-6 space-y-4">
            {shareableChats.map(c => {
              const { name, avatar } = getChatDisplayInfo(c);
              return (
              <div key={c.id} className="flex items-center space-x-3">
                <Checkbox
                  id={`share-${c.id}`}
                  checked={selectedChats.includes(c.id)}
                  onCheckedChange={(checked) => {
                    setSelectedChats(prev =>
                      checked ? [...prev, c.id] : prev.filter(id => id !== c.id)
                    );
                  }}
                />
                <Label htmlFor={`share-${c.id}`} className="flex items-center gap-3 cursor-pointer font-normal w-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={avatar} alt={name} data-ai-hint="avatar" />
                    <AvatarFallback>{name?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span>{name}</span>
                </Label>
              </div>
            )})}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>Cancel</Button>
          <Button onClick={handleShare} disabled={selectedChats.length === 0 || isSending}>
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
