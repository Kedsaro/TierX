import type { SQLiteDatabase } from 'expo-sqlite';
import {
  eventRepository,
  gameRepository,
  countryRepository,
  matchRepository,
  playerRepository,
  rankingRepository,
  registrationRepository,
  stageRepository,
  tournamentRepository,
  userRepository,
} from '../database/repositories';
import { canManageTournament } from './authorization';
import { availableMatchActions } from './matchActions';
import { validateMatchResult } from './matchValidation';

/**
 * RF-11/RF-12 (T-080 to T-086): exercises the events/bracket/results flow
 * end-to-end — scheduling an event and moving it through its lifecycle,
 * building a stage and a match, assigning participants/schedule/referee,
 * validating and publishing a result (which must update rankings), flagging
 * and resolving a dispute, and confirming only the organizer is recognized
 * as authorized to manage any of it.
 */
export async function runEventsIntegrationChecks(db: SQLiteDatabase): Promise<void> {
  const games = await gameRepository.list(db);
  const countries = await countryRepository.list(db);
  if (games.length === 0 || countries.length === 0) {
    throw new Error('Baseline catalog is required for events/bracket checks.');
  }

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const userIds: number[] = [];
  const playerIds: number[] = [];
  let tournamentId: number | null = null;
  let eventId: number | null = null;

  async function makeParticipant(label: string): Promise<{ userId: number; playerId: number }> {
    const userId = await userRepository.create(db, {
      username: `evt-check-${label}-${suffix}`,
      email: `evt-check-${label}-${suffix}@example.invalid`,
      password_hash: 'test-hash-only',
      terms_accepted: true,
    });
    userIds.push(userId);
    const playerId = await playerRepository.create(db, { display_name: `Evt Check ${label} ${suffix}`, user_id: userId });
    playerIds.push(playerId);
    return { userId, playerId };
  }

  try {
    const organizer = await makeParticipant('organizer');
    const outsider = await makeParticipant('outsider');
    const playerA = await makeParticipant('a');
    const playerB = await makeParticipant('b');

    tournamentId = await tournamentRepository.create(db, {
      name: `Events Check Cup ${suffix}`,
      game_id: games[0].id,
      country_id: countries[0].id,
      organizer_id: organizer.userId,
      timezone: 'UTC',
      start_at: '2031-01-01T12:00:00.000Z',
      format: 'single_elimination',
      capacity: 2,
      status: 'published',
    });
    await registrationRepository.register(db, tournamentId, playerA.playerId);
    await registrationRepository.register(db, tournamentId, playerB.playerId);

    const tournament = await tournamentRepository.getById(db, tournamentId);
    if (!tournament) throw new Error('The test tournament was not persisted.');
    if (!canManageTournament(tournament, organizer.userId)) {
      throw new Error('The organizer was not recognized as authorized to manage the tournament/events/bracket.');
    }
    if (canManageTournament(tournament, outsider.userId)) {
      throw new Error('An unrelated user was incorrectly authorized to manage the tournament/events/bracket.');
    }

    // --- Events (T-080, T-081) ---------------------------------------
    eventId = await eventRepository.create(db, {
      tournament_id: tournamentId,
      name: `Opening Broadcast ${suffix}`,
      starts_at: '2031-01-01T11:00:00.000Z',
      stream_url: 'https://example.invalid/stream',
    });
    const upcomingForOrganizer = await eventRepository.listForUser(db, { userId: organizer.userId, playerId: null, status: 'upcoming' });
    if (!upcomingForOrganizer.some((item) => item.id === eventId)) {
      throw new Error('The organizer did not see their own scheduled event in the "upcoming" bucket.');
    }
    const upcomingForParticipant = await eventRepository.listForUser(db, { userId: playerA.userId, playerId: playerA.playerId, status: 'upcoming' });
    if (!upcomingForParticipant.some((item) => item.id === eventId)) {
      throw new Error('A registered participant did not see the tournament\'s event in the "upcoming" bucket.');
    }
    const upcomingForOutsider = await eventRepository.listForUser(db, { userId: outsider.userId, playerId: outsider.playerId, status: 'upcoming' });
    if (upcomingForOutsider.some((item) => item.id === eventId)) {
      throw new Error('An unrelated user incorrectly saw an event for a tournament they have no part in.');
    }

    await eventRepository.updateStatus(db, eventId, 'active');
    const activeDetails = await eventRepository.getDetails(db, eventId);
    if (activeDetails?.status !== 'active') {
      throw new Error('Marking an event as active did not persist.');
    }
    const activeForParticipant = await eventRepository.listForUser(db, { userId: playerA.userId, playerId: playerA.playerId, status: 'active' });
    if (!activeForParticipant.some((item) => item.id === eventId)) {
      throw new Error('An active event did not show up in the "active" bucket for a registered participant.');
    }

    // --- Stages and matches (T-082, T-083) ----------------------------
    const stageId = await stageRepository.create(db, {
      tournament_id: tournamentId,
      name: 'Grand Final',
      position: 1,
      format: 'single_elimination',
    });
    const matchId = await matchRepository.create(db, { stage_id: stageId, round_number: 1, match_number: 1 });

    await matchRepository.assign(db, matchId, {
      player_one_id: playerA.playerId,
      player_two_id: playerB.playerId,
      scheduled_at: '2031-01-01T11:30:00.000Z',
      referee_id: organizer.playerId,
    });
    const assignedMatch = await matchRepository.getDetails(db, matchId);
    if (!assignedMatch || assignedMatch.player_one_name === null || assignedMatch.player_two_name === null || assignedMatch.referee_name === null) {
      throw new Error('Assigning participants, a schedule and a referee to a match did not persist correctly.');
    }
    if (!availableMatchActions('scheduled').includes('recordResult')) {
      throw new Error('A scheduled match with both participants assigned should allow recording a result.');
    }

    await matchRepository.markOngoing(db, matchId);
    const ongoingMatch = await matchRepository.getById(db, matchId);
    if (ongoingMatch?.status !== 'ongoing') {
      throw new Error('Starting a match did not persist the "ongoing" status.');
    }

    // --- Disputes (T-084) ---------------------------------------------
    await matchRepository.markDisputed(db, matchId);
    const disputedMatch = await matchRepository.getById(db, matchId);
    if (disputedMatch?.status !== 'disputed') {
      throw new Error('Flagging a match as disputed did not persist.');
    }
    if (!availableMatchActions('disputed').includes('resolveDispute') || availableMatchActions('disputed').includes('recordResult')) {
      throw new Error('A disputed match must be resolved (back to ongoing) before a result can be recorded.');
    }
    await matchRepository.updateStatus(db, matchId, 'ongoing');

    // A tie must be rejected: there is always a winner.
    const tieValidation = validateMatchResult({
      playerOneId: playerA.playerId,
      playerTwoId: playerB.playerId,
      scoreOneText: '2',
      scoreTwoText: '2',
    });
    if (tieValidation.result) {
      throw new Error('Match result validation accepted a tie, which should always be rejected.');
    }
    // An unassigned participant must also be rejected.
    const missingParticipantValidation = validateMatchResult({
      playerOneId: null,
      playerTwoId: playerB.playerId,
      scoreOneText: '2',
      scoreTwoText: '1',
    });
    if (missingParticipantValidation.result) {
      throw new Error('Match result validation accepted a result with an unassigned participant.');
    }

    // --- Recording and publishing a result (T-084, T-085) --------------
    const { errors, result } = validateMatchResult({
      playerOneId: playerA.playerId,
      playerTwoId: playerB.playerId,
      scoreOneText: '3',
      scoreTwoText: '1',
    });
    if (!result) {
      throw new Error(`Match result validation unexpectedly rejected a valid result: ${JSON.stringify(errors)}`);
    }
    await matchRepository.recordResult(db, matchId, {
      score_one: result.scoreOne,
      score_two: result.scoreTwo,
      winner_id: result.winnerId,
      evidence_uri: null,
    });

    const winnerRankingBefore = await rankingRepository.listByGame(db, tournament.game_id);
    const winnerEntryBefore = winnerRankingBefore.find((row) => row.player_id === result.winnerId);
    await rankingRepository.recordMatchOutcome(db, tournament.game_id, result.winnerId, result.loserId);

    const completedMatch = await matchRepository.getDetails(db, matchId);
    if (completedMatch?.status !== 'completed' || completedMatch.winner_id !== playerA.playerId) {
      throw new Error('Publishing a match result did not persist the completed status and winner.');
    }
    const finalMatch = await matchRepository.getFinalForTournament(db, tournamentId);
    if (finalMatch?.id !== matchId) {
      throw new Error('The completed match was not returned as the tournament\'s final result.');
    }

    const rankingsAfter = await rankingRepository.listByGame(db, tournament.game_id);
    const winnerEntryAfter = rankingsAfter.find((row) => row.player_id === result.winnerId);
    const loserEntryAfter = rankingsAfter.find((row) => row.player_id === result.loserId);
    if (!winnerEntryAfter || winnerEntryAfter.wins !== (winnerEntryBefore?.wins ?? 0) + 1) {
      throw new Error('Publishing a result did not increment the winner\'s win count in the rankings.');
    }
    if (!loserEntryAfter || loserEntryAfter.losses !== 1) {
      throw new Error('Publishing a result did not increment the loser\'s loss count in the rankings.');
    }
    if (winnerEntryAfter.rating <= 1000) {
      throw new Error('Publishing a result did not increase the winner\'s rating.');
    }

    // --- Finishing the event (T-080, T-081) -----------------------------
    await eventRepository.updateStatus(db, eventId, 'completed');
    const completedForParticipant = await eventRepository.listForUser(db, { userId: playerA.userId, playerId: playerA.playerId, status: 'completed' });
    if (!completedForParticipant.some((item) => item.id === eventId)) {
      throw new Error('A finished event did not show up in the "finished" bucket for a registered participant.');
    }
  } finally {
    if (tournamentId !== null) await tournamentRepository.delete(db, tournamentId);
    for (const playerId of playerIds) await playerRepository.delete(db, playerId);
    for (const userId of userIds) await userRepository.delete(db, userId);
  }
}
