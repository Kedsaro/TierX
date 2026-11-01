import type { Tournament, TournamentStatus } from '../types/tournament';

/** Only the organizer who created a tournament may edit or manage it. */
export function canManageTournament(tournament: Pick<Tournament, 'organizer_id'>, userId: number | undefined): boolean {
  return userId !== undefined && tournament.organizer_id === userId;
}

export type TournamentAction = 'edit' | 'publish' | 'unpublish' | 'cancel' | 'close';

/** Status transitions allowed from the organizer's management actions. */
const allowedTransitions: Record<TournamentAction, { from: TournamentStatus[]; to: TournamentStatus } | null> = {
  edit: null,
  publish: { from: ['draft'], to: 'published' },
  unpublish: { from: ['published'], to: 'draft' },
  cancel: { from: ['draft', 'published', 'ongoing'], to: 'cancelled' },
  close: { from: ['published', 'ongoing'], to: 'completed' },
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
