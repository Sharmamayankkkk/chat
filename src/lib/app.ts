// Application-level types (context, settings, etc.)

import type { User } from './auth';
import type { Chat, Message } from './chat';

// --- NEW NOTIFICATION TYPE ---
export type NotificationType = 'follow_request' | 'new_follower' | 'new_like' | 'new_comment';

export type Notification = {
  id: number;
  user_id: string; // The user who received the notification
  actor_id: string; // The user who triggered the notification
  type: NotificationType;
  entity_id: number | null; // e.g., Post ID
  is_read: boolean;
  created_at: string;
  actor: User; // This is the joined profile of the 'actor_id'
};
// --- END NEW TYPE ---

export type RelationshipStatus = 'pending' | 'approved' | 'blocked';

export type Relationship = {
  id: number;
  user_one_id: string;
  user_two_id: string;
  status: RelationshipStatus;
  created_at: string;
};

export type ThemeSettings = {
  outgoingBubbleColor: string;
  incomingBubbleColor: string;
  usernameColor: string;
  chatWallpaper: string | null;
  wallpaperBrightness: number;
};

// UPDATED: AppContextType now includes notifications
export interface AppContextType {
  loggedInUser: User | null;
  allUsers: User[];
  chats: Chat[];
  relationships: Relationship[];
  notifications: Notification[]; // <-- ADDED
  
  addChat: (newChat: Chat) => void;
  updateUser: (updates: Partial<User>) => Promise<void>;
  leaveGroup: (chatId: number) => Promise<void>;
  deleteGroup: (chatId: number) => Promise<void>;
  forwardMessage: (message: Message, chatIds: number[]) => Promise<void>;

  followUser: (targetId: string) => Promise<void>;
  approveFollow: (requestorId: string) => Promise<void>;
  rejectFollow: (requestorId: string) => Promise<void>;
  unfollowUser: (targetId: string) => Promise<void>;
  removeFollower: (targetId: string) => Promise<void>;
  blockUser: (targetId: string) => Promise<void>;
  unblockUser: (targetId: string) => Promise<void>;

  markNotificationsAsRead: () => Promise<void>; // <-- ADDED

  themeSettings: ThemeSettings;
  setThemeSettings: (newSettings: Partial<ThemeSettings>) => void;
  isReady: boolean;
  resetUnreadCount: (chatId: number) => void;
}