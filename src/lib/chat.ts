// Chat, messaging, and communication types

import type { User } from './auth';

export type Reaction = {
  [emoji: string]: string[]; // emoji: array of user IDs that reacted with it
};

export type AttachmentMetadata = {
  name: string;
  type: string; // MIME type for files, or a custom type like 'event_share'
  size: number;
  // Optional fields for custom embeds
  eventId?: number;
  eventDate?: string;
  eventThumbnail?: string | null;
  // Link Previews
  title?: string;
  description?: string;
  image?: string;
  icon?: string;
  url?: string;
  // Voice Notes
  duration?: number;
  waveform?: number[];
};

export type Message = {
  id: number | string; // Allow string for temporary optimistic IDs
  created_at: string; // timestamp with time zone
  chat_id: number; // bigint
  user_id: string; // uuid
  content: string | null;
  profiles: User; 
  attachment_url: string | null;
  attachment_metadata: AttachmentMetadata | null;
  is_edited: boolean;
  reactions: Reaction | null;
  read_by: string[] | null;
  deleted_for?: string[];
  is_starred?: boolean;
  is_pinned?: boolean;
  reply_to_message_id?: number | null;
  replied_to_message?: Message | null; // Joined reply data
};

export type Participant = {
  user_id: string;
  chat_id: number;
  is_admin: boolean;
  profiles: User;
};

export type Chat = {
  id: number; // bigint
  created_at: string; // timestamp with time zone
  type: 'dm' | 'group' | 'channel';
  name?: string; 
  avatar_url?: string;
  created_by?: string; // uuid
  description?: string;
  participants: Participant[];
  messages: Message[];
  
  // Group-specific fields from DB
  is_public: boolean;
  history_visible: boolean;
  invite_code: string | null;

  // UI-only fields
  unreadCount?: number;
  last_message_content?: string | null;
  last_message_timestamp?: string | null;
};