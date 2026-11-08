export type MatchStatus = 'scheduled' | 'ongoing' | 'disputed' | 'completed' | 'cancelled';

export interface Stage {
  id: number;
  tournament_id: number;
  name: string;
  position: number;
  format: string;
  /** 1 once the organizer closed the stage — no more rounds can be added. */
  closed: number;
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
  /** Organizer's round details message, published with the result. */
  details: string | null;
}

export interface CreateMatchInput {
  stage_id: number;
  round_number: number;
  match_number: number;
  player_one_id?: number | null;
  player_two_id?: number | null;
  /** Every player taking part in this match (free-for-all rounds can host more than two). */
  participant_ids?: number[];
  scheduled_at?: string | null;
  referee_id?: number | null;
}

/** Match row enriched with the player/referee names needed to render it. */
export interface MatchDetails extends Match {
  player_one_name: string | null;
  player_two_name: string | null;
  winner_name: string | null;
  referee_name: string | null;
  /** All players assigned to the match (ordered); empty when the match is a plain 1v1 with only player_one/two set. */
  participant_ids: number[];
  participant_names: string[];
  /** Participants officially marked as eliminated in this match. */
  eliminated_ids: number[];
}
