
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { X, Pause, Play, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import Image from 'next/image';
import { createClient } from '@/lib/utils';
import { useAppContext } from '@/providers/app-provider';
import { formatDistanceToNow } from 'date-fns';
import type { User } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

type StatusUpdate = {
  user_id: string;
  name: string;
  avatar_url: string;
  statuses: { id: number; media_url: string; created_at: string; caption?: string | null }[];
};

interface ViewStatusDialogProps {
  allStatusUpdates: StatusUpdate[];
  startIndex: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusViewed: () => void;
}

const STATUS_DURATION = 5000; // 5 seconds per status

function ViewersSheet({ statusId, viewCount }: { statusId: number, viewCount: number }) {
    const [viewers, setViewers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const supabase = createClient();

    const fetchViewers = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('status_views')
            .select('profiles:viewer_id(*)')
            .eq('status_id', statusId);
        
        if (!error && data) {
            setViewers(data.map(d => d.profiles) as User[]);
        }
        setIsLoading(false);
    }

    return (
        <Sheet>
            <SheetTrigger asChild>
                <button 
                    onClick={fetchViewers}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 text-white bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm"
                >
                    <Eye className="h-4 w-4" />
                    <span>{viewCount}</span>
                </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-lg">
                <SheetHeader>
                    <SheetTitle>Viewed by</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-64 mt-4">
                    {isLoading ? (
                        <p>Loading...</p>
                    ) : viewers.length > 0 ? (
                        <div className="space-y-4">
                            {viewers.map(viewer => (
                                <div key={viewer.id} className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={viewer.avatar_url} />
                                        <AvatarFallback>{viewer.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <p className="font-semibold">{viewer.name}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground pt-10">No views yet.</p>
                    )}
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}

export function ViewStatusDialog({ allStatusUpdates, startIndex, open, onOpenChange, onStatusViewed }: ViewStatusDialogProps) {
  const { loggedInUser } = useAppContext();
  const supabase = createClient();

  const [currentUserIndex, setCurrentUserIndex] = useState(startIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [viewCount, setViewCount] = useState(0);

  const animationFrameRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);
  const elapsedTimeRef = useRef(0);
  
  const statusUpdate = (currentUserIndex !== null) ? allStatusUpdates[currentUserIndex] : null;
  const currentStatus = statusUpdate?.statuses[currentStoryIndex];

  const markAsViewed = useCallback(async (statusId: number) => {
    if (!loggedInUser || !statusUpdate || loggedInUser.id === statusUpdate.user_id) return;
    await supabase.from('status_views').insert({
        status_id: statusId,
        viewer_id: loggedInUser.id,
    }, { onConflict: 'status_id, viewer_id' });
    onStatusViewed();
  }, [loggedInUser, supabase, onStatusViewed, statusUpdate]);

  const fetchViewCount = useCallback(async (statusId: number) => {
      const { count } = await supabase
        .from('status_views')
        .select('*', { count: 'exact', head: true })
        .eq('status_id', statusId);
      setViewCount(count || 0);
  }, [supabase]);
  
  const stopTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const goToNextStory = useCallback(() => {
    if (statusUpdate && currentStoryIndex < statusUpdate.statuses.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else {
      goToNextUser();
    }
  }, [statusUpdate, currentStoryIndex]);
  
  const goToNextUser = useCallback(() => {
    if (currentUserIndex !== null && currentUserIndex < allStatusUpdates.length - 1) {
        setCurrentUserIndex(prev => prev! + 1);
        setCurrentStoryIndex(0);
    } else {
        onOpenChange(false);
    }
  }, [currentUserIndex, allStatusUpdates.length, onOpenChange]);

  const startTimer = useCallback(() => {
    stopTimer();
    if (!currentStatus || isPaused) return;

    markAsViewed(currentStatus.id);
    if (loggedInUser?.id === statusUpdate?.user_id) {
        fetchViewCount(currentStatus.id);
    }
    
    startTimeRef.current = performance.now() - elapsedTimeRef.current;

    const animate = (time: number) => {
      elapsedTimeRef.current = time - startTimeRef.current;
      const newProgress = (elapsedTimeRef.current / STATUS_DURATION) * 100;
      setProgress(newProgress);

      if (elapsedTimeRef.current < STATUS_DURATION) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    animationFrameRef.current = requestAnimationFrame(animate);

    timeoutRef.current = setTimeout(goToNextStory, STATUS_DURATION - elapsedTimeRef.current);
  }, [currentStatus, isPaused, stopTimer, markAsViewed, fetchViewCount, loggedInUser, statusUpdate, goToNextStory]);
  
  // Effect to handle opening/closing and user switching
  useEffect(() => {
    if (open && startIndex !== null) {
      setCurrentUserIndex(startIndex);
      setCurrentStoryIndex(0);
    } else {
      stopTimer();
    }
  }, [open, startIndex, stopTimer]);
  
  // Effect to handle story and user index changes
  useEffect(() => {
    if (open && currentUserIndex !== null) {
        setProgress(0);
        elapsedTimeRef.current = 0;
        startTimer();
    }
    return stopTimer;
  }, [open, currentUserIndex, currentStoryIndex, startTimer, stopTimer]);
  
  const handlePausePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsPaused(prev => !prev);
  };
  
  const goToPrevUser = () => {
    if (currentUserIndex !== null && currentUserIndex > 0) {
      setCurrentUserIndex(prev => prev! - 1);
      setCurrentStoryIndex(0);
    }
  };

  useEffect(() => {
    if (isPaused) {
      stopTimer();
      elapsedTimeRef.current = (progress / 100) * STATUS_DURATION;
    } else if (open) {
      startTimer();
    }
  }, [isPaused, open, startTimer, stopTimer, progress]);

  if (!statusUpdate || !currentStatus) return null;
  const isMyStatus = loggedInUser?.id === statusUpdate.user_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] sm:max-w-md w-full h-full sm:h-auto sm:aspect-[9/16] bg-black border-none p-0 overflow-hidden flex flex-col data-[state=open]:!animate-none data-[state=closed]:!animate-none">
        <DialogTitle className="sr-only">Status from {statusUpdate.name}</DialogTitle>
        <DialogDescription className="sr-only">Viewing status update. Press escape to close.</DialogDescription>
        
        <div className="absolute top-0 left-0 right-0 p-3 z-20 bg-gradient-to-b from-black/50 to-transparent">
            <div className="flex items-center gap-2 mb-2">
                {statusUpdate.statuses.map((_, index) => (
                    <Progress
                        key={index}
                        value={index < currentStoryIndex ? 100 : index === currentStoryIndex ? progress : 0}
                        className="h-1 flex-1 bg-white/30"
                    />
                ))}
            </div>
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={statusUpdate.avatar_url} />
                        <AvatarFallback>{statusUpdate.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold text-white">{statusUpdate.name}</p>
                        <p className="text-xs text-white/80">{formatDistanceToNow(new Date(currentStatus.created_at), { addSuffix: true })}</p>
                    </div>
                </div>
                <div className="flex items-center">
                    <button onClick={handlePausePlay} className="text-white p-2">
                        {isPaused ? <Play /> : <Pause />}
                    </button>
                    <button onClick={() => onOpenChange(false)} className="text-white p-2">
                        <X />
                    </button>
                </div>
            </div>
        </div>

        <div className="relative flex-1 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <div className="absolute inset-0" onMouseDown={() => setIsPaused(true)} onMouseUp={() => setIsPaused(false)} onTouchStart={() => setIsPaused(true)} onTouchEnd={() => setIsPaused(false)} />
          {currentStatus?.media_url && <Image src={currentStatus.media_url} alt={`Status from ${statusUpdate.name}`} fill className="object-contain" />}
          
          {/* Navigation Buttons */}
          {currentUserIndex !== null && currentUserIndex > 0 && (
            <button onClick={goToPrevUser} className="absolute left-2 top-1/2 -translate-y-1/2 z-30 bg-black/30 text-white rounded-full p-1">
              <ChevronLeft size={24} />
            </button>
          )}
          {currentUserIndex !== null && currentUserIndex < allStatusUpdates.length - 1 && (
            <button onClick={goToNextUser} className="absolute right-2 top-1/2 -translate-y-1/2 z-30 bg-black/30 text-white rounded-full p-1">
              <ChevronRight size={24} />
            </button>
          )}
          
          <button onClick={(e) => { e.stopPropagation(); setCurrentStoryIndex(p => Math.max(0, p - 1))}} className="absolute left-0 top-0 bottom-0 w-1/3 z-20" aria-label="Previous story" />
          <button onClick={(e) => { e.stopPropagation(); goToNextStory() }} className="absolute right-0 top-0 bottom-0 w-1/3 z-20" aria-label="Next story" />


          {currentStatus.caption && (
            <div className="absolute bottom-0 left-0 right-0 p-4 pb-16 bg-gradient-to-t from-black/70 to-transparent z-10">
                <p className="text-white text-center text-sm drop-shadow-md">{currentStatus.caption}</p>
            </div>
          )}

          {isMyStatus && <ViewersSheet statusId={currentStatus.id} viewCount={viewCount} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
