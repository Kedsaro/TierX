import type { SQLiteDatabase } from 'expo-sqlite';
import {
  notificationRepository,
  playerRepository,
  preferencesRepository,
  registrationRepository,
} from '../database/repositories';
import type { MatchDetails } from '../types/match';
import type { Tournament } from '../types/tournament';

export type NotificationType =
  | 'registration'
  | 'schedule'
  | 'match_started'
  | 'result'
  | 'tournament_update'
  | 'removal'
  | 'admin';

/**
 * RF-15: writes an in-app notification for one user, honoring their
 * `notifications_enabled` preference — users who opted out simply get no row.
 */
export async function notifyUser(
  db: SQLiteDatabase,
  userId: number,
  type: NotificationType,
  title: string,
  message: string,
): Promise<void> {
  const preferences = await preferencesRepository.getForUser(db, userId);
  if (preferences.notifications_enabled !== 1) return;
  await notificationRepository.create(db, { user_id: userId, type, title, message });
}

/** Notifies every user actively following a tournament (registered players) plus its organizer. */
export async function notifyTournamentFollowers(
  db: SQLiteDatabase,
  tournament: Pick<Tournament, 'id' | 'name' | 'organizer_id'>,
  type: NotificationType,
  title: string,
  message: string,
  excludeUserId?: number,
): Promise<void> {
  const followers = await registrationRepository.listFollowerUserIds(db, tournament.id);
  const recipients = new Set<number>([tournament.organizer_id, ...followers.map((row) => row.user_id)]);
  if (excludeUserId !== undefined) recipients.delete(excludeUserId);

  for (const userId of recipients) {
    await notifyUser(db, userId, type, title, message);
  }
}

/** Notifies a match's two participants (via their linked user accounts). */
export async function notifyMatchPlayers(
  db: SQLiteDatabase,
  match: Pick<MatchDetails, 'player_one_id' | 'player_two_id'>,
  type: NotificationType,
  title: string,
  message: string,
): Promise<void> {
  for (const playerId of [match.player_one_id, match.player_two_id]) {
    if (playerId === null) continue;
    const player = await playerRepository.getById(db, playerId);
    if (player?.user_id != null) await notifyUser(db, player.user_id, type, title, message);
  }
}
