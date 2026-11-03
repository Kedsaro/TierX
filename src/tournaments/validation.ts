import type { TournamentScope, TournamentVisibility } from '../types/tournament';

export interface TournamentFormValues {
  name: string;
  description: string;
  imageUri: string;
  gameId: number | undefined;
  countryId: number | undefined;
  timezone: string;
  startAt: string;
  endAt: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  visibility: TournamentVisibility;
  scope: TournamentScope;
  format: string;
  capacity: string;
  rules: string;
  requirements: string;
  prizes: string;
}

export type TournamentFormErrors = Partial<Record<keyof TournamentFormValues, string>>;

export function emptyTournamentForm(): TournamentFormValues {
  return {
    name: '',
    description: '',
    imageUri: '',
    gameId: undefined,
    countryId: undefined,
    timezone: '',
    startAt: '',
    endAt: '',
    registrationOpensAt: '',
    registrationClosesAt: '',
    visibility: 'public',
    scope: 'local',
    format: 'single_elimination',
    capacity: '',
    rules: '',
    requirements: '',
    prizes: '',
  };
}

/** Parses a datetime-local-ish string (`YYYY-MM-DD HH:MM`) into an ISO string, or null if invalid/empty. */
export function parseLocalDateTime(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Parses a datetime-local-ish string (`YYYY-MM-DD HH:MM`) into a `Date`, or null if invalid/empty. */
export function parseScheduleDate(value: string): Date | null {
  const iso = parseLocalDateTime(value);
  return iso ? new Date(iso) : null;
}

/**
 * RF-20: tournament schedule fields only accept times on a 5-minute mark
 * (e.g. 09:00, 09:05, 09:10...). `DateTimeField` already snaps every
 * selection to the nearest multiple of 5, so this is a defensive check
 * reusing the raw `HH:MM` text (no timezone math involved).
 */
function hasFiveMinuteGranularity(value: string): boolean {
  const match = value.trim().match(/:(\d{2})$/);
  if (!match) return true;
  return Number(match[1]) % 5 === 0;
}

/** Rounds a date's minutes to the nearest multiple of 5 (e.g. 09:12 -> 09:10, 09:13 -> 09:15). */
export function snapToFiveMinutes(date: Date): Date {
  const snapped = new Date(date);
  snapped.setSeconds(0, 0);
  snapped.setMinutes(Math.round(snapped.getMinutes() / 5) * 5);
  return snapped;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

/**
 * Earliest instant the tournament itself (start/end) may be scheduled for:
 * the current moment plus 24 hours (RF-20). Registration opening/closing
 * follows its own, more permissive rules (see `validateTournamentForm`):
 * registration may open the same day, as long as it isn't in the past.
 */
export function minimumScheduleDateTime(): Date {
  return new Date(Date.now() + ONE_DAY_MS);
}

/**
 * Validates the general-info, game/location, dates and format/capacity
 * steps of the tournament form. Rules and requirements are free text and
 * visibility/scope/prizes always have a valid default, so they need no
 * dedicated checks here.
 *
 * When `allowedTimezones` is provided, the timezone must belong to that
 * list (RF-19: only the zones valid for the selected country).
 */
export function validateTournamentForm(
  values: TournamentFormValues,
  allowedTimezones?: string[],
): TournamentFormErrors {
  const errors: TournamentFormErrors = {};

  if (!values.name.trim()) {
    errors.name = 'Enter a tournament name.';
  }
  if (!values.gameId) {
    errors.gameId = 'Select a game.';
  }
  if (!values.countryId) {
    errors.countryId = 'Select a country.';
  }
  if (!values.timezone.trim()) {
    errors.timezone = allowedTimezones
      ? 'Select a timezone for the chosen country.'
      : 'Enter a timezone, e.g. UTC or America/Bogota.';
  } else if (allowedTimezones && !allowedTimezones.includes(values.timezone.trim())) {
    errors.timezone = 'The selected timezone is not valid for the chosen country.';
  }

  const minScheduleAt = minimumScheduleDateTime().toISOString();

  const startAt = parseLocalDateTime(values.startAt);
  if (!values.startAt.trim()) {
    errors.startAt = 'Select the start date and time.';
  } else if (!startAt) {
    errors.startAt = 'Select a valid date using the calendar and clock pickers.';
  } else if (!hasFiveMinuteGranularity(values.startAt)) {
    errors.startAt = 'Minutes must be a multiple of 5 (e.g. 09:00, 09:05, 09:10).';
  } else if (startAt < minScheduleAt) {
    errors.startAt = 'The tournament must start at least 24 hours from now.';
  }

  let endAt: string | null = null;
  if (values.endAt.trim()) {
    endAt = parseLocalDateTime(values.endAt);
    if (!endAt) {
      errors.endAt = 'Select a valid date using the calendar and clock pickers.';
    } else if (!hasFiveMinuteGranularity(values.endAt)) {
      errors.endAt = 'Minutes must be a multiple of 5 (e.g. 09:00, 09:05, 09:10).';
    } else if (endAt < minScheduleAt) {
      errors.endAt = 'The end date must be at least 24 hours from now.';
    } else if (startAt && new Date(endAt).getTime() - new Date(startAt).getTime() < ONE_DAY_MS) {
      errors.endAt = 'The tournament must last at least 1 day: the end date and time must be at least 24 hours after the start.';
    }
  }

  // Registration (unlike the tournament's own start/end) may open the same
  // day: it only needs to not be in the past, and registration must stay
  // open for at least 1 hour before it can close.
  const nowAt = new Date().toISOString();

  let opensAt: string | null = null;
  if (values.registrationOpensAt.trim()) {
    opensAt = parseLocalDateTime(values.registrationOpensAt);
    if (!opensAt) {
      errors.registrationOpensAt = 'Select a valid date using the calendar and clock pickers.';
    } else if (!hasFiveMinuteGranularity(values.registrationOpensAt)) {
      errors.registrationOpensAt = 'Minutes must be a multiple of 5 (e.g. 09:00, 09:05, 09:10).';
    } else if (opensAt < nowAt) {
      errors.registrationOpensAt = 'Registration cannot open at a time earlier than now.';
    }
  }

  if (values.registrationClosesAt.trim()) {
    const closesAt = parseLocalDateTime(values.registrationClosesAt);
    if (!closesAt) {
      errors.registrationClosesAt = 'Select a valid date using the calendar and clock pickers.';
    } else if (!hasFiveMinuteGranularity(values.registrationClosesAt)) {
      errors.registrationClosesAt = 'Minutes must be a multiple of 5 (e.g. 09:00, 09:05, 09:10).';
    } else if (closesAt < nowAt) {
      errors.registrationClosesAt = 'Registration cannot close at a time earlier than now.';
    } else if (opensAt && new Date(closesAt).getTime() - new Date(opensAt).getTime() < ONE_HOUR_MS) {
      errors.registrationClosesAt = 'Registration must stay open for at least 1 hour (close at least 1 hour after it opens).';
    } else if (startAt && new Date(startAt).getTime() - new Date(closesAt).getTime() < ONE_DAY_MS) {
      errors.registrationClosesAt = 'Registration must close at least 24 hours (1 day) before the tournament starts.';
    }
  }

  if (!values.format.trim()) {
    errors.format = 'Select a format.';
  }

  const capacity = Number(values.capacity);
  if (!values.capacity.trim() || !Number.isInteger(capacity) || capacity <= 0) {
    errors.capacity = 'Enter a whole number greater than 0.';
  }

  return errors;
}
