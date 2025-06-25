
'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useAppContext } from '@/providers/app-provider';
import { CreateEventDialog } from './components/create-event-dialog';
import { EventCard } from './components/event-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

function EventsPageLoader() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <Skeleton className="aspect-video w-full" />
            <CardHeader>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function EventsPage() {
    const { loggedInUser, events, isReady } = useAppContext();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    
    const { upcomingEvents, pastEvents } = useMemo(() => {
        const now = new Date();
        const upcoming: any[] = [];
        const past: any[] = [];

        events.forEach(event => {
            if (new Date(event.date_time) >= now) {
                upcoming.push(event);
            } else {
                past.push(event);
            }
        });
        
        upcoming.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
        past.sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());

        return { upcomingEvents: upcoming, pastEvents: past };
    }, [events]);

    return (
        <>
            {loggedInUser?.is_admin && <CreateEventDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />}
            <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
                <div className="flex items-center justify-between space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Events</h2>
                    {loggedInUser?.is_admin && (
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create Event
                        </Button>
                    )}
                </div>

                {!isReady ? (
                    <EventsPageLoader />
                ) : (
                    <div className="space-y-8">
                        <section>
                            <h3 className="text-2xl font-semibold tracking-tight mb-4">Upcoming Events</h3>
                            {upcomingEvents.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {upcomingEvents.map(event => <EventCard key={event.id} event={event} />)}
                                </div>
                            ) : (
                                <Card className="flex flex-col items-center justify-center p-12 text-center">
                                    <CardHeader>
                                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                                            <Calendar className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <CardTitle>No Upcoming Events</CardTitle>
                                        <CardDescription>Check back later for new events.</CardDescription>
                                    </CardHeader>
                                </Card>
                            )}
                        </section>
                        <section>
                            <h3 className="text-2xl font-semibold tracking-tight mb-4">Past Events</h3>
                             {pastEvents.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {pastEvents.map(event => <EventCard key={event.id} event={event} />)}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No past events to show.</p>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </>
    );
}
