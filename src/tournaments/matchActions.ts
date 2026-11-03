import type { MatchStatus } from '../types/match';

export type MatchAction = 'start' | 'dispute' | 'resolveDispute' | 'recordResult' | 'cancel';

/**
 * RF-12: which organizer actions are available for a match given its
 * current status. A result can only ever be published once (`scheduled` or
 * `ongoing` -> `completed`); a dispute must be resolved (back to `ongoing`)
 * before a result can be recorded, so rankings are never double-counted by
 * publishing the same match twice.
 */
const allowedMatchActions: Record<MatchStatus, MatchAction[]> = {
  scheduled: ['start', 'dispute', 'recordResult', 'cancel'],
  ongoing: ['dispute', 'recordResult', 'cancel'],
  disputed: ['resolveDispute', 'cancel'],
  completed: [],
  cancelled: [],
};

export function availableMatchActions(status: MatchStatus): MatchAction[] {
  return allowedMatchActions[status];
}
