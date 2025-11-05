import type { User } from './auth';

export type PollOption = {
  id: number;
  text: string;
  votes: number;
  votedBy: string[]; // Array of user_ids
};

export type Poll = {
  question: string;
  options: PollOption[];
  totalVotes: number;
  allowMultipleChoices?: boolean;
  endsAt: string | null;
};

export type Media = {
  url: string;
  type: 'image' | 'video' | 'gif';
  alt?: string;
};

export type Comment = {
  id: number | string; // Allow string for optimistic ID
  user_id: string;
  post_id: number;
  parent_comment_id: number | null;
  content: string;
  created_at: string;
  
  // Joined/calculated data
  author: User;
  likes: number;
  likedBy: string[];
  replies: Comment[];
};

export type Post = {
  id: number | string;
  user_id: string;
  content: string | null;
  media_urls: Media[] | null; // This is the DB column name
  poll: Poll | null;
  quote_of_id: number | null;
  created_at: string;
  
  // This is all the data we add in the app
  author: User; // Joined from user_id
  quote_of?: Post | null; // Joined from quote_of_id
  comments: Comment[];
  likes: string[]; // Array of user_ids who liked
  
  stats: {
    comments: number;
    reposts: number;
    quotes: number;
    likes: number;
    views: number;
    bookmarks: number;
  };
  
  // These are for client-side state
  savedBy?: string[];
  repostedBy?: string[];
};