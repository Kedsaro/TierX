export type TournamentEventStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

export interface TournamentEvent {
  id: number;
  tournament_id: number;
  name: string;
  starts_at: string;
  ends_at: string | null;
  status: TournamentEventStatus;
  /** Streaming channel or viewing link shown while the event is active. */
  stream_url: string | null;
  created_at: string;
}

export interface CreateEventInput {
  tournament_id: number;
  name: string;
  starts_at: string;
  ends_at?: string | null;
  stream_url?: string | null;
  status?: TournamentEventStatus;
}

/** Event row enriched with the data needed to render it without extra lookups. */
export interface EventSummary extends TournamentEvent {
  tournament_name: string;
  tournament_status: string;
  game_name: string;
  organizer_id: number;
  organizer_username: string;
}
