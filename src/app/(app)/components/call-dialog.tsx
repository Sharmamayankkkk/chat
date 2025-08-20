'use client';

import React, { useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCall } from '@/providers/call-provider';
import { useAppContext } from '@/providers/app-provider';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Monitor, 
  MonitorSpeaker,
  Volume2,
  VolumeX 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function CallDialog() {
  const {
    currentCall,
    localStream,
    remoteStream,
    isCallDialogOpen,
    isIncomingCall,
    isMuted,
    isVideoEnabled,
    isScreenSharing,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    setCallDialogOpen,
  } = useCall();

  const { allUsers } = useAppContext();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Get participant info
  const otherParticipantId = currentCall?.initiatorId === currentCall?.participantId 
    ? currentCall?.participantId 
    : currentCall?.initiatorId;
  const otherParticipant = allUsers.find(user => user.id === otherParticipantId);

  // Set up video streams
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (!currentCall) return null;

  const isVideoCall = currentCall.type === 'video';
  const isConnected = currentCall.status === 'connected';
  const isRinging = currentCall.status === 'calling' || currentCall.status === 'ringing';

  const getCallStatusText = () => {
    switch (currentCall.status) {
      case 'calling':
        return 'Calling...';
      case 'ringing':
        return 'Incoming call';
      case 'connected':
        return 'Connected';
      case 'ended':
        return 'Call ended';
      case 'declined':
        return 'Call declined';
      case 'missed':
        return 'Missed call';
      default:
        return '';
    }
  };

  return (
    <Dialog 
      open={isCallDialogOpen} 
      onOpenChange={setCallDialogOpen}
    >
      <DialogContent 
        className={cn(
          "max-w-4xl p-0 overflow-hidden",
          isVideoCall && isConnected ? "h-[80vh]" : "max-w-md"
        )}
      >
        {isVideoCall && isConnected ? (
          // Video call interface
          <div className="relative h-full bg-black rounded-lg overflow-hidden">
            {/* Remote video (main) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* Local video (picture-in-picture) */}
            <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-white/20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>

            {/* Screen sharing indicator */}
            {isScreenSharing && (
              <div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Sharing screen
              </div>
            )}

            {/* Call controls */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-black/50 backdrop-blur-sm rounded-full p-4">
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="lg"
                onClick={toggleMute}
                className="rounded-full h-12 w-12"
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>

              <Button
                variant={isVideoEnabled ? "secondary" : "destructive"}
                size="lg"
                onClick={toggleVideo}
                className="rounded-full h-12 w-12"
              >
                {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>

              <Button
                variant={isScreenSharing ? "default" : "secondary"}
                size="lg"
                onClick={toggleScreenShare}
                className="rounded-full h-12 w-12"
              >
                {isScreenSharing ? <MonitorSpeaker className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
              </Button>

              <Button
                variant="destructive"
                size="lg"
                onClick={endCall}
                className="rounded-full h-12 w-12"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </div>

            {/* Participant info overlay */}
            <div className="absolute top-4 left-4 text-white">
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={otherParticipant?.avatar_url} />
                  <AvatarFallback>{otherParticipant?.name?.[0]}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{otherParticipant?.name}</span>
              </div>
            </div>
          </div>
        ) : (
          // Audio call or call setup interface
          <div className="p-8 text-center">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl">{getCallStatusText()}</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={otherParticipant?.avatar_url} />
                <AvatarFallback className="text-2xl">{otherParticipant?.name?.[0]}</AvatarFallback>
              </Avatar>

              <div>
                <h3 className="text-xl font-semibold">{otherParticipant?.name}</h3>
                <p className="text-muted-foreground capitalize">{currentCall.type} call</p>
              </div>

              {/* Audio call controls (when connected) */}
              {isConnected && currentCall.type === 'audio' && (
                <div className="flex items-center gap-4 mt-4">
                  <Button
                    variant={isMuted ? "destructive" : "secondary"}
                    size="lg"
                    onClick={toggleMute}
                    className="rounded-full h-12 w-12"
                  >
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </Button>

                  <Button
                    variant="destructive"
                    size="lg"
                    onClick={endCall}
                    className="rounded-full h-12 w-12"
                  >
                    <PhoneOff className="h-5 w-5" />
                  </Button>
                </div>
              )}

              {/* Incoming call actions */}
              {isIncomingCall && isRinging && (
                <div className="flex items-center gap-4 mt-6">
                  <Button
                    variant="destructive"
                    size="lg"
                    onClick={declineCall}
                    className="rounded-full h-16 w-16"
                  >
                    <PhoneOff className="h-6 w-6" />
                  </Button>

                  <Button
                    variant="default"
                    size="lg"
                    onClick={acceptCall}
                    className="rounded-full h-16 w-16 bg-green-600 hover:bg-green-700"
                  >
                    <Phone className="h-6 w-6" />
                  </Button>
                </div>
              )}

              {/* Outgoing call actions */}
              {!isIncomingCall && isRinging && (
                <div className="mt-6">
                  <Button
                    variant="destructive"
                    size="lg"
                    onClick={endCall}
                    className="rounded-full h-16 w-16"
                  >
                    <PhoneOff className="h-6 w-6" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}