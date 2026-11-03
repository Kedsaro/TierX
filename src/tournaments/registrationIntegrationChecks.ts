import type { SQLiteDatabase } from 'expo-sqlite';
import {
  gameRepository,
  countryRepository,
  playerRepository,
  registrationRepository,
  tournamentRepository,
  userRepository,
} from '../database/repositories';
import { evaluateRegistrationEligibility } from './registrationEligibility';

/**
 * RF-10 (T-070 to T-074): exercises the registration/participation flow
 * end-to-end against a real (but disposable) tournament, organizer and two
 * participants — capacity limits, a closed registration window, the
 * organizer-cannot-register restriction, duplicate-registration safety and
 * cancellation/re-registration.
 */
export async function runRegistrationIntegrationChecks(db: SQLiteDatabase): Promise<void> {
  const games = await gameRepository.list(db);
  const countries = await countryRepository.list(db);
  if (games.length === 0 || countries.length === 0) {
    throw new Error('Baseline catalog is required for registration checks.');
  }

  const suffix = `${Date.now()}`;
  const userIds: number[] = [];
  const playerIds: number[] = [];
  let openTournamentId: number | null = null;
  let closedTournamentId: number | null = null;

  async function makeParticipant(label: string): Promise<{ userId: number; playerId: number }> {
    const userId = await userRepository.create(db, {
      username: `reg-check-${label}-${suffix}`,
      email: `reg-check-${label}-${suffix}@example.invalid`,
      password_hash: 'test-hash-only',
      terms_accepted: true,
    });
    userIds.push(userId);
    const playerId = await playerRepository.create(db, {
      display_name: `Reg Check ${label} ${suffix}`,
      user_id: userId,
    });
    playerIds.push(playerId);
    return { userId, playerId };
  }

  try {
    const organizer = await makeParticipant('organizer');
    const participantA = await makeParticipant('a');
    const participantB = await makeParticipant('b');

    // A published, single-slot tournament with no explicit registration
    // window (so registration stays open until it starts).
    openTournamentId = await tournamentRepository.create(db, {
      name: `Registration Check Cup ${suffix}`,
      game_id: games[0].id,
      country_id: countries[0].id,
      organizer_id: organizer.userId,
      timezone: 'UTC',
      start_at: '2031-01-01T12:00:00.000Z',
      format: 'single_elimination',
      capacity: 1,
      status: 'published',
    });
    const openTournament = await tournamentRepository.getById(db, openTournamentId);
    if (!openTournament) throw new Error('The test tournament was not persisted.');

    // The organizer cannot register for their own tournament.
    const organizerEligibility = evaluateRegistrationEligibility(openTournament, 0, organizer.userId);
    if (organizerEligibility.canRegister) {
      throw new Error('An organizer was incorrectly allowed to register for their own tournament.');
    }

    // Participant A can register: the tournament is published, open, and has free capacity.
    const beforeCount = await registrationRepository.countActive(db, openTournamentId);
    const participantAEligibility = evaluateRegistrationEligibility(openTournament, beforeCount, participantA.userId);
    if (!participantAEligibility.canRegister) {
      throw new Error('A valid participant was incorrectly blocked from registering.');
    }
    await registrationRepository.register(db, openTournamentId, participantA.playerId);
    const afterFirstRegistration = await registrationRepository.getForPlayer(db, openTournamentId, participantA.playerId);
    if (afterFirstRegistration?.status !== 'registered') {
      throw new Error('Registering a participant did not persist a "registered" status.');
    }
    if ((await registrationRepository.countActive(db, openTournamentId)) !== 1) {
      throw new Error('The active registration count did not increase after registering.');
    }

    // Registering the same player again must not create a duplicate row
    // (tournament_id + player_id is unique) nor inflate the active count.
    await registrationRepository.register(db, openTournamentId, participantA.playerId);
    if ((await registrationRepository.countActive(db, openTournamentId)) !== 1) {
      throw new Error('Re-registering the same player created a duplicate active registration.');
    }

    // Capacity is now exhausted (1/1): a second participant must be rejected.
    const activeCountForB = await registrationRepository.countActive(db, openTournamentId);
    const participantBEligibility = evaluateRegistrationEligibility(openTournament, activeCountForB, participantB.userId);
    if (participantBEligibility.canRegister) {
      throw new Error('A participant was allowed to register for a tournament that is already at capacity.');
    }

    // Cancelling frees the participant's own status (not a capacity check,
    // but confirms the cancel/re-register round trip persists correctly).
    await registrationRepository.cancel(db, openTournamentId, participantA.playerId);
    const afterCancel = await registrationRepository.getForPlayer(db, openTournamentId, participantA.playerId);
    if (afterCancel?.status !== 'cancelled') {
      throw new Error('Cancelling a registration did not persist the "cancelled" status.');
    }
    if ((await registrationRepository.countActive(db, openTournamentId)) !== 0) {
      throw new Error('A cancelled registration is still being counted as active.');
    }

    // Re-registering after cancelling reactivates the same row instead of failing.
    await registrationRepository.register(db, openTournamentId, participantA.playerId);
    const afterReRegistration = await registrationRepository.getForPlayer(db, openTournamentId, participantA.playerId);
    if (afterReRegistration?.status !== 'registered' || afterReRegistration.id !== afterCancel.id) {
      throw new Error('Re-registering after cancellation did not reactivate the original registration row.');
    }

    // A tournament whose registration period already closed must reject
    // new registrations, even with free capacity.
    closedTournamentId = await tournamentRepository.create(db, {
      name: `Closed Registration Cup ${suffix}`,
      game_id: games[0].id,
      country_id: countries[0].id,
      organizer_id: organizer.userId,
      timezone: 'UTC',
      start_at: '2031-01-01T12:00:00.000Z',
      registration_opens_at: '2020-01-01T00:00:00.000Z',
      registration_closes_at: '2020-02-01T00:00:00.000Z',
      format: 'single_elimination',
      capacity: 10,
      status: 'published',
    });
    const closedTournament = await tournamentRepository.getById(db, closedTournamentId);
    if (!closedTournament) throw new Error('The closed-registration test tournament was not persisted.');
    const closedEligibility = evaluateRegistrationEligibility(closedTournament, 0, participantB.userId);
    if (closedEligibility.canRegister) {
      throw new Error('Registration was allowed after the registration period had already closed.');
    }
  } finally {
    if (openTournamentId !== null) await tournamentRepository.delete(db, openTournamentId);
    if (closedTournamentId !== null) await tournamentRepository.delete(db, closedTournamentId);
    for (const playerId of playerIds) await playerRepository.delete(db, playerId);
    for (const userId of userIds) await userRepository.delete(db, userId);
  }
}
