'use client';

/**
 * Video Call Interface Component
 * This component provides a full-featured video/audio calling interface
 * with multiple layout options, participant management, and call controls
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Phone,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Settings,
  Grid3x3,
  Maximize,
  Users,
  MoreVertical,
  Volume2,
  VolumeX,
  UserMinus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CallParticipant, CallLayout, User, CallType } from '@/lib/types';
import { WebRTCService } from '@/lib/webrtc-service';

interface VideoCallInterfaceProps {
  callId: number;
  chatId: number;
  callType: CallType;
  participants: CallParticipant[];
  loggedInUser: User;
  isGroupCall: boolean;
  isAdmin: boolean;
  onEndCall: () => void;
}

interface VideoTileProps {
  userId: string;
  user?: User;
  stream?: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isLocal?: boolean;
  isSpeaking?: boolean;
  isSpotlight?: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({
  userId,
  user,
  stream,
  isMuted,
  isVideoOff,
  isScreenSharing,
  isLocal = false,
  isSpeaking = false,
  isSpotlight = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className={cn(
        'relative bg-gray-900 rounded-lg overflow-hidden',
        isSpeaking && 'ring-2 ring-primary',
        isSpotlight && 'col-span-2 row-span-2'
      )}
    >
      {/* Video element */}
      {!isVideoOff && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <Avatar className="h-20 w-20">
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback className="text-2xl">
              {user?.name?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* User info overlay */}
      <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
        <span className="text-white text-sm font-medium">
          {isLocal ? 'You' : user?.name || 'Unknown'}
        </span>
        {isMuted && <MicOff className="h-4 w-4 text-red-500" />}
        {isScreenSharing && <Monitor className="h-4 w-4 text-blue-500" />}
      </div>

      {/* Local indicator */}
      {isLocal && (
        <div className="absolute top-2 right-2">
          <Badge variant="secondary">You</Badge>
        </div>
      )}
    </div>
  );
};

