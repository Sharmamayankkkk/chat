'use client';

/**
 * Incoming Call Notification Component
 * Displays a modal when receiving an incoming call
 */

import React, { useState, useEffect } from 'react';
import { Phone, Video, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import type { CallSession, CallType, User } from '@/lib/types';

interface IncomingCallNotificationProps {
  callSession: CallSession;
  caller: User;
  callType: CallType;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallNotification: React.FC<IncomingCallNotificationProps> = ({
  callSession,
  caller,
  callType,
  onAccept,
  onReject,
}) => {
  const [isRinging, setIsRinging] = useState(true);

  useEffect(() => {
    // Play ringtone (you can add an audio element here)
    const ringtoneInterval = setInterval(() => {
      setIsRinging((prev) => !prev);
    }, 1000);

    return () => {
      clearInterval(ringtoneInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="flex flex-col items-center gap-6">
          {/* Caller avatar with ringing animation */}
          <div className="relative">
            <div
              className={`absolute inset-0 rounded-full bg-primary/20 ${
                isRinging ? 'scale-125 opacity-0' : 'scale-100 opacity-100'
              } transition-all duration-1000`}
            />
            <Avatar className="h-24 w-24 ring-4 ring-primary/50">
              <AvatarImage src={caller.avatar_url} />
              <AvatarFallback className="text-3xl">{caller.name?.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>

          {/* Caller info */}
          <div>
            <h2 className="text-2xl font-bold mb-1">{caller.name}</h2>
            <p className="text-muted-foreground">
              Incoming {callType === 'audio' ? 'voice' : 'video'} call
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 mt-4">
            {/* Reject button */}
            <Button
              variant="destructive"
              size="lg"
              className="h-16 w-16 rounded-full"
              onClick={onReject}
            >
              <PhoneOff className="h-6 w-6" />
            </Button>

            {/* Accept button */}
            <Button
              variant="default"
              size="lg"
              className="h-16 w-16 rounded-full bg-green-600 hover:bg-green-700"
              onClick={onAccept}
            >
              {callType === 'audio' ? (
                <Phone className="h-6 w-6" />
              ) : (
                <Video className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
