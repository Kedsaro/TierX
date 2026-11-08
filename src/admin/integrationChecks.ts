import type { SQLiteDatabase } from 'expo-sqlite';
import {
  auditRepository,
  countryRepository,
  gameRepository,
  notificationRepository,
  playerRepository,
  preferencesRepository,
  registrationRepository,
  reportRepository,
  settingsRepository,
  tournamentRepository,
  userRepository,
} from '../database/repositories';
import { notifyTournamentFollowers, notifyUser } from '../notifications/dispatch';
import { canManageTournament, isAdminRole } from '../tournaments/authorization';

/**
 * RF-15/RF-16/RF-17 (T-100 to T-105): exercises roles, permission gates,
 * the notification dispatch (including the opt-out preference), reports,
 * global parameters and the audit trail — all against the real database.
 */
export async function runAdminIntegrationChecks(db: SQLiteDatabase): Promise<void> {
  const games = await gameRepository.list(db);
  const countries = await countryRepository.list(db);
  if (games.length === 0 || countries.length === 0) {
    throw new Error('Baseline catalog is required for admin checks.');
  }

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const userIds: number[] = [];
  const playerIds: number[] = [];
  let tournamentId: number | null = null;
  let reportId: number | null = null;
  let gameId: number | null = null;
  const originalSetting = await settingsRepository.get(db, 'tournament_creation_enabled');

  async function makeUser(label: string, role: 'user' | 'organizer' | 'admin' = 'user'): Promise<{ userId: number; playerId: number }> {
    const userId = await userRepository.create(db, {
      username: `adm-check-${label}-${suffix}`,
      email: `adm-check-${label}-${suffix}@example.invalid`,
      password_hash: 'test-hash-only',
      terms_accepted: true,
      role,
    });
    userIds.push(userId);
    const playerId = await playerRepository.getOrCreateByUserId(db, userId, `Adm Check ${label} ${suffix}`)
      .then((player) => player.id);
    playerIds.push(playerId);
    return { userId, playerId };
  }

  try {
    const admin = await makeUser('admin', 'admin');
    const organizer = await makeUser('organizer');
    const participant = await makeUser('participant');

    // --- Roles (T-100) ---------------------------------------------------
    const createdUser = await userRepository.getById(db, participant.userId);
    if (createdUser?.role !== 'user') throw new Error('A new account did not get the default "user" role.');
    await userRepository.updateRole(db, participant.userId, 'organizer');
    const promoted = await userRepository.getById(db, participant.userId);
    if (promoted?.role !== 'organizer') throw new Error('Updating a user role did not persist.');
    if (!isAdminRole('admin') || isAdminRole('organizer') || isAdminRole('user')) {
      throw new Error('isAdminRole misclassifies roles.');
    }

    // --- Permissions allowed/denied (T-101) ------------------------------
    tournamentId = await tournamentRepository.create(db, {
      name: `Admin Check Cup ${suffix}`,
      game_id: games[0].id,
      country_id: countries[0].id,
      organizer_id: organizer.userId,
      timezone: 'UTC',
      start_at: '2031-03-01T12:00:00.000Z',
      format: 'single_elimination',
      capacity: 4,
      status: 'published',
    });
    const tournament = await tournamentRepository.getById(db, tournamentId);
    if (!tournament) throw new Error('The admin-check tournament was not persisted.');
    if (!canManageTournament(tournament, organizer.userId, 'organizer')) {
      throw new Error('The organizer was denied management of their own tournament.');
    }
    if (canManageTournament(tournament, participant.userId, 'user')) {
      throw new Error('A regular user was incorrectly allowed to manage someone else\'s tournament.');
    }
    if (!canManageTournament(tournament, admin.userId, 'admin')) {
      throw new Error('An administrator was denied the global management override.');
    }

    // --- Notifications (T-102) -------------------------------------------
    await registrationRepository.register(db, tournamentId, participant.playerId);
    await notifyUser(db, organizer.userId, 'registration', 'New registration', `Player registered.`);
    const organizerNotifications = await notificationRepository.listForUser(db, organizer.userId);
    if (!organizerNotifications.some((item) => item.type === 'registration' && item.title === 'New registration')) {
      throw new Error('The organizer was not notified about a new registration.');
    }

    const unreadBefore = await notificationRepository.unreadCount(db, organizer.userId);
    if (unreadBefore < 1) throw new Error('Unread notification count did not increment.');
    await notificationRepository.markAllRead(db, organizer.userId);
    if ((await notificationRepository.unreadCount(db, organizer.userId)) !== 0) {
      throw new Error('Marking all notifications as read did not clear the unread count.');
    }

    // Opt-out honored: participant disables notifications and must not receive rows.
    await preferencesRepository.update(db, participant.userId, { notifications_enabled: false });
    await notifyTournamentFollowers(db, tournament, 'tournament_update', 'Tournament updated', 'Status changed.', admin.userId);
    const participantNotifications = await notificationRepository.listForUser(db, participant.userId);
    if (participantNotifications.length > 0) {
      throw new Error('A user with notifications disabled still received a notification.');
    }
    await preferencesRepository.update(db, participant.userId, { notifications_enabled: true });

    // --- Reports (T-103) --------------------------------------------------
    reportId = await reportRepository.create(db, {
      reporter_id: participant.userId,
      tournament_id: tournamentId,
      reason: 'Admin check report',
    });
    const openReports = await reportRepository.list(db, 'open');
    if (!openReports.some((report) => report.id === reportId && report.reporter_username.startsWith('adm-check'))) {
      throw new Error('A filed report did not appear in the open queue.');
    }
    await reportRepository.updateStatus(db, reportId, 'resolved');
    const remaining = await reportRepository.list(db, 'open');
    if (remaining.some((report) => report.id === reportId)) {
      throw new Error('A resolved report still shows as open.');
    }

    // --- Global parameters (T-103) ----------------------------------------
    await settingsRepository.set(db, 'tournament_creation_enabled', 'false');
    if (await settingsRepository.isEnabled(db, 'tournament_creation_enabled')) {
      throw new Error('Disabling tournament creation did not persist.');
    }
    await settingsRepository.set(db, 'tournament_creation_enabled', 'true');
    if (!(await settingsRepository.isEnabled(db, 'tournament_creation_enabled'))) {
      throw new Error('Re-enabling tournament creation did not persist.');
    }

    // Game catalog activation/deactivation.
    gameId = await gameRepository.create(db, `Adm Check Game ${suffix}`, 'Check');
    await gameRepository.setActive(db, gameId, false);
    const activeGames = await gameRepository.list(db);
    if (activeGames.some((game) => game.id === gameId)) {
      throw new Error('A deactivated game still appears in the active catalog.');
    }
    await gameRepository.setActive(db, gameId, true);

    // --- Audit trail (T-104, T-105) ----------------------------------------
    await auditRepository.log(db, {
      actor_user_id: admin.userId,
      action: 'resolve_report',
      entity_type: 'report',
      entity_id: reportId,
      details: 'Audit check entry',
    });
    const reportAudit = await auditRepository.listForEntity(db, 'report', reportId);
    if (!reportAudit.some((entry) => entry.action === 'resolve_report' && entry.actor_user_id === admin.userId)) {
      throw new Error('The administrative action was not recorded in the audit log.');
    }
    const globalAudit = await auditRepository.list(db);
    if (!globalAudit.some((entry) => entry.action === 'resolve_report' && entry.actor_username?.startsWith('adm-check'))) {
      throw new Error('The audit log listing does not include the actor username.');
    }
  } finally {
    if (originalSetting !== null) await settingsRepository.set(db, 'tournament_creation_enabled', originalSetting);
    if (tournamentId !== null) await tournamentRepository.delete(db, tournamentId);
    if (reportId !== null) await db.runAsync('DELETE FROM reports WHERE id = ?', reportId);
    if (gameId !== null) await gameRepository.delete(db, gameId);
    for (const playerId of playerIds) await playerRepository.delete(db, playerId);
    for (const userId of userIds) await userRepository.delete(db, userId);
    await db.runAsync("DELETE FROM notifications WHERE title IN ('New registration', 'Tournament updated', 'Your role changed')");
    await db.runAsync("DELETE FROM audit_logs WHERE details = 'Audit check entry'");
  }
}
