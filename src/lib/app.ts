// Application-level types (context, settings, etc.)

import type { User } from './auth';
import type { Chat, Message } from './chat';

// NEW: Define the Relationship type to match the database
export type RelationshipStatus = 'pending' | 'approved' | 'blocked';

export type Relationship = {
  id: number;
  user_one_id: string; // The user initiating the action
  user_two_id: string; // The user being acted upon
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

// UPDATED: This is the new "contract" for our AppContext
export interface AppContextType {
  loggedInUser: User | null;
  allUsers: User[];
  chats: Chat[];
  relationships: Relationship[]; // REPLACED dmRequests and blockedUsers
  
  addChat: (newChat: Chat) => void;
  updateUser: (updates: Partial<User>) => Promise<void>;
  leaveGroup: (chatId: number) => Promise<void>;
  deleteGroup: (chatId: number) => Promise<void>;
  forwardMessage: (message: Message, chatIds: number[]) => Promise<void>;

  // NEW functions
  followUser: (targetId: string) => Promise<void>;
  approveFollow: (requestorId: string) => Promise<void>;
  rejectFollow: (requestorId: string) => Promise<void>;
  unfollowUser: (targetId: string) => Promise<void>;
  removeFollower: (targetId: string) => Promise<void>;
  blockUser: (targetId: string) => Promise<void>;
  unblockUser: (targetId: string) => Promise<void>;

  themeSettings: ThemeSettings;
  setThemeSettings: (newSettings: Partial<ThemeSettings>) => void;
  isReady: boolean;
  resetUnreadCount: (chatId: number) => void;
}