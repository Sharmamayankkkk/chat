# Video/Audio Calling Feature

This document describes the implementation of video and audio calling functionality with screensharing in Krishna Connect.

## Overview

The calling feature provides real-time video and audio communication between users in direct messages (DMs). It includes:

- **Audio Calls**: Voice-only communication
- **Video Calls**: Video and audio communication with camera controls
- **Screen Sharing**: Share your screen during video calls
- **Call Controls**: Mute/unmute, camera on/off, screen share toggle, hang up
- **Real-time Signaling**: Uses Supabase realtime for call coordination

## Technical Implementation

### Core Components

1. **CallProvider** (`src/providers/call-provider.tsx`)
   - Manages call state and WebRTC connections
   - Handles signaling through Supabase realtime
   - Provides call control functions

2. **CallDialog** (`src/app/(app)/components/call-dialog.tsx`)
   - Main call interface for active calls
   - Supports both audio and video call UI
   - Includes call controls and participant display

3. **IncomingCallNotification** (`src/app/(app)/components/incoming-call-notification.tsx`)
   - Shows notification for incoming calls
   - Provides accept/decline options

### WebRTC Setup

The implementation uses `simple-peer` library for WebRTC connections:

```typescript
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
```

### Call Flow

1. **Initiating a Call**:
   - User clicks audio/video button in chat header
   - `initiateCall()` requests media permissions
   - Creates peer connection as initiator
   - Sends call notification to recipient

2. **Receiving a Call**:
   - Incoming call notification appears
   - User can accept or decline
   - If accepted, creates peer connection as non-initiator
   - Establishes WebRTC connection

3. **During Call**:
   - Real-time audio/video streaming
   - Call controls for mute, video, screen share
   - Screen sharing toggle with display media API

4. **Ending Call**:
   - Cleanup media streams
   - Destroy peer connections
   - Update call status

### Signaling Protocol

Uses Supabase realtime channels for signaling:

```typescript
// Call signaling channel
supabase
  .channel(`call-${callId}`)
  .on('broadcast', { event: 'signal' }, handleSignal)
  .on('broadcast', { event: 'call-accepted' }, handleAccepted)
  .on('broadcast', { event: 'call-declined' }, handleDeclined)
  .subscribe();
```

### Integration with Chat

- Call buttons appear in chat header for DMs only
- Respects existing restrictions (blocked users, DM permissions)
- Maintains all existing chat functionality
- Follows existing UI patterns and component structure

## Usage

### For Users

1. **Starting a Call**:
   - Open a direct message chat
   - Click the phone icon for audio call or video icon for video call
   - Wait for the other person to accept

2. **During a Call**:
   - Use microphone button to mute/unmute
   - Use camera button to turn video on/off (video calls only)
   - Use screen share button to share your screen
   - Use phone button to end the call

3. **Receiving a Call**:
   - Incoming call notification will appear
   - Click "Accept" to join or "Decline" to reject

### Limitations

- Currently supports 1-on-1 calls only (no group calls)
- Requires modern browser with WebRTC support
- Need microphone/camera permissions for audio/video calls
- Screen sharing requires additional browser permissions

## Security Considerations

- Media streams are peer-to-peer (not routed through servers)
- Signaling uses existing Supabase authentication
- Respects all existing chat permissions and blocks
- Media permissions requested only when needed

## Browser Compatibility

- Chrome/Chromium: Full support
- Firefox: Full support
- Safari: Full support (iOS 14.3+)
- Edge: Full support

## Future Enhancements

- Group calling support
- Call recording
- Chat during calls
- Call history
- Push notifications for incoming calls
- Mobile app integration

## Troubleshooting

### Common Issues

1. **"Media access denied"**: Check browser permissions for microphone/camera
2. **"Connection failed"**: Check network/firewall settings for WebRTC
3. **"Screen share error"**: Ensure browser supports screen sharing API

### Debug Information

Call state and connection information is logged to browser console for debugging purposes.