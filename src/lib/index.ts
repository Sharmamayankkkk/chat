// Central export point for all types
// This maintains backward compatibility with existing imports

// Auth types
export type { User } from './auth';

// Chat types
export type {
  Reaction,
  AttachmentMetadata,
  Message,
  Participant,
  Chat
} from './chat';

// Event types
export type {
  RSVPStatus,
  EventRSVP,
  Event
} from './events';

// App types (NOW EXPORTING THE NEW TYPES)
export type {
  ThemeSettings,
  AppContextType,
  Relationship,
  RelationshipStatus,
  Notification,
  NotificationType
} from './app';