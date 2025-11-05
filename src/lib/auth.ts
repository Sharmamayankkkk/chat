// User and authentication-related types

export type User = {
  id: string; // uuid
  avatar_url: string;
  name: string;
  username: string;
  email?: string; // from auth.users
  gender?: 'male' | 'female';
  bio?: string;
  is_private?: boolean; // From our migration
  verified?: boolean;   // From our migration
};