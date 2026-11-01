import type { SQLiteDatabase } from 'expo-sqlite';
import { gameRepository, countryRepository, tournamentRepository, userRepository } from '../database/repositories';
import { availableActions, canManageTournament } from './authorization';
import { emptyTournamentForm, parseLocalDateTime, validateTournamentForm } from './validation';

export async function runTournamentManagementIntegrationChecks(db: SQLiteDatabase): Promise<void> {
  // Pure validation checks: no database access needed.
  const invalidForm = {
    ...emptyTournamentForm(),
    name: 'Invalid Dates Cup',
    gameId: 1,
    countryId: 1,
    startAt: '2026-02-10 12:00',
    endAt: '2026-02-09 12:00',
    format: 'single_elimination',
    capacity: '8',
  };
  if (!validateTournamentForm(invalidForm).endAt) {
    throw new Error('Form validation did not reject an end date before the start date.');
  }

  const invalidCapacityForm = { ...invalidForm, endAt: '', capacity: '0' };
  if (!validateTournamentForm(invalidCapacityForm).capacity) {
    throw new Error('Form validation did not reject a zero capacity.');
  }

  const validForm = { ...invalidForm, endAt: '2026-02-11 12:00' };
  if (Object.keys(validateTournamentForm(validForm)).length > 0) {
    throw new Error('Form validation rejected a valid submission.');
  }
  if (!parseLocalDateTime(validForm.startAt)) {
    throw new Error('A well-formed local date/time failed to parse.');
  }

  const games = await gameRepository.list(db);
  const countries = await countryRepository.list(db);
  if (games.length === 0 || countries.length === 0) {
    throw new Error('Baseline catalog is required for tournament management checks.');
  }

  const suffix = `${Date.now()}`;
  let organizerId: number | null = null;
  let otherUserId: number | null = null;
  let tournamentId: number | null = null;

  try {
    organizerId = await userRepository.create(db, {
      username: `mgmt-check-${suffix}`,
      email: `mgmt-check-${suffix}@example.invalid`,
      password_hash: 'test-hash-only',
      terms_accepted: true,
    });
    otherUserId = await userRepository.create(db, {
      username: `mgmt-check-other-${suffix}`,
      email: `mgmt-check-other-${suffix}@example.invalid`,
      password_hash: 'test-hash-only',
      terms_accepted: true,
    });

    tournamentId = await tournamentRepository.create(db, {
      name: `Management Check Cup ${suffix}`,
      game_id: games[0].id,
      country_id: countries[0].id,
      organizer_id: organizerId,
      timezone: 'UTC',
      start_at: '2030-06-01T12:00:00.000Z',
      format: 'single_elimination',
      capacity: 8,
      status: 'draft',
    });

    const draftTournament = await tournamentRepository.getById(db, tournamentId);
    if (!draftTournament || draftTournament.status !== 'draft') {
      throw new Error('New tournament was not persisted as a draft.');
    }

    if (!canManageTournament(draftTournament, organizerId)) {
      throw new Error('The organizer was not recognized as authorized to manage their own tournament.');
    }
    if (canManageTournament(draftTournament, otherUserId)) {
      throw new Error('A different user was incorrectly authorized to manage someone else\'s tournament.');
    }

    const draftActions = availableActions('draft');
    if (!draftActions.includes('publish') || !draftActions.includes('edit') || draftActions.includes('unpublish')) {
      throw new Error('Draft tournaments do not expose the expected management actions.');
    }

    await tournamentRepository.updateStatus(db, tournamentId, 'published');
    const publishedTournament = await tournamentRepository.getById(db, tournamentId);
    if (publishedTournament?.status !== 'published') {
      throw new Error('Publishing a draft tournament did not persist.');
    }

    const publishedActions = availableActions('published');
    if (!publishedActions.includes('unpublish') || !publishedActions.includes('cancel') || !publishedActions.includes('close')) {
      throw new Error('Published tournaments do not expose the expected management actions.');
    }

    await tournamentRepository.updateStatus(db, tournamentId, 'completed');
    const completedTournament = await tournamentRepository.getById(db, tournamentId);
    if (completedTournament?.status !== 'completed') {
      throw new Error('Closing a published tournament did not persist.');
    }
    if (availableActions('completed').includes('edit')) {
      throw new Error('Completed tournaments should not be editable.');
    }

    await tournamentRepository.updateStatus(db, tournamentId, 'cancelled');
    const cancelledTournament = await tournamentRepository.getById(db, tournamentId);
    if (cancelledTournament?.status !== 'cancelled') {
      throw new Error('Cancelling a published tournament did not persist.');
    }
    if (availableActions('cancelled').length !== 0) {
      throw new Error('Cancelled tournaments should not expose any further management actions.');
    }
    if (availableActions('cancelled').includes('edit')) {
      throw new Error('Cancelled tournaments should not be editable.');
    }
  } finally {
    if (tournamentId !== null) await tournamentRepository.delete(db, tournamentId);
    if (organizerId !== null) await userRepository.delete(db, organizerId);
    if (otherUserId !== null) await userRepository.delete(db, otherUserId);
  }
}
