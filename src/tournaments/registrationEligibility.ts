import type { Tournament } from '../types/tournament';

export interface RegistrationEligibility {
  canRegister: boolean;
  /** Human-readable reason shown to the user when `canRegister` is false. */
  reason?: string;
}

/**
 * RF-10: decides whether a player may submit a *new* registration request
 * for this tournament right now. Checks (in order) account-level
 * restrictions, the tournament's publication status, the registration
 * window and remaining capacity.
 *
 * Does not consider whether the player already has an active registration
 * (pending/registered/waitlisted) — callers should check that separately
 * and offer "cancel" instead of calling this.
 */
export function evaluateRegistrationEligibility(
  tournament: Pick<
    Tournament,
    'status' | 'registration_opens_at' | 'registration_closes_at' | 'start_at' | 'organizer_id' | 'capacity'
  >,
  participantCount: number,
  viewerUserId: number | undefined,
): RegistrationEligibility {
  if (viewerUserId === undefined) {
    return { canRegister: false, reason: 'Sign in to register for this tournament.' };
  }
  if (tournament.organizer_id === viewerUserId) {
    return { canRegister: false, reason: 'You organize this tournament, so you cannot register as a participant.' };
  }
  if (tournament.status !== 'published') {
    return { canRegister: false, reason: 'This tournament is not currently open for registration.' };
  }

  const now = new Date().toISOString();
  if (tournament.registration_opens_at && now < tournament.registration_opens_at) {
    return { canRegister: false, reason: 'Registration has not opened yet.' };
  }
  // With no explicit closing date, registration stays open until the
  // tournament itself starts.
  const registrationClosesAt = tournament.registration_closes_at ?? tournament.start_at;
  if (now > registrationClosesAt) {
    return { canRegister: false, reason: 'The registration period for this tournament has closed.' };
  }

  if (participantCount >= tournament.capacity) {
    return { canRegister: false, reason: 'This tournament has reached its capacity.' };
  }

  return { canRegister: true };
}
