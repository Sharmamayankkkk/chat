
'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAppContext } from "@/providers/app-provider";
import { formatDistanceToNow } from 'date-fns';
import { Star, MessageSquare, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import React from 'react';
import type { Message, Chat } from '@/lib/types';
import { createClient } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface StarredMessage extends Message {
  chat: Partial<Chat>;
}

function StarredPageLoader() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className='space-y-2'>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function StarredMessagesPage() {
  const { loggedInUser, isReady } = useAppContext();
  const router = useRouter();
  const [starredMessages, setStarredMessages] = React.useState<StarredMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const supabase = createClient();

  React.useEffect(() => {
    if (!isReady) return;

    const fetchStarredMessages = async () => {
      if (!loggedInUser) {
        setIsLoading(false);
        return;
      }

      // First, get all chat IDs the user is a part of
      const { data: participantData, error: participantError } = await supabase
        .from('participants')
        .select('chat_id')
        .eq('user_id', loggedInUser.id);
      
      if (participantError) {
        console.error("Error fetching user's chats:", participantError);
        setIsLoading(false);
        return;
      }
      
      const chatIds = participantData.map(p => p.chat_id);
      
      if (chatIds.length === 0) {
        setIsLoading(false);
        return;
      }
      
      // Then, fetch starred messages from those chats
      const { data, error } = await supabase
        .from('messages')
        .select('*, profiles:user_id(*), chat:chat_id(*)')
        .eq('is_starred', true)
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching starred messages:", error);
      } else {
        setStarredMessages(data as any as StarredMessage[]);
      }
      setIsLoading(false);
    };

    fetchStarredMessages();
  }, [loggedInUser, isReady, supabase]);
  
  const handleGoToMessage = (chatId: number, messageId: number) => {
    router.push(`/chat/${chatId}?highlight=${messageId}`);
  };


  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back</span>
            </Button>
            <div className="flex items-center gap-2">
                <Star className="h-8 w-8 text-amber-500 fill-amber-400" />
                <h2 className="text-3xl font-bold tracking-tight">Starred Messages</h2>
            </div>
        </div>
      </div>
      
      {isLoading ? (
        <StarredPageLoader />
      ) : starredMessages.length > 0 ? (
        <div className="space-y-4">
            {starredMessages.map(message => (
                <Card key={message.id}>
                    <CardHeader className="pb-2">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={message.profiles.avatar_url} alt={message.profiles.name} data-ai-hint="avatar" />
                                    <AvatarFallback>{message.profiles.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{message.profiles.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        in <Link href={`/chat/${message.chat_id}`} className="font-medium hover:underline">{message.chat.name || 'DM'}</Link>
                                    </p>
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                            </div>
                         </div>
                    </CardHeader>
                    <CardContent>
                        <p className="whitespace-pre-wrap text-foreground/90">{message.content}</p>
                        <div className="mt-4 flex justify-end">
                             <Button variant="outline" size="sm" onClick={() => handleGoToMessage(message.chat_id, message.id)}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Go to message
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
            <CardHeader>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                    <Star className="h-8 w-8 text-muted-foreground" />
                </div>
                <CardTitle>No Starred Messages</CardTitle>
                <CardDescription>
                    You can star important messages to keep track of them here.
                </CardDescription>
            </CardHeader>
        </Card>
      )}

    </div>
  );
}
