export type MatchStatus = 'scheduled' | 'ongoing' | 'disputed' | 'completed' | 'cancelled';

export interface Stage {
  id: number;
  tournament_id: number;
  name: string;
  position: number;
  format: string;
}

export interface CreateStageInput {
  tournament_id: number;
  name: string;
  position: number;
  format: string;
}

export interface Match {
  id: number;
  stage_id: number;
  round_number: number;
  match_number: number;
  player_one_id: number | null;
  player_two_id: number | null;
  winner_id: number | null;
  referee_id: number | null;
  scheduled_at: string | null;
  score_one: number | null;
  score_two: number | null;
  status: MatchStatus;
  evidence_uri: string | null;
}

export interface CreateMatchInput {
  stage_id: number;
  round_number: number;
  match_number: number;
  player_one_id?: number | null;
  player_two_id?: number | null;
  scheduled_at?: string | null;
  referee_id?: number | null;
}

/** Match row enriched with the player/referee names needed to render it. */
export interface MatchDetails extends Match {
  player_one_name: string | null;
  player_two_name: string | null;
  winner_name: string | null;
  referee_name: string | null;
}
