// Application-level types (context, settings, etc.)

import type { User, DmRequest } from './auth';
import type { Chat, Message } from './chat';

export type ThemeSettings = {
  outgoingBubbleColor: string;
  incomingBubbleColor: string;
  usernameColor: string;
  chatWallpaper: string | null;
  wallpaperBrightness: number;
};

export interface AppContextType {
  loggedInUser: User | null;
  allUsers: User[];
  chats: Chat[];
  dmRequests: DmRequest[];
  blockedUsers: string[];
  sendDmRequest: (toUserId: string, reason: string) => Promise<void>;
  addChat: (newChat: Chat) => void;
  updateUser: (updates: Partial<User>) => Promise<void>;
  leaveGroup: (chatId: number) => Promise<void>;
  deleteGroup: (chatId: number) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  reportUser: (reportedUserId: string, reason: string, messageId?: number) => Promise<void>;
  forwardMessage: (message: Message, chatIds: number[]) => Promise<void>;
  themeSettings: ThemeSettings;
  setThemeSettings: (newSettings: Partial<ThemeSettings>) => void;
  isReady: boolean;
  resetUnreadCount: (chatId: number) => void;
}