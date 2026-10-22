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
    timezone: 'UTC',
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

/**
 * Validates the general-info, game/location, dates and format/capacity
 * steps of the tournament form. Rules and requirements are free text and
 * visibility/scope/prizes always have a valid default, so they need no
 * dedicated checks here.
 */
export function validateTournamentForm(values: TournamentFormValues): TournamentFormErrors {
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
    errors.timezone = 'Enter a timezone, e.g. UTC or America/Bogota.';
  }

  const startAt = parseLocalDateTime(values.startAt);
  if (!values.startAt.trim()) {
    errors.startAt = 'Enter the start date and time.';
  } else if (!startAt) {
    errors.startAt = 'Enter a valid date, e.g. 2026-01-01 18:00.';
  }

  let endAt: string | null = null;
  if (values.endAt.trim()) {
    endAt = parseLocalDateTime(values.endAt);
    if (!endAt) {
      errors.endAt = 'Enter a valid date, e.g. 2026-01-02 18:00.';
    } else if (startAt && endAt < startAt) {
      errors.endAt = 'End date must be on or after the start date.';
    }
  }

  let opensAt: string | null = null;
  if (values.registrationOpensAt.trim()) {
    opensAt = parseLocalDateTime(values.registrationOpensAt);
    if (!opensAt) {
      errors.registrationOpensAt = 'Enter a valid date, e.g. 2025-12-20 09:00.';
    }
  }

  if (values.registrationClosesAt.trim()) {
    const closesAt = parseLocalDateTime(values.registrationClosesAt);
    if (!closesAt) {
      errors.registrationClosesAt = 'Enter a valid date, e.g. 2025-12-31 23:59.';
    } else if (opensAt && closesAt < opensAt) {
      errors.registrationClosesAt = 'Registration must close on or after it opens.';
    } else if (startAt && closesAt > startAt) {
      errors.registrationClosesAt = 'Registration must close before the tournament starts.';
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
