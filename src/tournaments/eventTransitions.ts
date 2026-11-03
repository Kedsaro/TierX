import type { TournamentEventStatus } from '../types/event';

/**
 * RF-11/RF-12: status transitions an organizer may trigger for an event
 * from its "Manage" panel (mirrors `authorization.ts`'s tournament
 * transitions, scoped to the simpler event lifecycle).
 */
export const nextEventStatuses: Record<TournamentEventStatus, TournamentEventStatus[]> = {
  upcoming: ['active', 'cancelled'],
  active: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
