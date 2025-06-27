
'use client'

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pin, X } from 'lucide-react';
import type { Message } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface PinnedMessagesDialogProps {
  messages: Message[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJumpToMessage: (messageId: number) => void;
  onUnpinMessage: (messageId: number) => void;
  isAdmin: boolean;
}

export function PinnedMessagesDialog({ 
    messages, 
    open, 
    onOpenChange, 
    onJumpToMessage,
    onUnpinMessage,
    isAdmin 
}: PinnedMessagesDialogProps) {
    
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pin className="h-5 w-5" />
            Pinned Messages
          </DialogTitle>
          <DialogDescription>
            All pinned messages in this chat are shown here.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-72 w-full mt-4">
          <div className="space-y-4 pr-4">
             {messages.length > 0 ? (
                messages.map(message => (
                    <div key={message.id} className="group relative text-sm p-3 rounded-lg border bg-muted/50 cursor-pointer hover:bg-muted" onClick={() => onJumpToMessage(message.id)}>
                        <div className="flex justify-between items-start">
                             <div className="flex items-start gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={message.profiles.avatar_url} />
                                    <AvatarFallback>{message.profiles.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{message.profiles.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}</p>
                                </div>
                            </div>
                           {isAdmin && (
                             <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUnpinMessage(message.id);
                                }}
                                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/50 flex items-center justify-center opacity-0 group-hover:opacity-100"
                            >
                                <X className="h-4 w-4" />
                            </button>
                           )}
                        </div>
                        <p className="mt-2 text-foreground/80 line-clamp-3">
                            {message.content || 'Attachment'}
                        </p>
                    </div>
                ))
            ) : (
                <div className="text-center py-10 text-muted-foreground">
                    <p>No messages have been pinned yet.</p>
                </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
