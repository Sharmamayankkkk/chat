
'use client'

import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCheck } from 'lucide-react';
import type { Message, Chat, Participant, User } from '@/lib/types';

interface MessageInfoDialogProps {
  message: Message;
  chat: Chat;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MessageInfoDialog({ message, chat, open, onOpenChange }: MessageInfoDialogProps) {
  
  const { readBy, deliveredTo } = useMemo(() => {
    if (!message || !chat.participants) {
      return { readBy: [], deliveredTo: [] };
    }

    const readerIds = new Set(message.read_by || []);
    const otherParticipants = chat.participants.filter(p => p.user_id !== message.user_id);

    const readers: User[] = [];
    const notReaders: User[] = [];

    otherParticipants.forEach(p => {
      if (readerIds.has(p.user_id)) {
        readers.push(p.profiles);
      } else {
        notReaders.push(p.profiles);
      }
    });

    return { readBy: readers, deliveredTo: notReaders };
  }, [message, chat]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Message Info</DialogTitle>
          <DialogDescription>See who has read and received your message.</DialogDescription>
        </DialogHeader>

        <div className="my-4 p-3 rounded-lg border bg-muted">
            <p className="text-sm line-clamp-3">
                {message.content || 'Attachment'}
            </p>
        </div>

        <Tabs defaultValue="read_by">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="read_by">Read By ({readBy.length})</TabsTrigger>
                <TabsTrigger value="delivered_to">Delivered To ({deliveredTo.length})</TabsTrigger>
            </TabsList>
            <ScrollArea className="h-60 mt-4">
                <TabsContent value="read_by">
                    {readBy.length > 0 ? (
                        readBy.map(user => (
                            <div key={user.id} className="flex items-center justify-between p-2 rounded-md">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={user.avatar_url} />
                                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span>{user.name}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-sm text-muted-foreground pt-10">No one has read this message yet.</p>
                    )}
                </TabsContent>
                <TabsContent value="delivered_to">
                     {deliveredTo.length > 0 ? (
                        deliveredTo.map(user => (
                            <div key={user.id} className="flex items-center justify-between p-2 rounded-md">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={user.avatar_url} />
                                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span>{user.name}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center text-muted-foreground pt-10">
                            <CheckCheck className="h-10 w-10 mb-4 text-green-500"/>
                            <p>Delivered to everyone.</p>
                        </div>
                    )}
                </TabsContent>
            </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
