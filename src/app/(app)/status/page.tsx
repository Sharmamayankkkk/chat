
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Camera, Plus, Edit } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAppContext } from '@/providers/app-provider';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { CreateStatusDialog } from './components/create-status-dialog';
import { ViewStatusDialog } from './components/view-status-dialog';
import { formatDistanceToNow } from 'date-fns';

type StatusUpdate = {
    user_id: string;
    name: string;
    avatar_url: string;
    statuses: { id: number; media_url: string; created_at: string; caption?: string | null }[];
    is_all_viewed: boolean;
};

export default function StatusPage() {
    const { loggedInUser } = useAppContext();
    const { toast } = useToast();
    const supabase = createClient();

    const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
    const [myStatus, setMyStatus] = useState<StatusUpdate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [viewingStatus, setViewingStatus] = useState<StatusUpdate | null>(null);

    const fetchStatuses = async () => {
        if (!loggedInUser) return;
        
        const { data, error } = await supabase
            .from('statuses')
            .select('id, media_url, created_at, caption, profiles:user_id(*), status_views!left(viewer_id)')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            toast({ variant: 'destructive', title: 'Error fetching statuses', description: error.message });
            return;
        }

        const grouped: { [key: string]: StatusUpdate } = {};
        data.forEach((status: any) => {
            const userId = status.profiles.id;
            if (!grouped[userId]) {
                grouped[userId] = {
                    user_id: userId,
                    name: status.profiles.name,
                    avatar_url: status.profiles.avatar_url,
                    statuses: [],
                    is_all_viewed: true,
                };
            }
            const hasViewed = status.status_views.some((view: any) => view.viewer_id === loggedInUser.id);
            if (!hasViewed) {
                grouped[userId].is_all_viewed = false;
            }
            grouped[userId].statuses.push({
                id: status.id,
                media_url: status.media_url,
                created_at: status.created_at,
                caption: status.caption,
            });
        });

        const myStatusUpdate = grouped[loggedInUser.id] || null;
        if (myStatusUpdate) {
            myStatusUpdate.is_all_viewed = true;
        }
        delete grouped[loggedInUser.id];

        const allUpdates = Object.values(grouped);

        setMyStatus(myStatusUpdate);
        setStatusUpdates(allUpdates);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchStatuses();
        
        const channel = supabase
          .channel('statuses-channel')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses' }, fetchStatuses)
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
    }, [loggedInUser]);

    const { recentUpdates, viewedUpdates } = useMemo(() => {
        const recent = statusUpdates.filter(u => !u.is_all_viewed);
        const viewed = statusUpdates.filter(u => u.is_all_viewed);
        return { recentUpdates: recent, viewedUpdates: viewed };
    }, [statusUpdates]);
    
    if (!loggedInUser) return <Skeleton className="h-full w-full" />;

    const StatusRow = ({ update }: { update: StatusUpdate }) => (
        <div onClick={() => setViewingStatus(update)} className="flex items-center gap-4 cursor-pointer hover:bg-muted p-2 rounded-lg">
            <Avatar className={`h-14 w-14 border-2 ${update.is_all_viewed ? 'border-border' : 'border-primary'}`}>
                <AvatarImage src={update.avatar_url} alt={update.name} />
                <AvatarFallback>{update.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
                <p className="font-semibold">{update.name}</p>
                <p className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(update.statuses[0].created_at), { addSuffix: true })}</p>
            </div>
        </div>
    );
    
    return (
        <>
            <CreateStatusDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onStatusCreated={fetchStatuses} />
            <ViewStatusDialog statusUpdate={viewingStatus} open={!!viewingStatus} onOpenChange={() => setViewingStatus(null)} onStatusViewed={fetchStatuses} />

            <div className="flex h-full flex-col">
                <header className="flex items-center gap-4 p-4 border-b bg-background sticky top-0 z-10">
                    <SidebarTrigger className="md:hidden" />
                    <h2 className="text-xl font-bold tracking-tight">Status</h2>
                </header>
                <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                    <div onClick={() => myStatus ? setViewingStatus(myStatus) : setIsCreateOpen(true)} className="flex items-center gap-4 cursor-pointer hover:bg-muted p-2 rounded-lg">
                        <div className="relative">
                            <Avatar className="h-14 w-14">
                                <AvatarImage src={myStatus?.statuses[0]?.media_url || loggedInUser.avatar_url} alt="My Status" className="object-cover" />
                                <AvatarFallback>{loggedInUser.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center border-2 border-background">
                                <Plus className="h-4 w-4" />
                            </div>
                        </div>
                        <div>
                            <p className="font-semibold">My Status</p>
                            <p className="text-sm text-muted-foreground">
                                {myStatus ? `${myStatus.statuses.length} updates` : 'Tap to add a status update'}
                            </p>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="space-y-4 pt-4">
                           <Skeleton className="h-6 w-32" />
                           <div className="flex items-center gap-4 p-2"><Skeleton className="h-14 w-14 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-16" /></div></div>
                           <div className="flex items-center gap-4 p-2"><Skeleton className="h-14 w-14 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-3 w-24" /></div></div>
                        </div>
                    ) : (
                        <>
                            {recentUpdates.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-muted-foreground px-2">RECENT UPDATES</h3>
                                    {recentUpdates.map(update => <StatusRow key={update.user_id} update={update} />)}
                                </div>
                            )}
                            {viewedUpdates.length > 0 && (
                                <>
                                    <Separator />
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-muted-foreground px-2">VIEWED UPDATES</h3>
                                        {viewedUpdates.map(update => <StatusRow key={update.user_id} update={update} />)}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </main>
            </div>
        </>
    );
}
