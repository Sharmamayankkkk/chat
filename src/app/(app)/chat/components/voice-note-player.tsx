
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AttachmentMetadata } from '@/lib/';

// Helper to format time from seconds to a "m:ss" string.
const formatTime = (timeInSeconds: number) => {
  const time = Math.floor(timeInSeconds);
  if (isNaN(time) || time < 0) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

interface VoiceNotePlayerProps {
  src: string;
  isMyMessage: boolean;
  metadata: AttachmentMetadata | null;
}

export function VoiceNotePlayer({ src, isMyMessage, metadata }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // Get duration from metadata, fallback to 0
  const [duration, setDuration] = useState(metadata?.duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Memoize the waveform from metadata.
  const waveform = React.useMemo(() => metadata?.waveform || [], [metadata]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // This event fires when the metadata (like duration) has been loaded.
    const onLoadedMetadata = () => {
      if (!isNaN(audio.duration) && audio.duration > 0 && audio.duration !== Infinity) {
        setDuration(audio.duration);
      }
    };
    
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnd = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnd);
    
    // Set initial state in case metadata is already loaded by the browser
    if (audio.readyState >= 1 && !isNaN(audio.duration) && audio.duration !== Infinity) {
        onLoadedMetadata();
    }
    
    // Cleanup: remove event listeners when the component unmounts
    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnd);
    };
  }, [src]); // Re-run effect if the audio source changes

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      document.querySelectorAll('audio').forEach(el => el !== audio && el.pause());
      // Handle the promise returned by play() to avoid interruption errors
      audio.play().then(() => {
          setIsPlaying(true);
      }).catch(e => {
        if (e.name !== 'AbortError') {
          console.error("Error playing audio:", e)
        }
        setIsPlaying(false);
      });
    }
  }, [isPlaying]);

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
  
  const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const clickPosition = event.clientX - rect.left;
    const clickRatio = clickPosition / rect.width;
    audio.currentTime = clickRatio * duration;
  };
  
  const progressPercentage = duration ? (currentTime / duration) * 100 : 0;
  
  // Define colors based on message direction for better theme integration
  const fgColor = isMyMessage ? 'hsl(var(--primary-foreground))' : 'hsl(var(--primary))';
  const bgColor = isMyMessage ? 'hsla(var(--primary-foreground), 0.3)' : 'hsl(var(--border))';
  const buttonBgColor = isMyMessage ? 'bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80';
  const textColor = isMyMessage ? 'text-primary-foreground/70' : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-2 sm:gap-3 w-full max-w-xs sm:max-w-sm">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      
      <Button 
        variant="ghost" 
        size="icon" 
        className={cn("h-10 w-10 flex-shrink-0 rounded-full", buttonBgColor)} 
        onClick={togglePlayPause}
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
      </Button>

      <div className="flex flex-1 flex-col justify-center gap-1.5 w-full min-w-0">
        <div 
            className="relative w-full h-8 cursor-pointer group"
            onClick={handleSeek}
        >
            <div className="absolute top-1/2 -translate-y-1/2 w-full h-full flex items-center gap-px">
                {waveform.length > 0 ? waveform.map((height, index) => {
                    const barProgress = (index / waveform.length) * 100;
                    const isPlayed = barProgress < progressPercentage;
                    return (
                        <div 
                            key={index} 
                            className="w-full rounded-full transition-colors duration-75"
                            style={{
                                height: `${Math.max(4, height * 100)}%`,
                                backgroundColor: isPlayed ? fgColor : bgColor
                            }}
                        />
                    );
                }) : (
                    // Fallback for when waveform data is not available
                    <div className="w-full h-1 rounded-full" style={{ backgroundColor: bgColor }}>
                        <div className="h-1 rounded-full" style={{ width: `${progressPercentage}%`, backgroundColor: fgColor }}/>
                    </div>
                )}
            </div>
             {/* Scrubber thumb */}
            <div 
                className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full shadow-md transition-all group-hover:scale-110" 
                style={{ 
                    left: `${progressPercentage}%`,
                    transform: `translateX(-${progressPercentage}%) translateY(-50%)`,
                    backgroundColor: fgColor
                }} 
            />
        </div>

        <div className="flex items-center justify-between">
          <span className={cn("text-xs font-mono", textColor)}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <button 
             onClick={togglePlaybackRate} 
             className={cn(
                "text-xs font-semibold rounded-full w-9 h-5 flex items-center justify-center transition",
                buttonBgColor
             )}
            >
              {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
}
