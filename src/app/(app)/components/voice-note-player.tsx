
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AttachmentMetadata } from '@/lib/types';

interface VoiceNotePlayerProps {
  src: string;
  isMyMessage: boolean;
  metadata: AttachmentMetadata | null;
}

// Helper to format time from seconds to a "m:ss" string.
const formatTime = (timeInSeconds: number) => {
  const time = Math.floor(timeInSeconds);
  if (isNaN(time) || time < 0) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export function VoiceNotePlayer({ src, isMyMessage, metadata }: VoiceNotePlayerProps) {
  // `useRef` is a React hook to hold a reference to the actual <audio> DOM element.
  const audioRef = useRef<HTMLAudioElement>(null);
  // `useState` hooks manage the component's state, causing it to re-render when state changes.
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Memoize the waveform and duration from metadata to prevent re-calculation on every render.
  const { waveform, duration } = React.useMemo(() => ({
      waveform: metadata?.waveform || [],
      duration: metadata?.duration || 0,
  }), [metadata]);

  // This `useEffect` hook is crucial for managing the audio element's lifecycle.
  // It runs once when the component mounts and sets up event listeners.
  // The returned function is a "cleanup" function that runs when the component unmounts.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnd = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnd);
    
    // Set initial state from the audio element in case it's already loaded.
    if (!isNaN(audio.duration)) {
      setCurrentTime(audio.currentTime);
    }
    
    // Cleanup: remove event listeners when the component unmounts to prevent memory leaks.
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnd);
    };
  }, []); // The empty dependency array `[]` means this effect runs only once on mount.

  // This function handles playing and pausing the audio.
  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // Before playing this audio, pause any other audio elements currently playing on the page.
      document.querySelectorAll('audio').forEach(el => {
        if (el !== audio) el.pause();
      });
      // The .play() method returns a Promise. We catch potential errors.
      // This specifically handles the "request was interrupted" error.
      audio.play().catch(e => console.error("Error playing audio:", e));
      setIsPlaying(true);
    }
  }, [isPlaying]);

  // This function cycles through different playback speeds.
  const togglePlaybackRate = useCallback(() => {
    const rates = [1, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    const newRate = rates[nextIndex];
    if(audioRef.current) {
        audioRef.current.playbackRate = newRate;
    }
    setPlaybackRate(newRate);
  }, [playbackRate]);
  
  // This function allows the user to seek to a specific time by clicking on the waveform.
  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickPosition = event.clientX - rect.left;
    const clickRatio = clickPosition / rect.width;
    const newTime = clickRatio * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };
  
  // Calculate the progress of the playback as a percentage.
  const progressPercentage = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 sm:gap-3 w-full max-w-xs sm:max-w-sm">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      
      <Button 
        variant="ghost" 
        size="icon" 
        className={cn(
          "h-10 w-10 flex-shrink-0 rounded-full", 
          isMyMessage 
            ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30" 
            : "bg-secondary-foreground/10 text-secondary-foreground hover:bg-secondary-foreground/20"
        )} 
        onClick={togglePlayPause}
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
      </Button>

      <div className="flex flex-col flex-1 gap-1 w-full min-w-0">
        <div className="flex items-center gap-1.5 h-8 w-full" onClick={handleSeek}>
          {waveform.map((height, index) => {
            const barProgress = (index / waveform.length) * 100;
            const isPlayed = barProgress < progressPercentage;
            return (
              <div 
                key={index} 
                className="w-full h-full rounded-full transition-colors duration-75"
                style={{
                  height: `${height * 100}%`,
                  minHeight: '4px',
                  backgroundColor: isMyMessage 
                    ? (isPlayed ? 'hsl(var(--primary-foreground))' : 'hsla(var(--primary-foreground), 0.3)')
                    : (isPlayed ? 'hsl(var(--primary))' : 'hsl(var(--border))')
                }}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-xs font-mono w-full self-end",
            isMyMessage ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <button 
             onClick={togglePlaybackRate} 
             className={cn(
                "text-xs font-semibold rounded-full w-9 h-5 flex items-center justify-center transition",
                isMyMessage 
                    ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/40" 
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
             )}
            >
              {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
}
