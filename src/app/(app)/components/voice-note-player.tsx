'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceNotePlayerProps {
  src: string;
  isMyMessage: boolean;
}

const formatTime = (timeInSeconds: number) => {
  const time = Math.floor(timeInSeconds);
  if (isNaN(time)) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export function VoiceNotePlayer({ src, isMyMessage }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      if (isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('durationchange', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handlePause);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    if (audio.readyState > 0 && isFinite(audio.duration)) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('durationchange', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handlePause);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        document.querySelectorAll('audio').forEach(el => el.pause());
        audio.play().catch(e => console.error("Error playing audio:", e));
      }
    }
  };
  
  const handleSliderChange = (value: number[]) => {
      if(audioRef.current) {
          const newTime = value[0];
          audioRef.current.currentTime = newTime;
          setCurrentTime(newTime);
      }
  };

  const remainingTime = duration - currentTime;

  return (
    <div className="flex items-center gap-3 w-full max-w-[250px] py-1">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <Button 
        variant="ghost" 
        size="icon" 
        className={cn("h-10 w-10 flex-shrink-0 rounded-full", 
            isMyMessage ? "bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30" : "bg-secondary-foreground/10 text-secondary-foreground hover:bg-secondary-foreground/20"
        )} 
        onClick={togglePlayPause}
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
      </Button>
      <div className="flex flex-col gap-1.5 w-full">
        <Slider
          value={[currentTime]}
          onValueChange={handleSliderChange}
          max={duration || 1}
          step={0.1}
          className={cn(
            "[&>span:first-child]:h-1", // Track
            "[&>span:first-child>span]:h-1", // Range
            "[&>span>[role=slider]]:h-3 [&>span>[role=slider]]:w-3 [&>span>[role=slider]]:border-0", // Thumb
            isMyMessage 
              ? "[&>span>span]:bg-primary-foreground [&>span>[role=slider]]:bg-primary-foreground [&>span:first-child]:bg-primary-foreground/30"
              : "[&>span>span]:bg-primary [&>span>[role=slider]]:bg-primary [&>span:first-child]:bg-secondary-foreground/20"
          )}
        />
        <span className={cn(
          "text-xs font-mono w-full text-right self-end",
          isMyMessage ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
          {formatTime(remainingTime)}
        </span>
      </div>
    </div>
  );
}
