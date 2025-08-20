'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCall } from '@/providers/call-provider';
import { useAppContext } from '@/providers/app-provider';
import { Phone, PhoneOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function IncomingCallNotification() {
  const {
    currentCall,
    isIncomingCall,
    acceptCall,
    declineCall,
  } = useCall();

  const { allUsers } = useAppContext();

  if (!currentCall || !isIncomingCall || currentCall.status !== 'ringing') {
    return null;
  }

  const caller = allUsers.find(user => user.id === currentCall.initiatorId);

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
      <Card className="w-80 shadow-lg border-2 border-primary">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={caller?.avatar_url} />
              <AvatarFallback>{caller?.name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold">{caller?.name}</h3>
              <p className="text-sm text-muted-foreground">
                Incoming {currentCall.type} call
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={declineCall}
              className="flex-1 gap-2"
            >
              <PhoneOff className="h-4 w-4" />
              Decline
            </Button>
            
            <Button
              variant="default"
              size="sm"
              onClick={acceptCall}
              className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
            >
              <Phone className="h-4 w-4" />
              Accept
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}