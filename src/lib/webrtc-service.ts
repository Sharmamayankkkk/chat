/**
 * WebRTC Service for managing video/audio calls
 * This service handles peer-to-peer connections using SimplePeer
 * and Supabase realtime for signaling
 */

import SimplePeer from 'simple-peer';
import { createClient } from '@/lib/utils';
import type { CallSession, CallParticipant, PeerConnection } from '@/lib/types';

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export class WebRTCService {
  private supabase = createClient();
  private localStream: MediaStream | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private callId: number | null = null;
  private userId: string;
  private channel: any = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Initialize local media stream (camera and microphone)
   */
  async initializeMedia(audioOnly: boolean = false): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: audioOnly ? false : {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user',
        },
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw new Error('Failed to access camera or microphone');
    }
  }

  /**
   * Initialize screen sharing
   */
  async initializeScreenShare(): Promise<MediaStream> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        },
        audio: false,
      });
      return screenStream;
    } catch (error) {
      console.error('Error accessing screen share:', error);
      throw new Error('Failed to access screen share');
    }
  }

  /**
   * Create a new call session
   */
  async createCall(chatId: number, callType: 'audio' | 'video'): Promise<CallSession> {
    const { data, error } = await this.supabase
      .from('call_sessions')
      .insert({
        chat_id: chatId,
        initiated_by: this.userId,
        call_type: callType,
        status: 'ringing',
      })
      .select()
      .single();

    if (error) throw error;
    
    this.callId = data.id;
    await this.joinCall(data.id);
    await this.subscribeToCallSignaling(data.id);
    
    return data as CallSession;
  }

  /**
   * Join an existing call
   */
  async joinCall(callId: number): Promise<void> {
    this.callId = callId;

    // Add user to call participants
    const { error } = await this.supabase
      .from('call_participants')
      .insert({
        call_id: callId,
        user_id: this.userId,
        joined_at: new Date().toISOString(),
      });

    if (error && !error.message.includes('duplicate')) {
      throw error;
    }

    await this.subscribeToCallSignaling(callId);
  }

  /**
   * Subscribe to call signaling events
   */
  private async subscribeToCallSignaling(callId: number): Promise<void> {
    // Subscribe to call participants changes
    this.channel = this.supabase
      .channel(`call-${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_participants',
          filter: `call_id=eq.${callId}`,
        },
        async (payload) => {
          const participant = payload.new as CallParticipant;
          if (participant.user_id !== this.userId) {
            await this.createPeerConnection(participant.user_id, true);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_participants',
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          const participant = payload.new as CallParticipant;
          this.handleParticipantUpdate(participant);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'call_participants',
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          const participant = payload.old as CallParticipant;
          this.removePeer(participant.user_id);
        }
      )
      .subscribe();

    // Fetch existing participants and create peer connections
    const { data: existingParticipants } = await this.supabase
      .from('call_participants')
      .select('user_id')
      .eq('call_id', callId)
      .is('left_at', null);

    if (existingParticipants) {
      for (const participant of existingParticipants) {
        if (participant.user_id !== this.userId) {
          await this.createPeerConnection(participant.user_id, false);
        }
      }
    }
  }

  /**
   * Create a peer connection with another user
   */
  private async createPeerConnection(
    remoteUserId: string,
    initiator: boolean
  ): Promise<void> {
    if (!this.localStream || this.peers.has(remoteUserId)) return;

    const peer = new SimplePeer({
      initiator,
      stream: this.localStream,
      trickle: true,
      config: {
        iceServers: STUN_SERVERS,
      },
    });

    const peerConnection: PeerConnection = {
      userId: remoteUserId,
      peer,
    };

    this.peers.set(remoteUserId, peerConnection);

    // Handle signaling through Supabase messages
    peer.on('signal', async (signal) => {
      await this.sendSignal(remoteUserId, signal);
    });

    peer.on('stream', (remoteStream) => {
      peerConnection.stream = remoteStream;
      this.onRemoteStream?.(remoteUserId, remoteStream);
    });

    peer.on('error', (err) => {
      console.error('Peer connection error:', err);
      this.removePeer(remoteUserId);
    });

    peer.on('close', () => {
      this.removePeer(remoteUserId);
    });
  }

  /**
   * Send signaling data via Supabase
   */
  private async sendSignal(toUserId: string, signal: any): Promise<void> {
    if (!this.callId) return;

    // Store signaling data in a messages table or use realtime broadcast
    await this.supabase
      .from('messages')
      .insert({
        chat_id: this.callId, // Using call_id as temporary identifier
        user_id: this.userId,
        content: JSON.stringify({
          type: 'webrtc-signal',
          to: toUserId,
          signal,
        }),
        attachment_metadata: { type: 'webrtc-signal' },
      });
  }

  /**
   * Handle participant updates (mute, video off, etc.)
   */
  private handleParticipantUpdate(participant: CallParticipant): void {
    this.onParticipantUpdate?.(participant);
  }

  /**
   * Toggle microphone mute
   */
  async toggleMute(): Promise<void> {
    if (!this.localStream || !this.callId) return;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      
      await this.supabase
        .from('call_participants')
        .update({ is_muted: !audioTrack.enabled })
        .eq('call_id', this.callId)
        .eq('user_id', this.userId);
    }
  }

  /**
   * Toggle video on/off
   */
  async toggleVideo(): Promise<void> {
    if (!this.localStream || !this.callId) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      
      await this.supabase
        .from('call_participants')
        .update({ is_video_off: !videoTrack.enabled })
        .eq('call_id', this.callId)
        .eq('user_id', this.userId);
    }
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<MediaStream | null> {
    try {
      const screenStream = await this.initializeScreenShare();
      
      if (!this.callId) return null;

      // Replace video track with screen share track
      const screenTrack = screenStream.getVideoTracks()[0];
      
      // Update all peer connections
      this.peers.forEach((peerConnection) => {
        const sender = peerConnection.peer._pc
          ?.getSenders()
          ?.find((s: any) => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      // Update participant status
      await this.supabase
        .from('call_participants')
        .update({ is_screen_sharing: true })
        .eq('call_id', this.callId)
        .eq('user_id', this.userId);

      // Handle screen share stop
      screenTrack.onended = () => {
        this.stopScreenShare();
      };

      return screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      return null;
    }
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<void> {
    if (!this.localStream || !this.callId) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    
    // Revert to camera
    this.peers.forEach((peerConnection) => {
      const sender = peerConnection.peer._pc
        ?.getSenders()
        ?.find((s: any) => s.track?.kind === 'video');
      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack);
      }
    });

    await this.supabase
      .from('call_participants')
      .update({ is_screen_sharing: false })
      .eq('call_id', this.callId)
      .eq('user_id', this.userId);
  }

  /**
   * End the call
   */
  async endCall(): Promise<void> {
    // Stop all media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close all peer connections
    this.peers.forEach((peerConnection) => {
      peerConnection.peer.destroy();
    });
    this.peers.clear();

    // Update call session and participant
    if (this.callId) {
      await this.supabase
        .from('call_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('call_id', this.callId)
        .eq('user_id', this.userId);
    }

    // Unsubscribe from realtime
    if (this.channel) {
      await this.supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.callId = null;
  }

  /**
   * Remove a peer connection
   */
  private removePeer(userId: string): void {
    const peerConnection = this.peers.get(userId);
    if (peerConnection) {
      peerConnection.peer.destroy();
      this.peers.delete(userId);
      this.onPeerRemoved?.(userId);
    }
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get all peer connections
   */
  getPeers(): Map<string, PeerConnection> {
    return this.peers;
  }

  // Callback handlers (to be set by the UI)
  onRemoteStream?: (userId: string, stream: MediaStream) => void;
  onParticipantUpdate?: (participant: CallParticipant) => void;
  onPeerRemoved?: (userId: string) => void;
}
