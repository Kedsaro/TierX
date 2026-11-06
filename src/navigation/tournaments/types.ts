export type TournamentDetailParams = {
  TournamentDetail: { tournamentId: number };
  /** Omit `tournamentId` to create a new tournament; include it to edit one. */
  TournamentForm: { tournamentId?: number } | undefined;
  EventDetail: { eventId: number };
  Bracket: { tournamentId: number };
};

export type HomeStackParamList = {
  HomeMain: undefined;
} & TournamentDetailParams;

export type TournamentsStackParamList = {
  TournamentsMain: undefined;
} & TournamentDetailParams;

export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  Admin: undefined;
} & TournamentDetailParams;
