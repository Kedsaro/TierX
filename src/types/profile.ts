import type { MatchDetails } from './match';

export type ProfilePrivacy = 'public' | 'private';

/** Row of `user_preferences`; `notifications_enabled` is stored as INTEGER in SQLite. */
export interface UserPreferences {
  user_id: number;
  privacy: ProfilePrivacy;
  notifications_enabled: number;
  updated_at: string;
}

/** Aggregated counters shown on the profile header (RF-13). */
export interface ProfileStats {
  organized: number;
  participating: number;
  wins: number;
  losses: number;
}

/** The signed-in player's standing inside one game's local leaderboard. */
export interface PlayerRankSummary {
  position: number;
  rating: number;
  wins: number;
  losses: number;
  total: number;
}

/** A completed match the player took part in, with its tournament context (profile history). */
export interface MatchHistoryItem extends MatchDetails {
  tournament_id: number;
  tournament_name: string;
  game_name: string;
}
