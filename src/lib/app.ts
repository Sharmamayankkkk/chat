// Application-level types (context, settings, etc.)

import type { User } from './auth';
import type { Chat, Message } from './chat';
import type { Post, Comment, Media, Poll } from './posts'; // <-- IMPORT POST TYPES

// Notification Type
export type NotificationType = 'follow_request' | 'new_follower' | 'new_like' | 'new_comment';

export type Notification = {
  id: number;
  user_id: string;
  actor_id: string;
  type: NotificationType;
  entity_id: number | null;
  is_read: boolean;
  created_at: string;
  actor: User;
};

// Relationship Types
export type RelationshipStatus = 'pending' | 'approved' | 'blocked';
export type Relationship = {
  id: number;
  user_one_id: string;
  user_two_id: string;
  status: RelationshipStatus;
  created_at: string;
};

// Theme Settings
export type ThemeSettings = {
  outgoingBubbleColor: string;
  incomingBubbleColor: string;
  usernameColor: string;
  chatWallpaper: string | null;
  wallpaperBrightness: number;
};

// --- UPDATED: AppContextType ---
export interface AppContextType {
  loggedInUser: User | null;
  allUsers: User[];
  chats: Chat[];
  relationships: Relationship[];
  notifications: Notification[];
  posts: Post[]; // <-- ADDED
  
  // Chat functions
  addChat: (newChat: Chat) => void;
  leaveGroup: (chatId: number) => Promise<void>;
  deleteGroup: (chatId: number) => Promise<void>;
  forwardMessage: (message: Message, chatIds: number[]) => Promise<void>;
  resetUnreadCount: (chatId: number) => void;

  // Social functions
  followUser: (targetId: string) => Promise<void>;
  approveFollow: (requestorId: string) => Promise<void>;
  rejectFollow: (requestorId: string) => Promise<void>;
  unfollowUser: (targetId: string) => Promise<void>;
  removeFollower: (targetId: string) => Promise<void>;
  blockUser: (targetId: string) => Promise<void>;
  unblockUser: (targetId: string) => Promise<void>;
  
  // Notification functions
  markNotificationsAsRead: () => Promise<void>;
  
  // Profile/Settings functions
  updateUser: (updates: Partial<User>) => Promise<void>;
  themeSettings: ThemeSettings;
  setThemeSettings: (newSettings: Partial<ThemeSettings>) => void;
  
  // Post functions (NEW)
  fetchPosts: () => Promise<void>;
  createPost: (content: string, media?: Media[], poll?: Poll) => Promise<void>;
  deletePost: (postId: number | string) => Promise<void>;
  togglePostLike: (postId: number | string) => Promise<void>;
  createComment: (postId: number | string, content: string, parentCommentId?: number | string) => Promise<void>;
  toggleCommentLike: (commentId: number | string) => Promise<void>;
  
  // App state
  isReady: boolean;
}