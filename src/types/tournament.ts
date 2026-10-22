export type TournamentStatus = 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
export type TournamentVisibility = 'public' | 'private' | 'unlisted';
export type TournamentScope = 'local' | 'regional' | 'national' | 'international';

export interface Tournament {
  id: number;
  name: string;
  description: string | null;
  image_uri: string | null;
  game_id: number;
  country_id: number;
  organizer_id: number;
  timezone: string;
  start_at: string;
  end_at: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  visibility: TournamentVisibility;
  scope: TournamentScope;
  format: string;
  capacity: number;
  rules: string | null;
  requirements: string | null;
  prizes: string | null;
  status: TournamentStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateTournamentInput {
  name: string;
  description?: string | null;
  image_uri?: string | null;
  game_id: number;
  country_id: number;
  organizer_id: number;
  timezone: string;
  start_at: string;
  end_at?: string | null;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  visibility?: TournamentVisibility;
  scope?: TournamentScope;
  format: string;
  capacity: number;
  rules?: string | null;
  requirements?: string | null;
  prizes?: string | null;
  status?: TournamentStatus;
}

export interface TournamentFilters {
  search?: string;
  gameId?: number;
  countryId?: number;
  organizerId?: number;
  status?: TournamentStatus;
  visibility?: TournamentVisibility;
  scope?: TournamentScope;
  startsAfter?: string;
  startsBefore?: string;
  limit?: number;
  /** Excludes draft tournaments, regardless of `status`. Used for public listings. */
  excludeDraft?: boolean;
}

/**
 * Tournament row enriched with the human-readable catalog names needed to
 * render a card without extra lookups, as returned by
 * `tournamentRepository.list`/`listFollowed`.
 */
export interface TournamentSummary extends Tournament {
  game_name: string;
  country_name: string;
  organizer_username: string;
}

/**
 * Tournament row enriched with human-readable catalog fields and the live
 * participant count, as returned by `tournamentRepository.getDetails`.
 */
export interface TournamentDetails extends TournamentSummary {
  participant_count: number;
}