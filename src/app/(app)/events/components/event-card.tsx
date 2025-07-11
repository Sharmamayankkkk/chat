
'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/providers/app-provider';
import type { Event, RSVPStatus } from '@/lib/types';
import { format } from 'date-fns';
import { Calendar, Clock, Users, Check, Star, X, Link as LinkIcon, Share2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ShareEventDialog } from './share-event-dialog';
import { createClient } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function EventCard({ event, onRsvp }: { event: Event, onRsvp: () => void }) {
    const { loggedInUser, allUsers } = useAppContext();
    const { toast } = useToast();
    const supabase = createClient();
    const [isShareDialogOpen, setIsShareDialogOpen] = React.useState(false);
    
    const handleRsvp = async (status: RSVPStatus) => {
        if (!loggedInUser) return;
        
        const { error } = await supabase.from('event_rsvps').upsert({
            event_id: event.id,
            user_id: loggedInUser.id,
            status: status
        }, { onConflict: 'event_id, user_id' });

        if (error) {
            toast({ variant: 'destructive', title: 'Error RSVPing', description: error.message });
        } else {
            toast({ title: `You're now marked as ${status}!` });
            onRsvp(); // Callback to re-fetch events
        }
    };

    const handleNativeShare = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const shareData = {
            title: event.title,
            text: event.description,
            url: `${window.location.origin}/events/${event.id}`,
        };
        try {
            if (!navigator.share) throw new Error('Web Share API not available');
            await navigator.share(shareData);
        } catch (err) {
            navigator.clipboard.writeText(shareData.url);
            toast({ title: 'Link Copied!', description: "The event link has been copied to your clipboard." });
        }
    };

    const handleShareInApp = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsShareDialogOpen(true);
    };
    
    const userRsvp = event.rsvps?.find(rsvp => rsvp.user_id === loggedInUser?.id);
    const isPastEvent = new Date(event.date_time) < new Date();
    const isCancelled = event.status === 'cancelled';
    const goingCount = event.rsvps?.filter(r => r.status === 'going').length || 0;
    const interestedCount = event.rsvps?.filter(r => r.status === 'interested').length || 0;

    const rsvpUsers = (status: RSVPStatus) => 
        event.rsvps
            ?.filter(r => r.status === status)
            .map(r => allUsers.find(u => u.id === r.user_id)?.name)
            .filter(Boolean)
            .join(', ') || '';

    return (
        <>
        <ShareEventDialog event={event} open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} />
        <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
            <Link href={`/events/${event.id}`}>
                <div className="relative aspect-video">
                    <Image
                        src={event.thumbnail || 'https://placehold.co/600x400.png'}
                        alt={event.title}
                        fill
                        className={cn("object-cover", isCancelled && "grayscale")}
                        data-ai-hint="event"
                    />
                    {(isPastEvent || isCancelled) && 
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Badge variant="destructive" className="text-base">
                                {isCancelled ? 'Cancelled' : 'Past Event'}
                            </Badge>
                        </div>
                    }
                </div>
            </Link>
            <CardHeader>
                <Link href={`/events/${event.id}`} className="hover:underline">
                    <CardTitle className={cn("line-clamp-2", isCancelled && "text-muted-foreground")}>{event.title}</CardTitle>
                </Link>
                <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(event.date_time), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>{format(new Date(event.date_time), 'p')}</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{event.description}</p>
                 <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4">
                    <TooltipProvider>
                       <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1.5">
                                <Users className="h-4 w-4 text-green-500"/>
                                <span>{goingCount} Going</span>
                            </TooltipTrigger>
                            <TooltipContent>
                               <p className="max-w-xs">{rsvpUsers('going') || 'No one yet'}</p>
                            </TooltipContent>
                        </Tooltip>
                         <Tooltip>
                            <TooltipTrigger className="flex items-center gap-1.5">
                                <Star className="h-4 w-4 text-yellow-500" />
                                <span>{interestedCount} Interested</span>
                            </TooltipTrigger>
                            <TooltipContent>
                               <p className="max-w-xs">{rsvpUsers('interested') || 'No one yet'}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-2 !p-4 border-t">
                {loggedInUser && !isPastEvent && !isCancelled && (
                    <div className="grid grid-cols-3 gap-2">
                        <Button variant={userRsvp?.status === 'going' ? 'success' : 'outline'} size="sm" onClick={() => handleRsvp('going')}>
                            <Check className="mr-1.5 h-4 w-4" /> Going
                        </Button>
                        <Button variant={userRsvp?.status === 'interested' ? 'default' : 'outline'} size="sm" onClick={() => handleRsvp('interested')}>
                           <Star className="mr-1.5 h-4 w-4" /> Interested
                        </Button>
                        <Button variant={userRsvp?.status === 'not_going' ? 'destructive' : 'outline'} size="sm" onClick={() => handleRsvp('not_going')}>
                            <X className="mr-1.5 h-4 w-4" /> Can't go
                        </Button>
                    </div>
                )}
                 <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" asChild>
                        <Link href={`/events/${event.id}`}>View Details</Link>
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                             <Button variant="secondary"><Share2 className="mr-1.5 h-4 w-4" /> Share</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={handleNativeShare}>Share Externally</DropdownMenuItem>
                            <DropdownMenuItem onClick={handleShareInApp}>Share in App</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                 {event.meet_link && !isPastEvent && !isCancelled && (
                    <a href={event.meet_link} target="_blank" rel="noopener noreferrer" className="w-full">
                        <Button className="w-full">
                            <LinkIcon className="mr-1.5 h-4 w-4" /> Join Meet
                        </Button>
                    </a>
                 )}
            </CardFooter>
        </Card>
        </>
    );
}
