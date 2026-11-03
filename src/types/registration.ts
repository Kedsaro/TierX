export type RegistrationStatus = 'pending' | 'registered' | 'waitlisted' | 'cancelled' | 'rejected';

export interface Registration {
  id: number;
  tournament_id: number;
  player_id: number;
  status: RegistrationStatus;
  registered_at: string;
}

/** Statuses that count as an active participation (visible in "Following", counted against capacity). */
export const ACTIVE_REGISTRATION_STATUSES: RegistrationStatus[] = ['pending', 'registered', 'waitlisted'];
