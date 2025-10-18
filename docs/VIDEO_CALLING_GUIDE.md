# Video and Audio Calling Feature

This document explains how to use the new video and audio calling features in Krishna Connect.

## Features Overview

### Core Features
- **Audio Calls**: High-quality voice calls between users
- **Video Calls**: HD video calling with adaptive quality
- **Screen Sharing**: Share your screen during video calls
- **Multiple Layouts**: Switch between grid and spotlight layouts
- **Participant Management**: View and manage call participants (admin-only for groups)
- **Call Controls**: Mute/unmute, video on/off, screen share toggle, hang up

### Group Call Features
- **Admin-Only Initiation**: Only group admins can start group calls
- **Participant Management Panel**: View all participants with their status
- **Admin Controls**: Remove participants from calls (admin-only)
- **Visual Indicators**: See who is muted, video off, or screen sharing

### UI/UX Features
- **Responsive Design**: Works seamlessly on mobile, tablet, and desktop
- **Clean Video Tiles**: Modern, clean design for video displays
- **Real-time Status**: Live indicators for audio/video status
- **Incoming Call Notifications**: Beautiful modal for incoming calls

## How to Use

### Starting a Call

#### 1-on-1 Calls
1. Open a direct message conversation
2. Click the phone icon (📞) for an audio call or the video icon (📹) for a video call
3. Wait for the other person to accept

#### Group Calls
1. Open a group chat
2. Only group admins can click the call buttons
3. All members will receive a call notification

### Answering a Call
1. When you receive a call, an incoming call notification will appear
2. Click the green accept button to join
3. Click the red reject button to decline

### During a Call

#### Basic Controls
- **Mute/Unmute**: Click the microphone icon to toggle your audio
- **Video On/Off**: Click the video icon to toggle your camera (video calls only)
- **Screen Share**: Click the monitor icon to share your screen
- **Hang Up**: Click the red phone icon to leave the call

#### Layout Options
- **Grid Layout**: All participants displayed equally in a grid
- **Spotlight Layout**: Main speaker in large view, others in sidebar

#### Participant Panel (Group Calls)
- Click the users icon to open the participant panel
- View all participants and their status
- Admins can remove participants from the call

## Technical Details

### WebRTC Implementation
The calling feature uses WebRTC for peer-to-peer connections:
- STUN servers for NAT traversal
- SimplePeer for connection management
- Supabase Realtime for signaling

### Database Schema
Two new tables were added:
- `call_sessions`: Stores call metadata
- `call_participants`: Tracks participants in each call

### Security
- Group calls: Only admins can initiate
- All calls: Only chat participants can join
- Real-time validation through Supabase RLS policies

## Permissions Required

The application needs the following browser permissions:
- **Camera**: For video calls
- **Microphone**: For all calls
- **Screen**: For screen sharing (requested when used)

## Browser Support

Recommended browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Troubleshooting

### "Failed to access camera or microphone"
- Check browser permissions
- Ensure no other app is using the camera/microphone
- Try refreshing the page

### "Failed to start call"
- Check your internet connection
- Ensure you're logged in
- For group calls, verify you're an admin

### Poor Video Quality
- Check your internet bandwidth
- Close unnecessary browser tabs
- Try switching from video to audio-only

### Can't Hear Other Participants
- Check your device volume
- Ensure you haven't muted the tab
- Ask participants to unmute themselves

## Future Enhancements

Planned improvements:
- Call recording
- Background blur/virtual backgrounds
- Call history and statistics
- In-call chat
- Reactions during calls
- Hand raise feature
- Breakout rooms for large group calls
