// Event and RSVP types

import type { User } from './auth';

export type RSVPStatus = 'going' | 'interested' | 'not_going';

export type EventRSVP = {
  event_id: number;
  user_id: string;
  status: RSVPStatus;
  profiles?: User; // Joined user profile for RSVP list
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
  status: 'active' | 'cancelled';
  is_deleted: boolean;
};