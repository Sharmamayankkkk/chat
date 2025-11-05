// User and authentication-related types

export type User = {
    id: string; // uuid
    avatar_url: string;
    name: string;
    username: string;
    email?: string; // from auth.users
    gender?: 'male' | 'female';
    bio?: string;
  };
  
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
    message?: Partial<import('./chat').Message>;
  };