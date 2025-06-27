
// Matches public.profiles table
export type User = {
  id: string; // uuid
  avatar_url: string;
  name: string;
  username: string;
  email?: string; // from auth.users
  gender?: 'male' | 'female';
  bio?: string;
  role?: 'user' | 'admin' | 'gurudev';
  is_admin: boolean;
};

export type Reaction = {
  [emoji: string]: string[]; // emoji: array of user IDs that reacted with it
};

// This represents the JSONB metadata for an attachment
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
};

// Matches public.messages table, with sender profile joined
export type Message = {
  id: number; // bigint
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

// Represents a row in the public.participants table, with the user profile joined
export type Participant = {
  user_id: string;
  chat_id: number;
  is_admin: boolean;
  profiles: User;
}

// Matches public.chats table, with participants joined
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

// Matches the dm_requests table
export type DmRequest = {
  id: number;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reason?: string;
  // Joined from profiles table
  from: User;
  to: User;
};

// Matches the reports table
export type Report = {
  id: number;
  created_at: string;
  reported_by: string;
  reported_user_id: string;
  message_id?: number;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  // Joined data for admin panel
  reporter?: User;
  reported_user?: User;
  message?: Partial<Message>;
}

export type ThemeSettings = {
  outgoingBubbleColor: string;
  incomingBubbleColor:string;
  usernameColor: string;
  chatWallpaper: string | null;
  wallpaperBrightness: number;
};

export type RSVPStatus = 'going' | 'interested' | 'not_going';

export type EventRSVP = {
  event_id: number;
  user_id: string;
  status: RSVPStatus;
};

export type Event = {
  id: number;
  created_at: string;
  creator_id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  date_time: string;
  meet_link?: string;
  rsvps: EventRSVP[];
  profiles?: User; // Joined creator profile
};
