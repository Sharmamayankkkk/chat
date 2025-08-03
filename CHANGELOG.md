# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **AI-Powered Translation**: Added a modal to translate messages into various languages using Genkit and the Gemini API.
- **Legal Pages**: Created dedicated pages for Privacy Policy and Terms & Conditions with a shared layout.
- **PWA Manifest**: Added a `manifest.json` file for improved Progressive Web App capabilities.

### Changed
- **Refactored Authentication**: Overhauled the session management and data loading logic in `AppProvider` to fix race conditions and prevent infinite loading on page refresh. Now uses `supabase.auth.getUser()` for secure session validation.
- **Improved UI/UX**: Ensured the sidebar can always be reopened on desktop and is available on all main app pages for better navigation.
- **Optimized Real-time Subscriptions**: Refactored participant-related real-time updates to be more granular, preventing unnecessary full data reloads.
- **Updated Documentation**: Updated `README.md` and `CHANGELOG.md` to reflect the current state of the project.
- **Improved SEO**: Enhanced metadata in the main layout and added a `sitemap.xml` for better search engine visibility.

### Fixed
- **Voice Note Player**: Completely rebuilt the voice note player to correctly display duration, show a visual waveform, and integrate with the theme.
- **Session Instability**: Resolved critical race conditions that caused infinite loading screens upon page refresh by implementing a robust, sequential app initialization flow.
- **State Management**: Corrected local state updates for leaving/deleting groups to prevent real-time event loops.
- **Genkit Initialization**: Fixed persistent errors related to Genkit plugin initialization by simplifying the configuration.
- **Chat Input**: Corrected padding on the chat input box to prevent text from overlapping icons and fixed the `Shift+Enter` behavior for new lines.
- **UI Color Contrast**: Fixed poor color contrast in the translation dialog for better readability.
- **Dialog Overflow**: Added a scroll area to the language selection dropdown in the translation dialog to prevent overflow on small screens.
