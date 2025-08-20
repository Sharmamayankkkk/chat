'use client';

import React, { createContext, useContext, useCallback, useState, useRef, useEffect } from 'react';
import Peer from 'simple-peer';
import { createClient } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Call, CallType, CallStatus, CallParticipant } from '@/lib/types';

interface CallContextType {
  currentCall: Call | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCallDialogOpen: boolean;
  isIncomingCall: boolean;
  callParticipants: Map<string, CallParticipant>;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  
  // Call actions
  initiateCall: (chatId: number, participantId: string, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  setCallDialogOpen: (open: boolean) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function useCall() {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}

interface CallProviderProps {
  children: React.ReactNode;
  userId: string | null;
}

export function CallProvider({ children, userId }: CallProviderProps) {
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [callParticipants, setCallParticipants] = useState<Map<string, CallParticipant>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peerRef = useRef<Peer.Instance | null>(null);
  const supabase = createClient();
  const { toast } = useToast();

  // Clean up media streams
  const cleanupStreams = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      setRemoteStream(null);
    }
  }, [localStream, remoteStream]);

  // Initialize peer connection
  const createPeer = useCallback((initiator: boolean) => {
    const peer = new Peer({
      initiator,
      trickle: false,
      stream: localStream || undefined,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

    peer.on('signal', (signal) => {
      if (currentCall) {
        // Send signal through Supabase realtime
        supabase
          .channel(`call-${currentCall.id}`)
          .send({
            type: 'broadcast',
            event: 'signal',
            payload: { signal, from: userId }
          });
      }
    });

    peer.on('stream', (stream) => {
      setRemoteStream(stream);
    });

    peer.on('error', (error) => {
      console.error('Peer connection error:', error);
      toast({ variant: 'destructive', title: 'Call error', description: 'Connection failed' });
      endCall();
    });

    peer.on('close', () => {
      endCall();
    });

    return peer;
  }, [localStream, currentCall, userId, supabase, toast]);

  // Get user media
  const getUserMedia = useCallback(async (type: CallType) => {
    try {
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported by your browser');
      }

      const constraints = {
        audio: true,
        video: type === 'video'
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      
      let errorMessage = 'Please allow access to camera and microphone';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera and microphone access was denied. Please check your browser permissions.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera or microphone found. Please check your devices.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Your browser does not support media access.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({ 
        variant: 'destructive', 
        title: 'Media access error', 
        description: errorMessage
      });
      throw error;
    }
  }, [toast]);

  // Initiate a call
  const initiateCall = useCallback(async (chatId: number, participantId: string, type: CallType) => {
    if (!userId) {
      toast({ 
        variant: 'destructive', 
        title: 'Cannot start call', 
        description: 'User not authenticated' 
      });
      return;
    }

    try {
      const stream = await getUserMedia(type);
      
      const call: Call = {
        id: `call-${Date.now()}`,
        chatId,
        type,
        status: 'calling',
        initiatorId: userId,
        participantId,
        createdAt: new Date().toISOString(),
      };

      setCurrentCall(call);
      setIsCallDialogOpen(true);
      
      // Create peer as initiator
      peerRef.current = createPeer(true);

      // Subscribe to call channel for signaling
      supabase
        .channel(`call-${call.id}`)
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          if (payload.from !== userId && peerRef.current) {
            peerRef.current.signal(payload.signal);
          }
        })
        .on('broadcast', { event: 'call-accepted' }, () => {
          setCurrentCall(prev => prev ? { ...prev, status: 'connected', startedAt: new Date().toISOString() } : null);
        })
        .on('broadcast', { event: 'call-declined' }, () => {
          setCurrentCall(prev => prev ? { ...prev, status: 'declined' } : null);
          endCall();
        })
        .subscribe();

      // Notify the other user
      await supabase
        .channel(`user-${participantId}`)
        .send({
          type: 'broadcast',
          event: 'incoming-call',
          payload: call
        });

    } catch (error) {
      console.error('Error initiating call:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Call failed', 
        description: error instanceof Error ? error.message : 'Unable to start the call. Please try again.' 
      });
      endCall();
    }
  }, [userId, getUserMedia, createPeer, supabase, toast]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!currentCall) return;

    try {
      const stream = await getUserMedia(currentCall.type);
      
      // Create peer as non-initiator
      peerRef.current = createPeer(false);
      
      setCurrentCall(prev => prev ? { ...prev, status: 'connected', startedAt: new Date().toISOString() } : null);
      setIsIncomingCall(false);

      // Notify call accepted
      supabase
        .channel(`call-${currentCall.id}`)
        .send({
          type: 'broadcast',
          event: 'call-accepted',
          payload: { from: userId }
        });

    } catch (error) {
      console.error('Error accepting call:', error);
      declineCall();
    }
  }, [currentCall, getUserMedia, createPeer, supabase, userId]);

  // Decline incoming call
  const declineCall = useCallback(() => {
    if (!currentCall) return;

    supabase
      .channel(`call-${currentCall.id}`)
      .send({
        type: 'broadcast',
        event: 'call-declined',
        payload: { from: userId }
      });

    endCall();
  }, [currentCall, supabase, userId]);

  // End call
  const endCall = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    cleanupStreams();
    
    if (currentCall) {
      setCurrentCall({ ...currentCall, status: 'ended', endedAt: new Date().toISOString() });
      
      // Notify other participant
      supabase
        .channel(`call-${currentCall.id}`)
        .send({
          type: 'broadcast',
          event: 'call-ended',
          payload: { from: userId }
        });
    }

    setTimeout(() => {
      setCurrentCall(null);
      setIsCallDialogOpen(false);
      setIsIncomingCall(false);
      setCallParticipants(new Map());
      setIsMuted(false);
      setIsVideoEnabled(true);
      setIsScreenSharing(false);
    }, 1000);
  }, [currentCall, cleanupStreams, supabase, userId]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle screen sharing
  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing, return to camera
        const stream = await getUserMedia(currentCall?.type || 'video');
        if (peerRef.current) {
          peerRef.current.replaceTrack(
            localStream!.getVideoTracks()[0],
            stream.getVideoTracks()[0],
            localStream!
          );
        }
        setIsScreenSharing(false);
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        if (peerRef.current && localStream) {
          peerRef.current.replaceTrack(
            localStream.getVideoTracks()[0],
            screenStream.getVideoTracks()[0],
            localStream
          );
        }
        
        // Handle screen share end
        screenStream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };
        
        setIsScreenSharing(true);
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
      toast({ variant: 'destructive', title: 'Screen share error', description: 'Could not access screen' });
    }
  }, [isScreenSharing, currentCall, getUserMedia, localStream, toast]);

  // Listen for incoming calls
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-${userId}`)
      .on('broadcast', { event: 'incoming-call' }, ({ payload }) => {
        setCurrentCall(payload);
        setIsIncomingCall(true);
        setIsCallDialogOpen(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupStreams();
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [cleanupStreams]);

  const setCallDialogOpen = useCallback((open: boolean) => {
    setIsCallDialogOpen(open);
    if (!open && currentCall?.status !== 'connected') {
      endCall();
    }
  }, [currentCall, endCall]);

  const value: CallContextType = {
    currentCall,
    localStream,
    remoteStream,
    isCallDialogOpen,
    isIncomingCall,
    callParticipants,
    isMuted,
    isVideoEnabled,
    isScreenSharing,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    setCallDialogOpen,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
}