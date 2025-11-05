
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2 } from 'lucide-react';
import { useAppContext } from '@/providers/app-provider';
import type { Event, Chat } from '@/lib/';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/utils';

interface ShareEventDialogProps {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareEventDialog({ event, open, onOpenChange }: ShareEventDialogProps) {
  const { chats, loggedInUser } = useAppContext();
  const [selectedChats, setSelectedChats] = React.useState<number[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  React.useEffect(() => {
    if (!open) {
      setSelectedChats([]);
      setIsLoading(false);
    }
  }, [open]);

  const handleShare = async () => {
    if (!event || selectedChats.length === 0 || !loggedInUser) return;
    setIsLoading(true);

    const sharePromises = selectedChats.map(chatId => {
      return supabase.from('messages').insert({
        chat_id: chatId,
        user_id: loggedInUser.id,
        content: `Check out this event: ${event.title}`,
        attachment_url: event.thumbnail, 
        attachment_metadata: {
            type: 'event_share',
            name: event.title,
            size: 0,
            eventId: event.id,
            eventDate: event.date_time,
            eventThumbnail: event.thumbnail,
        },
      });
    });

    try {
      const results = await Promise.all(sharePromises);
      const failed = results.filter(r => r.error);
      if (failed.length > 0) {
        toast({ variant: 'destructive', title: 'Some shares failed', description: `Could not share in ${failed.length} chats.` });
      } else {
        toast({ title: 'Event Shared!', description: `Successfully shared in ${selectedChats.length} chat(s).` });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error sharing event', description: error.message });
    }
    
    setIsLoading(false);
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
          <DialogTitle>Share event in app...</DialogTitle>
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
              )
            })}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleShare} disabled={selectedChats.length === 0 || isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
