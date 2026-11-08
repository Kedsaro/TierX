import type { SQLiteDatabase } from 'expo-sqlite';
import { gameRepository, countryRepository, tournamentRepository, userRepository } from '../database/repositories';
import { availableActions, canManageTournament } from './authorization';
import { timezonesForCountryCode } from './timezones';
import {
  emptyTournamentForm,
  minimumScheduleDateTime,
  parseLocalDateTime,
  snapToFiveMinutes,
  validateTournamentForm,
} from './validation';

/** Formats a `Date` as `YYYY-MM-DD HH:MM`, matching the pickers' output. */
function toFormValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function runTournamentManagementIntegrationChecks(db: SQLiteDatabase): Promise<void> {
  // Pure validation checks: no database access needed.
  // Dates are computed relative to "now" (well beyond the RF-20 minimum of
  // now + 24h) so this check never becomes stale. Snapped to a 5-minute mark
  // up front so every offset derived from it (whole hours/days) stays valid
  // under the "multiples of 5 minutes" rule.
  const farFutureStart = snapToFiveMinutes(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));
  const farFutureEndBeforeStart = new Date(farFutureStart.getTime() - 24 * 60 * 60 * 1000);
  const farFutureEndAfterStart = new Date(farFutureStart.getTime() + 24 * 60 * 60 * 1000);

  const invalidForm = {
    ...emptyTournamentForm(),
    name: 'Invalid Dates Cup',
    gameId: 1,
    countryId: 1,
    timezone: 'America/Bogota',
    startAt: toFormValue(farFutureStart),
    endAt: toFormValue(farFutureEndBeforeStart),
    format: 'single_elimination',
    capacity: '8',
  };
  if (!validateTournamentForm(invalidForm).endAt) {
    throw new Error('Form validation did not reject an end date before the start date.');
  }

  // The end date/time must be strictly after the start: the exact same
  // instant (same date, same hour and minute) must also be rejected.
  const sameInstantForm = { ...invalidForm, endAt: invalidForm.startAt };
  if (!validateTournamentForm(sameInstantForm).endAt) {
    throw new Error('Form validation did not reject an end date/time equal to the start date/time.');
  }

  const invalidCapacityForm = { ...invalidForm, endAt: '', capacity: '0' };
  if (!validateTournamentForm(invalidCapacityForm).capacity) {
    throw new Error('Form validation did not reject a zero capacity.');
  }

  // RF-20: any of the four schedule fields set to less than now + 24h must
  // be rejected, even if it is otherwise well-formed and internally consistent.
  const tooSoonForm = {
    ...invalidForm,
    startAt: toFormValue(snapToFiveMinutes(new Date(Date.now() + 60 * 60 * 1000))),
    endAt: '',
  };
  if (!validateTournamentForm(tooSoonForm).startAt) {
    throw new Error('Form validation did not reject a start date less than 24 hours from now.');
  }
  const safelyFutureForm = {
    ...invalidForm,
    startAt: toFormValue(snapToFiveMinutes(new Date(minimumScheduleDateTime().getTime() + 15 * 60 * 1000))),
    endAt: '',
  };
  if (validateTournamentForm(safelyFutureForm).startAt) {
    throw new Error('Form validation rejected a start date safely past the 24-hour minimum.');
  }

  const validForm = { ...invalidForm, endAt: toFormValue(farFutureEndAfterStart) };
  if (Object.keys(validateTournamentForm(validForm)).length > 0) {
    throw new Error('Form validation rejected a valid submission.');
  }
  if (!parseLocalDateTime(validForm.startAt)) {
    throw new Error('A well-formed local date/time failed to parse.');
  }

  // RF-20: only times on a 5-minute mark are accepted; off-grid minutes
  // (e.g. :07, :22) must be rejected even when everything else is valid.
  const offGridMinutesForm = { ...validForm, startAt: `${validForm.startAt.slice(0, -1)}7` };
  if (!validateTournamentForm(offGridMinutesForm).startAt) {
    throw new Error('Form validation did not reject a start time with minutes that are not a multiple of 5.');
  }

  // The tournament must last at least 1 day: an end date/time after the
  // start but less than 24 hours later must still be rejected.
  const tooShortTournamentForm = {
    ...validForm,
    endAt: toFormValue(new Date(farFutureStart.getTime() + 60 * 60 * 1000)),
  };
  if (!validateTournamentForm(tooShortTournamentForm).endAt) {
    throw new Error('Form validation did not reject a tournament shorter than 1 day.');
  }
  if (Object.keys(validateTournamentForm(validForm)).length > 0) {
    throw new Error('Form validation rejected a tournament lasting exactly 1 day.');
  }

  // Registration must close at least 24 hours before the tournament starts;
  // closing after the start must also be rejected.
  const registrationAfterStartForm = {
    ...validForm,
    registrationClosesAt: toFormValue(new Date(farFutureStart.getTime() + 60 * 60 * 1000)),
  };
  if (!validateTournamentForm(registrationAfterStartForm).registrationClosesAt) {
    throw new Error('Form validation did not reject registration closing after the tournament starts.');
  }
  const registrationTooCloseToStartForm = {
    ...validForm,
    registrationClosesAt: toFormValue(new Date(farFutureStart.getTime() - 60 * 60 * 1000)),
  };
  if (!validateTournamentForm(registrationTooCloseToStartForm).registrationClosesAt) {
    throw new Error('Form validation did not reject registration closing less than 24 hours before the start.');
  }
  const registrationOneDayBeforeStartForm = {
    ...validForm,
    registrationClosesAt: toFormValue(new Date(farFutureStart.getTime() - 24 * 60 * 60 * 1000)),
  };
  if (validateTournamentForm(registrationOneDayBeforeStartForm).registrationClosesAt) {
    throw new Error('Form validation rejected registration closing exactly 24 hours before the start.');
  }

  // Registration may open the same day: only "not in the past" and "closes
  // at least 1 hour after it opens" are enforced, independent of the
  // tournament's own 24-hour floor.
  const registrationOpensInPastForm = {
    ...validForm,
    registrationOpensAt: toFormValue(snapToFiveMinutes(new Date(Date.now() - 60 * 60 * 1000))),
  };
  if (!validateTournamentForm(registrationOpensInPastForm).registrationOpensAt) {
    throw new Error('Form validation did not reject registration opening in the past.');
  }
  const registrationOpensSoonForm = {
    ...validForm,
    registrationOpensAt: toFormValue(snapToFiveMinutes(new Date(Date.now() + 15 * 60 * 1000))),
  };
  if (validateTournamentForm(registrationOpensSoonForm).registrationOpensAt) {
    throw new Error('Form validation rejected registration opening later today.');
  }
  const registrationOpensSoonDate = new Date(parseLocalDateTime(registrationOpensSoonForm.registrationOpensAt)!);
  const registrationTooShortForm = {
    ...registrationOpensSoonForm,
    registrationClosesAt: toFormValue(snapToFiveMinutes(new Date(registrationOpensSoonDate.getTime() + 30 * 60 * 1000))),
  };
  if (!validateTournamentForm(registrationTooShortForm).registrationClosesAt) {
    throw new Error('Form validation did not reject a registration window shorter than 1 hour.');
  }
  const registrationExactlyOneHourForm = {
    ...registrationOpensSoonForm,
    registrationClosesAt: toFormValue(snapToFiveMinutes(new Date(registrationOpensSoonDate.getTime() + 60 * 60 * 1000))),
  };
  if (validateTournamentForm(registrationExactlyOneHourForm).registrationClosesAt) {
    throw new Error('Form validation rejected a registration window of exactly 1 hour.');
  }

  // RF-19: timezone options are filtered by country and invalid
  // country/timezone combinations are rejected.
  const colombiaZones = timezonesForCountryCode('CO');
  if (colombiaZones.length !== 1 || colombiaZones[0] !== 'America/Bogota') {
    throw new Error('Colombia should only offer America/Bogota as its timezone.');
  }
  const usZones = timezonesForCountryCode('US');
  if (!usZones.includes('America/New_York') || usZones.includes('Europe/Madrid')) {
    throw new Error('United States timezone options are incorrect.');
  }
  if (timezonesForCountryCode('ZZ').length === 0 || timezonesForCountryCode(null).length !== 0) {
    throw new Error('Unknown country codes should fall back to UTC and missing codes to no options.');
  }
  const wrongZoneForm = { ...validForm, timezone: 'Europe/Madrid' };
  if (!validateTournamentForm(wrongZoneForm, colombiaZones).timezone) {
    throw new Error('Form validation did not reject a timezone invalid for the chosen country.');
  }
  if (validateTournamentForm(validForm, colombiaZones).timezone) {
    throw new Error('Form validation rejected a timezone valid for the chosen country.');
  }

  const games = await gameRepository.list(db);
  const countries = await countryRepository.list(db);
  if (games.length === 0 || countries.length === 0) {
    throw new Error('Baseline catalog is required for tournament management checks.');
  }

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
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
