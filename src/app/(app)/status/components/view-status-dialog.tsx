
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { X, Pause, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { createClient } from '@/lib/utils';
import { useAppContext } from '@/providers/app-provider';
import { formatDistanceToNow } from 'date-fns';

type StatusUpdate = {
  user_id: string;
  name: string;
  avatar_url: string;
  statuses: { id: number; media_url: string; created_at: string }[];
};

interface ViewStatusDialogProps {
  statusUpdate: StatusUpdate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusViewed: () => void;
}

const STATUS_DURATION = 5000; // 5 seconds per status

export function ViewStatusDialog({ statusUpdate, open, onOpenChange, onStatusViewed }: ViewStatusDialogProps) {
  const { loggedInUser } = useAppContext();
  const supabase = createClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);

  const markAsViewed = useCallback(async (statusId: number) => {
    if (!loggedInUser) return;
    await supabase.from('status_views').insert({
        status_id: statusId,
        viewer_id: loggedInUser.id,
    }, { onConflict: 'status_id, viewer_id' });
    onStatusViewed();
  }, [loggedInUser, supabase, onStatusViewed]);
  
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProgress(0);
    startTimeRef.current = 0;
  }, []);
  
  const startTimer = useCallback(() => {
    resetTimer();
    if (!statusUpdate || isPaused) return;

    markAsViewed(statusUpdate.statuses[currentIndex].id);
    startTimeRef.current = Date.now();

    progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const newProgress = (elapsed / STATUS_DURATION) * 100;
        setProgress(newProgress);
    }, 100);

    timerRef.current = setTimeout(() => {
        if (currentIndex < statusUpdate.statuses.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            onOpenChange(false);
        }
    }, STATUS_DURATION);
  }, [currentIndex, isPaused, statusUpdate, onOpenChange, resetTimer, markAsViewed]);


  useEffect(() => {
    if (open && statusUpdate) {
        startTimer();
    } else {
        resetTimer();
        setCurrentIndex(0);
    }
    return resetTimer;
  }, [open, currentIndex, statusUpdate, startTimer, resetTimer]);
  
  const handlePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPaused) {
        const remainingTime = STATUS_DURATION * (1 - progress / 100);
        startTimeRef.current = Date.now() - (STATUS_DURATION - remainingTime);

        progressIntervalRef.current = setInterval(() => {
             const elapsed = Date.now() - startTimeRef.current;
             const newProgress = (elapsed / STATUS_DURATION) * 100;
             setProgress(newProgress);
        }, 100);

        timerRef.current = setTimeout(() => {
            if (statusUpdate && currentIndex < statusUpdate.statuses.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                onOpenChange(false);
            }
        }, remainingTime);
    } else {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
    setIsPaused(!isPaused);
  };
  
  const nextStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (statusUpdate && currentIndex < statusUpdate.statuses.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prevStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (!statusUpdate) return null;
  const currentStatus = statusUpdate.statuses[currentIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] sm:max-w-md w-full h-full sm:h-auto sm:aspect-[9/16] bg-black border-none p-0 overflow-hidden flex flex-col">
        <div className="absolute top-0 left-0 right-0 p-3 z-10 bg-gradient-to-b from-black/50 to-transparent">
            <div className="flex items-center gap-2 mb-2">
                {statusUpdate.statuses.map((_, index) => (
                    <Progress
                        key={index}
                        value={index < currentIndex ? 100 : index === currentIndex ? progress : 0}
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
                 <button onClick={handlePause} className="text-white">
                    {isPaused ? <Play /> : <Pause />}
                </button>
            </div>
        </div>

        <div className="relative flex-1" onMouseDown={() => setIsPaused(true)} onMouseUp={() => setIsPaused(false)} onTouchStart={() => setIsPaused(true)} onTouchEnd={() => setIsPaused(false)}>
          <Image src={currentStatus.media_url} alt={`Status from ${statusUpdate.name}`} fill className="object-contain" />
          
          <button onClick={prevStatus} className="absolute left-0 top-0 bottom-0 w-1/3 z-20" aria-label="Previous status" />
          <button onClick={nextStatus} className="absolute right-0 top-0 bottom-0 w-1/3 z-20" aria-label="Next status" />
        </div>

      </DialogContent>
    </Dialog>
  );
}
