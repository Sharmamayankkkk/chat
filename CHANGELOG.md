# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **AI Integration**: Added Genkit and the Google AI plugin to support future Generative AI features.
- `.env.example` file to simplify local environment setup.
- **Stickers & Custom Emojis**: Added support for sending stickers and custom emojis in chat.
- **Voice Notes**: Users can now record and send voice messages.
- **Link Previews**: Shared links now automatically generate a rich preview card.
- **Image Viewer**: Added a fullscreen image viewer with controls for zoom, rotation, and download.
- **Group Info Page**: A dedicated page to view group details and manage members.
- **User Profile Page**: View profiles of other users in the application.

### Changed
- **Refactored Authentication**: Overhauled the session management and data loading logic in `AppProvider` to fix race conditions and prevent infinite loading on page refresh. Now uses `supabase.auth.getUser()` for secure session validation.
- **Improved UI/UX**: Ensured the sidebar can always be reopened on desktop and is available on all main app pages for better navigation.
- **Optimized Real-time Subscriptions**: Refactored participant-related real-time updates to be more granular, preventing unnecessary full data reloads.
- **Updated Documentation**: Updated `README.md`, `SYNOPSIS.md`, and `CHANGELOG.md` to reflect the current state of the project.

### Fixed
- **Voice Note Player**: Completely rebuilt the voice note player to correctly display duration, show a visual waveform, and integrate with the theme.
- **Session Instability**: Resolved critical race conditions that caused infinite loading screens upon page refresh by implementing a robust, sequential app initialization flow.
- **State Management**: Corrected local state updates for leaving/deleting groups to prevent real-time event loops.
