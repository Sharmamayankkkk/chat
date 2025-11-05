'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Camera } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAppContext } from '@/providers/app-provider';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { CreateStatusDialog } from '../../status/components/create-status-dialog';
import { ViewStatusDialog } from '../../status/components/view-status-dialog';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type StatusUpdate = {
    user_id: string;
    name: string;
    avatar_url: string;
    statuses: { id: number; media_url: string; created_at: string; caption?: string | null }[];
    is_all_viewed: boolean;
};

// This is the new horizontal avatar component
function StatusAvatar({ 
  update, 
  onClick, 
  isMyStatus = false 
}: { 
  update: StatusUpdate | { name: string, avatar_url: string, statuses: { created_at: string }[] }, 
  onClick: () => void, 
  isMyStatus?: boolean 
}) {
  const isViewed = (update as StatusUpdate).is_all_viewed;
  const lastStatusTime = update.statuses.length > 0 ? formatDistanceToNow(new Date(update.statuses[0].created_at), { addSuffix: true }) : 'Add status';

  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-2 w-20 text-center flex-shrink-0"
    >
      <div className="relative">
        <Avatar className={cn(
          "h-16 w-16 border-2 p-0.5", 
          isMyStatus ? 'border-transparent' : (isViewed ? 'border-border' : 'border-primary border-2')
        )}>
          <AvatarImage 
            src={isMyStatus ? update.statuses[0]?.media_url || update.avatar_url : update.avatar_url} 
            alt={update.name} 
            className="rounded-full object-cover" 
          />
          <AvatarFallback>{update.name.charAt(0)}</AvatarFallback>
        </Avatar>
        {isMyStatus && (
          <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center border-2 border-background cursor-pointer hover:scale-110 transition-transform">
            <Plus className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="text-xs font-medium truncate w-full">
        {isMyStatus ? "My Status" : update.name}
      </p>
    </button>
  );
}

export function StatusRail() {
    const { loggedInUser } = useAppContext();
    const { toast } = useToast();
    const supabase = createClient();

    const [statusUpdates, setStatusUpdates] = useState<StatusUpdate[]>([]);
    const [myStatus, setMyStatus] = useState<StatusUpdate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    
    const [viewingStatusIndex, setViewingStatusIndex] = useState<number | null>(null);
    const [isMyStatusViewing, setIsMyStatusViewing] = useState(false);

    const fetchStatuses = useCallback(async () => {
        if (!loggedInUser) return;
        
        const { data, error } = await supabase
            .from('statuses')
            .select('*, profile:user_id(*), status_views!left(viewer_id)')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            toast({ variant: 'destructive', title: 'Error fetching statuses', description: error.message });
            return;
        }

        const grouped: { [key: string]: StatusUpdate } = {};
        data.forEach((status: any) => {
            const userId = status.profile.id;
            if (!grouped[userId]) {
                grouped[userId] = {
                    user_id: userId,
                    name: status.profile.name,
                    avatar_url: status.profile.avatar_url,
                    statuses: [],
                    is_all_viewed: true,
                };
            }
            const hasViewed = status.status_views.some((view: any) => view.viewer_id === loggedInUser.id);
            if (!hasViewed && userId !== loggedInUser.id) {
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
    }, [loggedInUser, supabase, toast]);

    useEffect(() => {
        if(loggedInUser) fetchStatuses();
        
        const channel = supabase
          .channel('statuses-channel')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses' }, fetchStatuses)
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
    }, [loggedInUser, fetchStatuses, supabase]);

    const { recentUpdates, viewedUpdates } = useMemo(() => {
        const recent = statusUpdates.filter(u => !u.is_all_viewed);
        const viewed = statusUpdates.filter(u => u.is_all_viewed);
        return { recentUpdates: recent, viewedUpdates: viewed };
    }, [statusUpdates]);
    
    if (!loggedInUser) return null;
    
    const combinedUpdates = [...recentUpdates, ...viewedUpdates];

    const openStatusViewer = (index: number) => {
        setIsMyStatusViewing(false);
        setViewingStatusIndex(index);
    };

    const openMyStatusViewer = () => {
        if (myStatus) {
            setIsMyStatusViewing(true);
            setViewingStatusIndex(0); // Index for myStatus within its own list
        } else {
            setIsCreateOpen(true);
        }
    };
    
    const handleCloseViewer = () => {
        setViewingStatusIndex(null);
        setIsMyStatusViewing(false);
    }

    const myStatusForDisplay = myStatus || {
        name: loggedInUser.name,
        avatar_url: loggedInUser.avatar_url,
        statuses: [],
        user_id: loggedInUser.id,
        is_all_viewed: true,
    };
    
    return (
        <>
            <CreateStatusDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onStatusCreated={fetchStatuses} />
            <ViewStatusDialog 
                allStatusUpdates={isMyStatusViewing && myStatus ? [myStatus] : combinedUpdates}
                startIndex={viewingStatusIndex}
                open={viewingStatusIndex !== null} 
                onOpenChange={handleCloseViewer}
                onStatusViewed={fetchStatuses} 
            />

            <ScrollArea className="w-full pb-4">
                <div className="flex gap-4 px-1">
                    {isLoading ? (
                        [...Array(6)].map((_, i) => (
                            <div key={i} className="flex flex-col items-center gap-2 w-20 flex-shrink-0">
                                <Skeleton className="h-16 w-16 rounded-full" />
                                <Skeleton className="h-3 w-14" />
                            </div>
                        ))
                    ) : (
                        <>
                            <StatusAvatar 
                                update={myStatusForDisplay} 
                                onClick={openMyStatusViewer} 
                                isMyStatus 
                            />
                            {recentUpdates.map((update, idx) => (
                                <StatusAvatar 
                                    key={update.user_id} 
                                    update={update} 
                                    onClick={() => openStatusViewer(idx)} 
                                />
                            ))}
                            {viewedUpdates.map((update, idx) => (
                                <StatusAvatar 
                                    key={update.user_id} 
                                    update={update} 
                                    onClick={() => openStatusViewer(recentUpdates.length + idx)} 
                                />
                            ))}
                        </>
                    )}
                </div>
            </ScrollArea>
        </>
    );
}