export const VideoCallInterface: React.FC<VideoCallInterfaceProps> = ({
  callId,
  chatId,
  callType,
  participants,
  loggedInUser,
  isGroupCall,
  isAdmin,
  onEndCall,
}) => {
  const [layout, setLayout] = useState<CallLayout>('grid');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  
  const webrtcServiceRef = useRef<WebRTCService | null>(null);

  // Initialize WebRTC service
  useEffect(() => {
    const initializeCall = async () => {
      const service = new WebRTCService(loggedInUser.id);
      webrtcServiceRef.current = service;

      // Set up callbacks
      service.onRemoteStream = (userId: string, stream: MediaStream) => {
        setRemoteStreams((prev) => new Map(prev).set(userId, stream));
      };

      service.onPeerRemoved = (userId: string) => {
        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });
      };

      service.onParticipantUpdate = (participant: CallParticipant) => {
        // Handle participant updates (mute, video off, etc.)
        console.log('Participant updated:', participant);
      };

      try {
        // Initialize media
        const stream = await service.initializeMedia(callType === 'audio');
        setLocalStream(stream);

        // Join the call
        await service.joinCall(callId);
      } catch (error) {
        console.error('Error initializing call:', error);
      }
    };

    initializeCall();

    return () => {
      webrtcServiceRef.current?.endCall();
    };
  }, [callId, loggedInUser.id, callType]);

  // Toggle mute
  const handleToggleMute = useCallback(async () => {
    await webrtcServiceRef.current?.toggleMute();
    setIsMuted((prev) => !prev);
  }, []);

  // Toggle video
  const handleToggleVideo = useCallback(async () => {
    await webrtcServiceRef.current?.toggleVideo();
    setIsVideoOff((prev) => !prev);
  }, []);

  // Toggle screen share
  const handleToggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await webrtcServiceRef.current?.stopScreenShare();
      setIsScreenSharing(false);
    } else {
      const screenStream = await webrtcServiceRef.current?.startScreenShare();
      if (screenStream) {
        setIsScreenSharing(true);
      }
    }
  }, [isScreenSharing]);

  // Handle end call
  const handleEndCall = useCallback(async () => {
    await webrtcServiceRef.current?.endCall();
    onEndCall();
  }, [onEndCall]);

  // Render video grid
  const renderVideoGrid = () => {
    const allParticipants = [
      {
        userId: loggedInUser.id,
        user: loggedInUser,
        stream: localStream,
        isMuted,
        isVideoOff,
        isScreenSharing,
        isLocal: true,
      },
      ...Array.from(remoteStreams.entries()).map(([userId, stream]) => {
        const participant = participants.find((p) => p.user_id === userId);
        return {
          userId,
          user: participant?.profiles,
          stream,
          isMuted: participant?.is_muted || false,
          isVideoOff: participant?.is_video_off || false,
          isScreenSharing: participant?.is_screen_sharing || false,
          isLocal: false,
        };
      }),
    ];

    const gridCols =
      allParticipants.length === 1
        ? 'grid-cols-1'
        : allParticipants.length === 2
        ? 'grid-cols-2'
        : allParticipants.length <= 4
        ? 'grid-cols-2'
        : 'grid-cols-3';

    return (
      <div className={cn('grid gap-2 h-full p-4', gridCols)}>
        {allParticipants.map((participant) => (
          <VideoTile key={participant.userId} {...participant} />
        ))}
      </div>
    );
  };

  // Render spotlight layout
  const renderSpotlightLayout = () => {
    const activeParticipant = Array.from(remoteStreams.entries())[0] || [
      loggedInUser.id,
      localStream,
    ];
    const [userId, stream] = activeParticipant;
    const participant = participants.find((p) => p.user_id === userId);

    return (
      <div className="flex h-full">
        <div className="flex-1 p-4">
          <VideoTile
            userId={userId}
            user={userId === loggedInUser.id ? loggedInUser : participant?.profiles}
            stream={stream || localStream}
            isMuted={userId === loggedInUser.id ? isMuted : participant?.is_muted || false}
            isVideoOff={userId === loggedInUser.id ? isVideoOff : participant?.is_video_off || false}
            isScreenSharing={
              userId === loggedInUser.id ? isScreenSharing : participant?.is_screen_sharing || false
            }
            isLocal={userId === loggedInUser.id}
            isSpotlight
          />
        </div>
        
        <div className="w-64 p-4">
          <ScrollArea className="h-full">
            <div className="space-y-2">
              {Array.from(remoteStreams.entries())
                .slice(1)
                .map(([userId, stream]) => {
                  const participant = participants.find((p) => p.user_id === userId);
                  return (
                    <div key={userId} className="aspect-video">
                      <VideoTile
                        userId={userId}
                        user={participant?.profiles}
                        stream={stream}
                        isMuted={participant?.is_muted || false}
                        isVideoOff={participant?.is_video_off || false}
                        isScreenSharing={participant?.is_screen_sharing || false}
                      />
                    </div>
                  );
                })}
              
              {localStream && userId !== loggedInUser.id && (
                <div className="aspect-video">
                  <VideoTile
                    userId={loggedInUser.id}
                    user={loggedInUser}
                    stream={localStream}
                    isMuted={isMuted}
                    isVideoOff={isVideoOff}
                    isScreenSharing={isScreenSharing}
                    isLocal
                  />
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="destructive" className="animate-pulse">
            {callType === 'audio' ? <Phone className="h-3 w-3 mr-1" /> : <Video className="h-3 w-3 mr-1" />}
            Call in progress
          </Badge>
          <span className="text-white text-sm">
            {participants.length + 1} participant{participants.length !== 0 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white">
                <Grid3x3 className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setLayout('grid')}>
                Grid Layout
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLayout('spotlight')}>
                Spotlight Layout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Participants panel toggle */}
          {isGroupCall && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white"
              onClick={() => setShowParticipants(!showParticipants)}
            >
              <Users className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 relative">
        {layout === 'grid' ? renderVideoGrid() : renderSpotlightLayout()}
      </div>

      {/* Call controls */}
      <div className="bg-gray-900/80 backdrop-blur-sm border-t border-gray-800 px-4 py-4">
        <div className="flex items-center justify-center gap-3">
          {/* Mute button */}
          <Button
            variant={isMuted ? 'destructive' : 'secondary'}
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={handleToggleMute}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>

          {/* Video button */}
          {callType === 'video' && (
            <Button
              variant={isVideoOff ? 'destructive' : 'secondary'}
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={handleToggleVideo}
            >
              {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </Button>
          )}

          {/* Screen share button */}
          {callType === 'video' && (
            <Button
              variant={isScreenSharing ? 'default' : 'secondary'}
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={handleToggleScreenShare}
            >
              {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            </Button>
          )}

          {/* End call button */}
          <Button
            variant="destructive"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={handleEndCall}
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Participants panel (sidebar) */}
      {showParticipants && isGroupCall && (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gray-900 border-l border-gray-800 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Participants</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowParticipants(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="space-y-2">
              {/* Local user */}
              <Card className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={loggedInUser.avatar_url} />
                      <AvatarFallback>{loggedInUser.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">You</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {isMuted && <MicOff className="h-3 w-3 text-red-500" />}
                        {isVideoOff && <VideoOff className="h-3 w-3 text-red-500" />}
                        {isScreenSharing && <Monitor className="h-3 w-3 text-blue-500" />}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Remote participants */}
              {participants.map((participant) => (
                <Card key={participant.user_id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={participant.profiles?.avatar_url} />
                        <AvatarFallback>
                          {participant.profiles?.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{participant.profiles?.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {participant.is_muted && <MicOff className="h-3 w-3 text-red-500" />}
                          {participant.is_video_off && <VideoOff className="h-3 w-3 text-red-500" />}
                          {participant.is_screen_sharing && (
                            <Monitor className="h-3 w-3 text-blue-500" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Admin controls */}
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem>
                            <UserMinus className="h-4 w-4 mr-2" />
                            Remove from call
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
