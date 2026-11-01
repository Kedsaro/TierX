export type TournamentDetailParams = {
  TournamentDetail: { tournamentId: number };
  /** Omit `tournamentId` to create a new tournament; include it to edit one. */
  TournamentForm: { tournamentId?: number } | undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
} & TournamentDetailParams;

export type TournamentsStackParamList = {
  TournamentsMain: undefined;
} & TournamentDetailParams;
