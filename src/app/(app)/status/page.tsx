
'use client';

import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Camera, Edit } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAppContext } from '@/providers/app-provider';
import { Separator } from '@/components/ui/separator';

export default function StatusPage() {
    const { loggedInUser } = useAppContext();

    // Placeholder data - we will replace this with real data later
    const recentUpdates = [
        { id: '1', name: 'Alice', avatar_url: 'https://placehold.co/100x100.png', time: '15 minutes ago' },
        { id: '2', name: 'Bob', avatar_url: 'https://placehold.co/100x100.png', time: '1 hour ago' },
    ];
    
    const viewedUpdates = [
        { id: '3', name: 'Charlie', avatar_url: 'https://placehold.co/100x100.png', time: '3 hours ago' },
    ];

    if (!loggedInUser) {
        return null; // Or a loading skeleton
    }

    return (
        <div className="flex h-full flex-col">
            <header className="flex items-center gap-4 p-4 border-b bg-background sticky top-0 z-10">
                <SidebarTrigger className="md:hidden" />
                <h2 className="text-xl font-bold tracking-tight">Status</h2>
                <div className="ml-auto flex items-center gap-2">
                    <Button variant="ghost" size="icon">
                        <Edit className="h-5 w-5" />
                        <span className="sr-only">Create text status</span>
                    </Button>
                    <Button variant="ghost" size="icon">
                        <Camera className="h-5 w-5" />
                        <span className="sr-only">Create media status</span>
                    </Button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                <div className="flex items-center gap-4 cursor-pointer hover:bg-muted p-2 rounded-lg">
                    <div className="relative">
                        <Avatar className="h-14 w-14 border-2 border-dashed border-primary">
                            <AvatarImage src={loggedInUser.avatar_url} alt="My Status" />
                            <AvatarFallback>{loggedInUser.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                         <div className="absolute bottom-0 right-0 h-6 w-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center border-2 border-background">
                            <Camera className="h-3 w-3" />
                        </div>
                    </div>
                    <div>
                        <p className="font-semibold">My Status</p>
                        <p className="text-sm text-muted-foreground">Tap to add a status update</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground px-2">RECENT UPDATES</h3>
                    {recentUpdates.map(update => (
                        <div key={update.id} className="flex items-center gap-4 cursor-pointer hover:bg-muted p-2 rounded-lg">
                            <Avatar className="h-14 w-14 border-2 border-primary">
                                <AvatarImage src={update.avatar_url} alt={update.name} />
                                <AvatarFallback>{update.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-semibold">{update.name}</p>
                                <p className="text-sm text-muted-foreground">{update.time}</p>
                            </div>
                        </div>
                    ))}
                </div>

                 <Separator />

                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground px-2">VIEWED UPDATES</h3>
                     {viewedUpdates.map(update => (
                        <div key={update.id} className="flex items-center gap-4 cursor-pointer hover:bg-muted p-2 rounded-lg">
                            <Avatar className="h-14 w-14 border-2 border-border">
                                <AvatarImage src={update.avatar_url} alt={update.name} />
                                <AvatarFallback>{update.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-semibold">{update.name}</p>
                                <p className="text-sm text-muted-foreground">{update.time}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
