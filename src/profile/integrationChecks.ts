import type { SQLiteDatabase } from 'expo-sqlite';
import {
  countryRepository,
  gameRepository,
  matchRepository,
  playerRepository,
  preferencesRepository,
  profileRepository,
  rankingRepository,
  registrationRepository,
  stageRepository,
  tournamentRepository,
  userRepository,
} from '../database/repositories';
import { validateProfileForm } from './validation';

/**
 * RF-13/RF-14 (T-090 to T-094): exercises the profile read-model and the edit
 * flow end-to-end — default preferences, editable field updates (avatar, bio,
 * country, favorite game), privacy/notification persistence, form validation
 * (including rejecting bad input, i.e. the "cancel/invalid save" path), the
 * aggregated stats, the local leaderboard position after a published result
 * and the match history feed.
 */
export async function runProfileIntegrationChecks(db: SQLiteDatabase): Promise<void> {
  const games = await gameRepository.list(db);
  const countries = await countryRepository.list(db);
  if (games.length === 0 || countries.length === 0) {
    throw new Error('Baseline catalog is required for profile checks.');
  }

  const suffix = `${Date.now()}`;
  const userIds: number[] = [];
  const playerIds: number[] = [];
  let tournamentId: number | null = null;

  async function makeUser(label: string): Promise<{ userId: number; playerId: number }> {
    const userId = await userRepository.create(db, {
      username: `prof-check-${label}-${suffix}`,
      email: `prof-check-${label}-${suffix}@example.invalid`,
      password_hash: 'test-hash-only',
      terms_accepted: true,
    });
    userIds.push(userId);
    const playerId = await playerRepository.getOrCreateByUserId(db, userId, `Prof Check ${label} ${suffix}`)
      .then((player) => player.id);
    playerIds.push(playerId);
    return { userId, playerId };
  }

  try {
    const organizer = await makeUser('organizer');
    const participant = await makeUser('participant');

    // --- Preferences defaults and update (T-092) ----------------------
    const defaultPreferences = await preferencesRepository.getForUser(db, participant.userId);
    if (defaultPreferences.privacy !== 'public' || defaultPreferences.notifications_enabled !== 1) {
      throw new Error('Default user preferences were not created with public privacy and notifications enabled.');
    }
    await preferencesRepository.update(db, participant.userId, { privacy: 'private', notifications_enabled: false });
    const updatedPreferences = await preferencesRepository.getForUser(db, participant.userId);
    if (updatedPreferences.privacy !== 'private' || updatedPreferences.notifications_enabled !== 0) {
      throw new Error('Updating privacy/notification preferences did not persist.');
    }

    // --- Editable profile fields (T-092) -------------------------------
    await playerRepository.update(db, participant.playerId, {
      display_name: `Renamed Player ${suffix}`,
      bio: 'Integration test bio',
      avatar_uri: 'https://example.invalid/avatar.png',
      country_id: countries[0].id,
      favorite_game_id: games[0].id,
    });
    const updatedPlayer = await playerRepository.getById(db, participant.playerId);
    if (
      updatedPlayer?.display_name !== `Renamed Player ${suffix}`
      || updatedPlayer.bio !== 'Integration test bio'
      || updatedPlayer.avatar_uri !== 'https://example.invalid/avatar.png'
      || updatedPlayer.country_id !== countries[0].id
      || updatedPlayer.favorite_game_id !== games[0].id
    ) {
      throw new Error('Updating the editable profile fields did not persist.');
    }

    // --- Form validation: invalid saves are rejected (T-094) -----------
    const invalidErrors = validateProfileForm({
      username: 'x',
      email: 'not-an-email',
      displayName: '   ',
      bio: 'a'.repeat(281),
      avatarUri: 'ftp://avatar',
    });
    if (!invalidErrors.username || !invalidErrors.email || !invalidErrors.displayName || !invalidErrors.bio || !invalidErrors.avatarUri) {
      throw new Error('Profile validation did not reject all the invalid fields.');
    }
    const validErrors = validateProfileForm({
      username: `prof-check-${suffix}`.slice(0, 24),
      email: `prof-check-${suffix}@example.invalid`,
      displayName: `Renamed Player ${suffix}`,
      bio: 'Integration test bio',
      avatarUri: 'https://example.invalid/avatar.png',
    });
    if (Object.keys(validErrors).length > 0) {
      throw new Error(`Profile validation rejected a valid form: ${JSON.stringify(validErrors)}`);
    }

    // --- Stats, tournaments created/participated (T-090, T-091) --------
    tournamentId = await tournamentRepository.create(db, {
      name: `Profile Check Cup ${suffix}`,
      game_id: games[0].id,
      country_id: countries[0].id,
      organizer_id: organizer.userId,
      timezone: 'UTC',
      start_at: '2031-02-01T12:00:00.000Z',
      format: 'single_elimination',
      capacity: 4,
      status: 'published',
    });
    await registrationRepository.register(db, tournamentId, participant.playerId);

    const participantStats = await profileRepository.getStats(db, participant.userId, participant.playerId);
    if (participantStats.participating !== 1 || participantStats.organized !== 0) {
      throw new Error('Profile stats did not count the active participation.');
    }
    const organizerStats = await profileRepository.getStats(db, organizer.userId, organizer.playerId);
    if (organizerStats.organized !== 1) {
      throw new Error('Profile stats did not count the organized tournament.');
    }
    const createdList = await tournamentRepository.list(db, { organizerId: organizer.userId });
    if (!createdList.some((tournament) => tournament.id === tournamentId)) {
      throw new Error('The "created" profile list does not include the organized tournament.');
    }
    const participatingList = await tournamentRepository.listFollowed(db, participant.playerId);
    if (!participatingList.some((tournament) => tournament.id === tournamentId)) {
      throw new Error('The "participating" profile list does not include the registered tournament.');
    }

    // --- Local ranking and match history (T-090, T-093) ----------------
    const emptyRank = await profileRepository.getRankForGame(db, participant.playerId, games[1]?.id ?? games[0].id);
    if (emptyRank !== null && games[1] !== undefined) {
      throw new Error('A player with no matches should not have a leaderboard position.');
    }

    const stageId = await stageRepository.create(db, {
      tournament_id: tournamentId,
      name: 'Final',
      position: 1,
      format: 'single_elimination',
    });
    const matchId = await matchRepository.create(db, { stage_id: stageId, round_number: 1, match_number: 1 });
    await matchRepository.assign(db, matchId, {
      player_one_id: participant.playerId,
      player_two_id: organizer.playerId,
      scheduled_at: '2031-02-01T13:00:00.000Z',
      referee_id: null,
    });
    await matchRepository.markOngoing(db, matchId);
    await matchRepository.recordResult(db, matchId, {
      score_one: 2,
      score_two: 0,
      winner_id: participant.playerId,
      evidence_uri: null,
    });
    await rankingRepository.recordMatchOutcome(db, games[0].id, participant.playerId, organizer.playerId);

    const rank = await profileRepository.getRankForGame(db, participant.playerId, games[0].id);
    if (!rank || rank.position !== 1 || rank.wins !== 1 || rank.rating <= 1000) {
      throw new Error('The local leaderboard position was not computed after publishing a result.');
    }
    const updatedStats = await profileRepository.getStats(db, participant.userId, participant.playerId);
    if (updatedStats.wins !== 1 || updatedStats.losses !== 0) {
      throw new Error('Profile stats did not reflect the published match outcome.');
    }

    const history = await profileRepository.listMatchHistory(db, participant.playerId);
    const historyItem = history.find((item) => item.id === matchId);
    if (!historyItem || historyItem.tournament_id !== tournamentId || historyItem.winner_id !== participant.playerId) {
      throw new Error('The match history does not include the completed match with its tournament context.');
    }
  } finally {
    if (tournamentId !== null) await tournamentRepository.delete(db, tournamentId);
    for (const playerId of playerIds) await playerRepository.delete(db, playerId);
    for (const userId of userIds) await userRepository.delete(db, userId);
  }
}
