import type { Tournament, TournamentStatus } from '../types/tournament';
import type { UserRole } from '../types/user';

/** RF-16: administrators can manage every tournament; organizers only their own. */
export function isAdminRole(role: UserRole | undefined): boolean {
  return role === 'admin';
}

/** Only the organizer who created a tournament — or an admin — may edit or manage it. */
export function canManageTournament(
  tournament: Pick<Tournament, 'organizer_id'>,
  userId: number | undefined,
  role?: UserRole,
): boolean {
  if (isAdminRole(role)) return true;
  return userId !== undefined && tournament.organizer_id === userId;
}

export type TournamentAction = 'edit' | 'publish' | 'unpublish' | 'cancel' | 'close' | 'start';

/** Status transitions allowed from the organizer's management actions. */
const allowedTransitions: Record<TournamentAction, { from: TournamentStatus[]; to: TournamentStatus } | null> = {
  edit: null,
  publish: { from: ['draft'], to: 'published' },
  unpublish: { from: ['published'], to: 'draft' },
  cancel: { from: ['draft', 'published', 'ongoing'], to: 'cancelled' },
  close: { from: ['published', 'ongoing'], to: 'completed' },
  // "Start" lets the organizer flip a published tournament to ongoing ahead of
  // its scheduled start_at — the end date stays untouched either way.
  start: { from: ['published'], to: 'ongoing' },
};

export function availableActions(status: TournamentStatus): TournamentAction[] {
  return (Object.keys(allowedTransitions) as TournamentAction[]).filter((action) => {
    const transition = allowedTransitions[action];
    return action === 'edit' ? status !== 'cancelled' && status !== 'completed' : transition!.from.includes(status);
  });
}

export function nextStatusFor(action: TournamentAction): TournamentStatus | null {
  return allowedTransitions[action]?.to ?? null;
}
