export interface Player {
  id: number;
  user_id: number | null;
  display_name: string;
  avatar_uri: string | null;
  bio: string | null;
  country_id: number | null;
  favorite_game_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Ranking {
  id: number;
  player_id: number;
  game_id: number;
  rating: number;
  wins: number;
  losses: number;
  updated_at: string;
}

export interface CreatePlayerInput {
  display_name: string;
  user_id?: number | null;
  avatar_uri?: string | null;
  bio?: string | null;
  country_id?: number | null;
  favorite_game_id?: number | null;
}

/** Editable player-profile fields (RF-14); all of them are optional. */
export interface UpdatePlayerInput {
  display_name?: string;
  avatar_uri?: string | null;
  bio?: string | null;
  country_id?: number | null;
  favorite_game_id?: number | null;
}

export interface RankingWithPlayer extends Ranking {
  display_name: string;
}