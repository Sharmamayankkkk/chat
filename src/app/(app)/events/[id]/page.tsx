
'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Calendar, Check, Clock, Link as LinkIcon, Share2, Star, Users, X } from 'lucide-react';
import { useAppContext } from '@/providers/app-provider';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { notFound } from 'next/navigation';
import type { Event, RSVPStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CreateEventDialog } from '../components/create-event-dialog';
import { ShareEventDialog } from '../components/share-event-dialog';
import { createClient } from '@/lib/utils';

function EventDetailsLoader() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center gap-4">
                <Skeleton className="h-9 w-9" />
                <Skeleton className="h-8 w-64" />
            </div>
            <div className="grid gap-8 md:grid-cols-3">
                <div className="md:col-span-2 space-y-8">
                    <Skeleton className="aspect-video w-full rounded-lg" />
                    <Skeleton className="h-48 w-full rounded-lg" />
                </div>
                <div className="md:col-span-1 space-y-8">
                    <Skeleton className="h-64 w-full rounded-lg" />
                    <Skeleton className="h-48 w-full rounded-lg" />
                </div>
            </div>
        </div>
    );
}


export default function EventDetailsPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const supabase = createClient();
    const { toast } = useToast();
    const { loggedInUser, allUsers } = useAppContext();
    
    const [event, setEvent] = React.useState<Event | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isShareOpen, setIsShareOpen] = React.useState(false);
    const [isEditOpen, setIsEditOpen] = React.useState(false);

    const fetchEvent = React.useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('events')
            .select('*, rsvps:event_rsvps(*, profiles!user_id(*)), profiles:creator_id(*)')
            .eq('id', params.id)
            .single();

        if (error || !data) {
            toast({ variant: 'destructive', title: 'Error fetching event details' });
            setEvent(null);
        } else {
            setEvent(data as Event);
        }
        setIsLoading(false);
    }, [params.id, supabase, toast]);

    React.useEffect(() => {
        fetchEvent();
    }, [fetchEvent]);
    
    if (isLoading) return <EventDetailsLoader />;
    if (!event) notFound();

    const isPastEvent = new Date(event.date_time) < new Date();
    const userRsvp = event.rsvps?.find(rsvp => rsvp.user_id === loggedInUser?.id);
    const isAdmin = loggedInUser?.is_admin || loggedInUser?.id === event.creator_id;
    
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
            fetchEvent(); // Re-fetch to update UI
        }
    };
    
    const rsvpLists = {
        going: event.rsvps?.filter(r => r.status === 'going').map(r => r.profiles).filter(Boolean) as any[],
        interested: event.rsvps?.filter(r => r.status === 'interested').map(r => r.profiles).filter(Boolean) as any[],
    };

    return (
        <>
            <ShareEventDialog event={event} open={isShareOpen} onOpenChange={setIsShareOpen} />
            {isAdmin && <CreateEventDialog open={isEditOpen} onOpenChange={setIsEditOpen} eventToEdit={event} onEventUpdated={fetchEvent} onEventCreated={() => {}} />}

            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-5 w-5" />
                            <span className="sr-only">Back</span>
                        </Button>
                        <h2 className="text-3xl font-bold tracking-tight">{event.title}</h2>
                    </div>
                    {isAdmin && <Button variant="outline" onClick={() => setIsEditOpen(true)}>Edit Event</Button>}
                </div>
                
                <div className="grid gap-8 md:grid-cols-3">
                    <div className="md:col-span-2 space-y-8">
                        <Card className="overflow-hidden">
                            <div className="relative aspect-video">
                                <Image src={event.thumbnail || "https://placehold.co/600x400.png"} alt={event.title} fill className="object-cover" data-ai-hint="event" />
                            </div>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>About this event</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-foreground whitespace-pre-wrap">{event.description}</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="md:col-span-1 space-y-8">
                        <Card>
                            <CardContent className="p-6 space-y-4">
                                <div className="flex items-start gap-4">
                                    <Calendar className="h-6 w-6 mt-1 text-primary" />
                                    <div>
                                        <p className="font-semibold">{format(new Date(event.date_time), 'eeee, MMMM d, yyyy')}</p>
                                        <p className="text-muted-foreground">{format(new Date(event.date_time), 'p')}</p>
                                    </div>
                                </div>
                                {event.meet_link && (
                                     <div className="flex items-start gap-4">
                                        <LinkIcon className="h-6 w-6 mt-1 text-primary" />
                                        <div>
                                            <p className="font-semibold">Online Event</p>
                                            <a href={event.meet_link} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:underline break-all">
                                                {event.meet_link}
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                             {!isPastEvent && (
                                <CardFooter className="flex-col items-stretch gap-2">
                                    <div className="grid grid-cols-3 gap-2">
                                        <Button variant={userRsvp?.status === 'going' ? 'success' : 'outline'} size="sm" onClick={() => handleRsvp('going')}><Check className="mr-1.5 h-4 w-4" /> Going</Button>
                                        <Button variant={userRsvp?.status === 'interested' ? 'default' : 'outline'} size="sm" onClick={() => handleRsvp('interested')}><Star className="mr-1.5 h-4 w-4" /> Interested</Button>
                                        <Button variant={userRsvp?.status === 'not_going' ? 'destructive' : 'outline'} size="sm" onClick={() => handleRsvp('not_going')}><X className="mr-1.5 h-4 w-4" /> Can't go</Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {event.meet_link && <Button asChild><a href={event.meet_link} target="_blank" rel="noopener noreferrer"><LinkIcon className="mr-1.5 h-4 w-4" />Join Meet</a></Button>}
                                        <Button variant="secondary" onClick={() => setIsShareOpen(true)}><Share2 className="mr-1.5 h-4 w-4"/> Share</Button>
                                    </div>
                                </CardFooter>
                             )}
                        </Card>
                        
                        <Card>
                             <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> RSVPs</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h4 className="font-semibold mb-2">{rsvpLists.going.length} Going</h4>
                                    {rsvpLists.going.length > 0 ? (
                                        <div className="space-y-3">
                                            {rsvpLists.going.map(u => (
                                                <Link key={u.id} href={`/profile/${u.username}`} className="flex items-center gap-2 hover:bg-accent p-1 rounded-md">
                                                    <Avatar className="h-8 w-8"><AvatarImage src={u.avatar_url} /><AvatarFallback>{u.name.charAt(0)}</AvatarFallback></Avatar>
                                                    <span>{u.name}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    ) : <p className="text-sm text-muted-foreground">No one has RSVP'd as going yet.</p>}
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">{rsvpLists.interested.length} Interested</h4>
                                    {rsvpLists.interested.length > 0 ? (
                                        <div className="space-y-3">
                                            {rsvpLists.interested.map(u => (
                                                <Link key={u.id} href={`/profile/${u.username}`} className="flex items-center gap-2 hover:bg-accent p-1 rounded-md">
                                                    <Avatar className="h-8 w-8"><AvatarImage src={u.avatar_url} /><AvatarFallback>{u.name.charAt(0)}</AvatarFallback></Avatar>
                                                    <span>{u.name}</span>
                                                </Link>
                                            ))}
                                        </div>
                                    ) : <p className="text-sm text-muted-foreground">No one has RSVP'd as interested yet.</p>}
                                </div>
                            </CardContent>
                        </Card>

                    </div>
                </div>
            </div>
        </>
    );
}
