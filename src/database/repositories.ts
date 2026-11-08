import type { SQLiteDatabase } from 'expo-sqlite';
import type { Country, Game } from '../types/catalog';
import type { CreateEventInput, EventSummary, TournamentEvent, TournamentEventStatus } from '../types/event';
import type { CreateMatchInput, CreateStageInput, Match, MatchDetails, MatchStatus, Stage } from '../types/match';
import type { CreatePlayerInput, Player, Ranking, RankingWithPlayer, UpdatePlayerInput } from '../types/player';
import type { MatchHistoryItem, PlayerRankSummary, ProfileStats, UserPreferences } from '../types/profile';
import type { AppNotification, AppSetting, AuditLogEntry, AuditLogSummary, ReportStatus, ReportSummary } from '../types/admin';
import { ACTIVE_REGISTRATION_STATUSES } from '../types/registration';
import type { Registration, RegistrationStatus } from '../types/registration';
import type {
  CreateTournamentInput,
  Tournament,
  TournamentDetails,
  TournamentFilters,
  TournamentSummary,
} from '../types/tournament';
import type { CreateUserInput, User } from '../types/user';
import { computeEloUpdate } from '../tournaments/rating';

export const userRepository = {
  create(db: SQLiteDatabase, input: CreateUserInput): Promise<number> {
    return db.runAsync(
      'INSERT INTO users (username, email, password_hash, role, terms_accepted_at) VALUES (?, ?, ?, ?, ?)',
      input.username.trim(),
      input.email.trim().toLowerCase(),
      input.password_hash,
      input.role ?? 'user',
      input.terms_accepted ? new Date().toISOString() : null,
    ).then((result) => result.lastInsertRowId);
  },

  getById(db: SQLiteDatabase, id: number): Promise<User | null> {
    return db.getFirstAsync<User>('SELECT * FROM users WHERE id = ?', id);
  },

  getByLogin(db: SQLiteDatabase, login: string): Promise<User | null> {
    return db.getFirstAsync<User>(
      'SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE',
      login.trim(),
      login.trim(),
    );
  },

  list(db: SQLiteDatabase): Promise<User[]> {
    return db.getAllAsync<User>('SELECT * FROM users ORDER BY created_at DESC, id DESC');
  },

  listByRole(db: SQLiteDatabase, role: User['role']): Promise<User[]> {
    return db.getAllAsync<User>('SELECT * FROM users WHERE role = ? ORDER BY username COLLATE NOCASE', role);
  },

  async updateProfile(
    db: SQLiteDatabase,
    id: number,
    changes: { username: string; email: string },
  ): Promise<void> {
    await db.runAsync(
      'UPDATE users SET username = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      changes.username.trim(),
      changes.email.trim().toLowerCase(),
      id,
    );
  },

  async updateRole(db: SQLiteDatabase, id: number, role: User['role']): Promise<void> {
    await db.runAsync(
      'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      role,
      id,
    );
  },

  async setVerified(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync(
      'UPDATE users SET is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      id,
    );
  },

  async updatePasswordHash(db: SQLiteDatabase, id: number, passwordHash: string): Promise<void> {
    await db.runAsync(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      passwordHash,
      id,
    );
  },

  async delete(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM users WHERE id = ?', id);
  },
};

export const gameRepository = {
  create(db: SQLiteDatabase, name: string, category?: string | null): Promise<number> {
    return db.runAsync('INSERT INTO games (name, category) VALUES (?, ?)', name.trim(), category ?? null)
      .then((result) => result.lastInsertRowId);
  },

  list(db: SQLiteDatabase): Promise<Game[]> {
    return db.getAllAsync<Game>('SELECT * FROM games WHERE is_active = 1 ORDER BY name COLLATE NOCASE');
  },

  /** Includes inactive games — for the admin catalog view. */
  listAll(db: SQLiteDatabase): Promise<Game[]> {
    return db.getAllAsync<Game>('SELECT * FROM games ORDER BY name COLLATE NOCASE');
  },

  async setActive(db: SQLiteDatabase, id: number, isActive: boolean): Promise<void> {
    await db.runAsync('UPDATE games SET is_active = ? WHERE id = ?', isActive ? 1 : 0, id);
  },

  async delete(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM games WHERE id = ?', id);
  },
};

export const countryRepository = {
  create(db: SQLiteDatabase, input: Pick<Country, 'name' | 'code'> & { region?: string | null }): Promise<number> {
    return db.runAsync(
      'INSERT INTO countries (name, code, region) VALUES (?, ?, ?)',
      input.name.trim(),
      input.code.trim().toUpperCase(),
      input.region ?? null,
    ).then((result) => result.lastInsertRowId);
  },

  list(db: SQLiteDatabase): Promise<Country[]> {
    return db.getAllAsync<Country>('SELECT * FROM countries ORDER BY name COLLATE NOCASE');
  },

  async delete(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM countries WHERE id = ?', id);
  },
};

export const playerRepository = {
  create(db: SQLiteDatabase, input: CreatePlayerInput): Promise<number> {
    return db.runAsync(
      'INSERT INTO players (display_name, user_id, avatar_uri, bio, country_id, favorite_game_id) VALUES (?, ?, ?, ?, ?, ?)',
      input.display_name.trim(),
      input.user_id ?? null,
      input.avatar_uri ?? null,
      input.bio ?? null,
      input.country_id ?? null,
      input.favorite_game_id ?? null,
    ).then((result) => result.lastInsertRowId);
  },

  getById(db: SQLiteDatabase, id: number): Promise<Player | null> {
    return db.getFirstAsync<Player>('SELECT * FROM players WHERE id = ?', id);
  },

  getByUserId(db: SQLiteDatabase, userId: number): Promise<Player | null> {
    return db.getFirstAsync<Player>('SELECT * FROM players WHERE user_id = ?', userId);
  },

  /**
   * Returns the player profile linked to a user account, creating a minimal
   * one on first use. Player-scoped features (rankings, registrations,
   * followed tournaments) rely on this row existing.
   */
  async getOrCreateByUserId(db: SQLiteDatabase, userId: number, displayName: string): Promise<Player> {
    const existing = await playerRepository.getByUserId(db, userId);
    if (existing) return existing;

    const id = await playerRepository.create(db, { display_name: displayName, user_id: userId });
    const created = await playerRepository.getById(db, id);
    if (!created) throw new Error('Failed to create player profile.');
    return created;
  },

  list(db: SQLiteDatabase): Promise<Player[]> {
    return db.getAllAsync<Player>('SELECT * FROM players ORDER BY display_name COLLATE NOCASE');
  },

  /** Applies the editable player-profile fields (RF-14); only the provided keys change. */
  async update(db: SQLiteDatabase, id: number, changes: UpdatePlayerInput): Promise<void> {
    const assignments: string[] = [];
    const values: (string | number | null)[] = [];

    if (changes.display_name !== undefined) {
      assignments.push('display_name = ?');
      values.push(changes.display_name.trim());
    }
    if (changes.avatar_uri !== undefined) {
      assignments.push('avatar_uri = ?');
      values.push(changes.avatar_uri?.trim() || null);
    }
    if (changes.bio !== undefined) {
      assignments.push('bio = ?');
      values.push(changes.bio?.trim() || null);
    }
    if (changes.country_id !== undefined) {
      assignments.push('country_id = ?');
      values.push(changes.country_id);
    }
    if (changes.favorite_game_id !== undefined) {
      assignments.push('favorite_game_id = ?');
      values.push(changes.favorite_game_id);
    }
    if (assignments.length === 0) return;

    values.push(id);
    await db.runAsync(
      `UPDATE players SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values,
    );
  },

  async delete(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM players WHERE id = ?', id);
  },
};

/** Per-user privacy and notification preferences (RF-14). */
export const preferencesRepository = {
  /** Returns the user's preferences, lazily creating the default row on first access. */
  async getForUser(db: SQLiteDatabase, userId: number): Promise<UserPreferences> {
    await db.runAsync('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)', userId);
    const row = await db.getFirstAsync<UserPreferences>(
      'SELECT * FROM user_preferences WHERE user_id = ?',
      userId,
    );
    if (!row) throw new Error('Failed to resolve user preferences.');
    return row;
  },

  async update(
    db: SQLiteDatabase,
    userId: number,
    changes: { privacy?: UserPreferences['privacy']; notifications_enabled?: boolean },
  ): Promise<void> {
    await preferencesRepository.getForUser(db, userId);
    const assignments: string[] = [];
    const values: (string | number)[] = [];

    if (changes.privacy !== undefined) {
      assignments.push('privacy = ?');
      values.push(changes.privacy);
    }
    if (changes.notifications_enabled !== undefined) {
      assignments.push('notifications_enabled = ?');
      values.push(changes.notifications_enabled ? 1 : 0);
    }
    if (assignments.length === 0) return;

    values.push(userId);
    await db.runAsync(
      `UPDATE user_preferences SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      values,
    );
  },
};

/** Read-model queries that feed the Profile tab (RF-13). */
export const profileRepository = {
  /** Counters for the profile header: tournaments organized, active registrations and the ranking record. */
  async getStats(db: SQLiteDatabase, userId: number, playerId: number): Promise<ProfileStats> {
    const organized = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM tournaments WHERE organizer_id = ?',
      userId,
    );
    const participating = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM registrations r
       JOIN tournaments t ON t.id = r.tournament_id
       WHERE r.player_id = ? AND r.status IN ('pending', 'registered', 'waitlisted')
         AND t.status = 'ongoing'`,
      playerId,
    );
    const record = await db.getFirstAsync<{ wins: number | null; losses: number | null }>(
      'SELECT SUM(wins) AS wins, SUM(losses) AS losses FROM rankings WHERE player_id = ?',
      playerId,
    );

    return {
      organized: organized?.count ?? 0,
      participating: participating?.count ?? 0,
      wins: record?.wins ?? 0,
      losses: record?.losses ?? 0,
    };
  },

  /** The player's position in a game's local leaderboard (RF-14: "ranking local"). */
  async getRankForGame(db: SQLiteDatabase, playerId: number, gameId: number): Promise<PlayerRankSummary | null> {
    const row = await db.getFirstAsync<PlayerRankSummary>(
      `SELECT r.rating, r.wins, r.losses,
        (SELECT COUNT(*) FROM rankings r2
          WHERE r2.game_id = r.game_id
            AND (r2.rating > r.rating OR (r2.rating = r.rating AND r2.wins > r.wins))) + 1 AS position,
        (SELECT COUNT(*) FROM rankings r3 WHERE r3.game_id = r.game_id) AS total
       FROM rankings r
       WHERE r.player_id = ? AND r.game_id = ?`,
      playerId,
      gameId,
    );
    return row ?? null;
  },

  /** Completed matches the player took part in, newest first (profile history, RF-13). */
  listMatchHistory(db: SQLiteDatabase, playerId: number, limit = 20): Promise<MatchHistoryItem[]> {
    return db.getAllAsync<MatchHistoryItem>(
      `SELECT m.*,
        p1.display_name AS player_one_name,
        p2.display_name AS player_two_name,
        pw.display_name AS winner_name,
        pr.display_name AS referee_name,
        t.id AS tournament_id,
        t.name AS tournament_name,
        g.name AS game_name,
        mpo.eliminated AS own_eliminated
       FROM matches m
       JOIN stages s ON s.id = m.stage_id
       JOIN tournaments t ON t.id = s.tournament_id
       JOIN games g ON g.id = t.game_id
       LEFT JOIN players p1 ON p1.id = m.player_one_id
       LEFT JOIN players p2 ON p2.id = m.player_two_id
       LEFT JOIN players pw ON pw.id = m.winner_id
       LEFT JOIN players pr ON pr.id = m.referee_id
       LEFT JOIN match_participants mpo ON mpo.match_id = m.id AND mpo.player_id = ?
       WHERE (m.player_one_id = ? OR m.player_two_id = ?
            OR EXISTS (SELECT 1 FROM match_participants mp WHERE mp.match_id = m.id AND mp.player_id = ?))
         AND m.status = 'completed'
       ORDER BY m.id DESC
       LIMIT ?`,
      playerId,
      playerId,
      playerId,
      playerId,
      limit,
    );
  },
};

export const tournamentRepository = {
  create(db: SQLiteDatabase, input: CreateTournamentInput): Promise<number> {
    return db.runAsync(
      `INSERT INTO tournaments (
        name, description, image_uri, game_id, country_id, organizer_id, timezone,
        start_at, end_at, registration_opens_at, registration_closes_at, visibility,
        access_code, city, scope, format, capacity, rules, requirements, prizes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.name.trim(),
      input.description ?? null,
      input.image_uri ?? null,
      input.game_id,
      input.country_id,
      input.organizer_id,
      input.timezone.trim(),
      input.start_at,
      input.end_at ?? null,
      input.registration_opens_at ?? null,
      input.registration_closes_at ?? null,
      input.visibility ?? 'public',
      input.access_code ?? null,
      input.city ?? null,
      input.scope ?? 'national',
      input.format.trim(),
      input.capacity,
      input.rules ?? null,
      input.requirements ?? null,
      input.prizes ?? null,
      input.status ?? 'draft',
    ).then((result) => result.lastInsertRowId);
  },

  getById(db: SQLiteDatabase, id: number): Promise<Tournament | null> {
    return db.getFirstAsync<Tournament>('SELECT * FROM tournaments WHERE id = ?', id);
  },

  list(db: SQLiteDatabase, filters: TournamentFilters = {}): Promise<TournamentSummary[]> {
    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (filters.search) {
      conditions.push(`(
        t.name LIKE ? COLLATE NOCASE OR t.description LIKE ? COLLATE NOCASE
        OR g.name LIKE ? COLLATE NOCASE OR u.username LIKE ? COLLATE NOCASE
      )`);
      const query = `%${filters.search.trim()}%`;
      values.push(query, query, query, query);
    }
    if (filters.gameId !== undefined) {
      conditions.push('t.game_id = ?');
      values.push(filters.gameId);
    }
    if (filters.countryId !== undefined) {
      conditions.push('t.country_id = ?');
      values.push(filters.countryId);
    }
    if (filters.organizerId !== undefined) {
      conditions.push('t.organizer_id = ?');
      values.push(filters.organizerId);
    }
    if (filters.status) {
      conditions.push('t.status = ?');
      values.push(filters.status);
    }
    if (filters.excludeDraft) {
      conditions.push("t.status != 'draft'");
    }
    if (filters.registrationOpen) {
      const now = new Date().toISOString();
      conditions.push("t.status = 'published'");
      conditions.push('(t.registration_opens_at IS NULL OR t.registration_opens_at <= ?)');
      values.push(now);
      conditions.push('COALESCE(t.registration_closes_at, t.start_at) >= ?');
      values.push(now);
      conditions.push(`(
        SELECT COUNT(*) FROM registrations r
        WHERE r.tournament_id = t.id AND r.status IN ('pending', 'registered', 'waitlisted')
      ) < t.capacity`);
    }
    if (filters.visibility) {
      conditions.push('t.visibility = ?');
      values.push(filters.visibility);
    }
    if (filters.scope) {
      conditions.push('t.scope = ?');
      values.push(filters.scope);
    }
    if (filters.startsAfter) {
      conditions.push('t.start_at >= ?');
      values.push(filters.startsAfter);
    }
    if (filters.startsBefore) {
      conditions.push('t.start_at <= ?');
      values.push(filters.startsBefore);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit ? 'LIMIT ?' : '';
    if (filters.limit) values.push(filters.limit);
    return db.getAllAsync<TournamentSummary>(
      `SELECT t.*, g.name AS game_name, c.name AS country_name, u.username AS organizer_username
       FROM tournaments t
       JOIN games g ON g.id = t.game_id
       JOIN countries c ON c.id = t.country_id
       JOIN users u ON u.id = t.organizer_id
       ${where}
       ORDER BY t.start_at ASC, t.id DESC
       ${limit}`,
      values,
    );
  },

  /** Tournaments the given player is currently registered for ("Following"). */
  listFollowed(db: SQLiteDatabase, playerId: number, filters: TournamentFilters = {}): Promise<TournamentSummary[]> {
    const conditions: string[] = ['r.player_id = ?', "r.status IN ('pending', 'registered', 'waitlisted')"];
    const values: (string | number)[] = [playerId];

    if (filters.search) {
      conditions.push(`(
        t.name LIKE ? COLLATE NOCASE OR t.description LIKE ? COLLATE NOCASE
        OR g.name LIKE ? COLLATE NOCASE OR u.username LIKE ? COLLATE NOCASE
      )`);
      const query = `%${filters.search.trim()}%`;
      values.push(query, query, query, query);
    }
    if (filters.status) {
      conditions.push('t.status = ?');
      values.push(filters.status);
    }
    if (filters.scope) {
      conditions.push('t.scope = ?');
      values.push(filters.scope);
    }
    if (filters.startsAfter) {
      conditions.push('t.start_at >= ?');
      values.push(filters.startsAfter);
    }
    if (filters.startsBefore) {
      conditions.push('t.start_at <= ?');
      values.push(filters.startsBefore);
    }

    const limit = filters.limit ? 'LIMIT ?' : '';
    if (filters.limit) values.push(filters.limit);
    return db.getAllAsync<TournamentSummary>(
      `SELECT t.*, g.name AS game_name, c.name AS country_name, u.username AS organizer_username
       FROM tournaments t
       JOIN registrations r ON r.tournament_id = t.id
       JOIN games g ON g.id = t.game_id
       JOIN countries c ON c.id = t.country_id
       JOIN users u ON u.id = t.organizer_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.start_at ASC, t.id DESC
       ${limit}`,
      values,
    );
  },

  /** Tournament row enriched with catalog names and the live participant count. */
  getDetails(db: SQLiteDatabase, id: number): Promise<TournamentDetails | null> {
    return db.getFirstAsync<TournamentDetails>(
      `SELECT t.*, g.name AS game_name, c.name AS country_name, u.username AS organizer_username,
        (SELECT COUNT(*) FROM registrations r
          WHERE r.tournament_id = t.id AND r.status IN ('pending', 'registered', 'waitlisted')) AS participant_count
       FROM tournaments t
       JOIN games g ON g.id = t.game_id
       JOIN countries c ON c.id = t.country_id
       JOIN users u ON u.id = t.organizer_id
       WHERE t.id = ?`,
      id,
    );
  },

  async update(db: SQLiteDatabase, id: number, input: CreateTournamentInput): Promise<void> {
    await db.runAsync(
      `UPDATE tournaments SET
        name = ?, description = ?, image_uri = ?, game_id = ?, country_id = ?, organizer_id = ?,
        timezone = ?, start_at = ?, end_at = ?, registration_opens_at = ?, registration_closes_at = ?,
        visibility = ?, access_code = ?, city = ?, scope = ?, format = ?, capacity = ?, rules = ?, requirements = ?, prizes = ?,
        status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      input.name.trim(), input.description ?? null, input.image_uri ?? null, input.game_id,
      input.country_id, input.organizer_id, input.timezone.trim(), input.start_at, input.end_at ?? null,
      input.registration_opens_at ?? null, input.registration_closes_at ?? null,
      input.visibility ?? 'public', input.access_code ?? null, input.city ?? null, input.scope ?? 'national', input.format.trim(), input.capacity,
      input.rules ?? null, input.requirements ?? null, input.prizes ?? null, input.status ?? 'draft', id,
    );
  },

  /** Applies a status transition only (publish, unpublish, cancel, close). */
  async updateStatus(db: SQLiteDatabase, id: number, status: Tournament['status']): Promise<void> {
    await db.runAsync(
      'UPDATE tournaments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      status,
      id,
    );
  },

  async delete(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM tournaments WHERE id = ?', id);
  },
};

export const rankingRepository = {
  listByGame(db: SQLiteDatabase, gameId: number): Promise<RankingWithPlayer[]> {
    return db.getAllAsync<RankingWithPlayer>(
      `SELECT r.*, p.display_name
       FROM rankings r JOIN players p ON p.id = r.player_id
       WHERE r.game_id = ?
       ORDER BY r.rating DESC, r.wins DESC, p.display_name COLLATE NOCASE`,
      gameId,
    );
  },

  async upsert(db: SQLiteDatabase, playerId: number, gameId: number, rating: number): Promise<void> {
    await db.runAsync(
      `INSERT INTO rankings (player_id, game_id, rating) VALUES (?, ?, ?)
       ON CONFLICT(player_id, game_id) DO UPDATE SET rating = excluded.rating, updated_at = CURRENT_TIMESTAMP`,
      playerId,
      gameId,
      rating,
    );
  },

  /**
   * RF-12: applies a published match result to both players' rankings for
   * that game (creating a 1000-rating row on first appearance), updating
   * rating via Elo and incrementing wins/losses.
   */
  async recordMatchOutcome(db: SQLiteDatabase, gameId: number, winnerPlayerId: number, loserPlayerId: number): Promise<void> {
    await db.runAsync(
      'INSERT OR IGNORE INTO rankings (player_id, game_id) VALUES (?, ?), (?, ?)',
      winnerPlayerId,
      gameId,
      loserPlayerId,
      gameId,
    );
    const winnerRanking = await db.getFirstAsync<Ranking>(
      'SELECT * FROM rankings WHERE player_id = ? AND game_id = ?',
      winnerPlayerId,
      gameId,
    );
    const loserRanking = await db.getFirstAsync<Ranking>(
      'SELECT * FROM rankings WHERE player_id = ? AND game_id = ?',
      loserPlayerId,
      gameId,
    );
    if (!winnerRanking || !loserRanking) throw new Error('Could not resolve rankings for this match.');

    const { winnerRating, loserRating } = computeEloUpdate(winnerRanking.rating, loserRanking.rating);

    await db.runAsync(
      'UPDATE rankings SET rating = ?, wins = wins + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      winnerRating,
      winnerRanking.id,
    );
    await db.runAsync(
      'UPDATE rankings SET rating = ?, losses = losses + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      loserRating,
      loserRanking.id,
    );
  },

  /** +1 win — only awarded to the definitive tournament winner (last survivor). */
  async recordWin(db: SQLiteDatabase, gameId: number, playerId: number): Promise<void> {
    await db.runAsync('INSERT OR IGNORE INTO rankings (player_id, game_id) VALUES (?, ?)', playerId, gameId);
    await db.runAsync('UPDATE rankings SET wins = wins + 1, updated_at = CURRENT_TIMESTAMP WHERE player_id = ? AND game_id = ?', playerId, gameId);
  },

  /** +1 loss — applied the moment a player is eliminated from a tournament. */
  async recordLoss(db: SQLiteDatabase, gameId: number, playerId: number): Promise<void> {
    await db.runAsync('INSERT OR IGNORE INTO rankings (player_id, game_id) VALUES (?, ?)', playerId, gameId);
    await db.runAsync('UPDATE rankings SET losses = losses + 1, updated_at = CURRENT_TIMESTAMP WHERE player_id = ? AND game_id = ?', playerId, gameId);
  },

  async delete(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM rankings WHERE id = ?', id);
  },
};

export const registrationRepository = {
  /** Any existing registration row for this player/tournament pair, regardless of status (including cancelled). */
  getForPlayer(db: SQLiteDatabase, tournamentId: number, playerId: number): Promise<Registration | null> {
    return db.getFirstAsync<Registration>(
      'SELECT * FROM registrations WHERE tournament_id = ? AND player_id = ?',
      tournamentId,
      playerId,
    );
  },

  /** Count of registrations that occupy a capacity slot (pending, registered or waitlisted). */
  async countActive(db: SQLiteDatabase, tournamentId: number): Promise<number> {
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM registrations
       WHERE tournament_id = ? AND status IN ('pending', 'registered', 'waitlisted')`,
      tournamentId,
    );
    return row?.count ?? 0;
  },

  /** Actively registered players for a tournament, for assigning them to matches/brackets (RF-12). */
  listParticipants(db: SQLiteDatabase, tournamentId: number): Promise<{ player_id: number; display_name: string }[]> {
    return db.getAllAsync<{ player_id: number; display_name: string }>(
      `SELECT p.id AS player_id, p.display_name
       FROM registrations r
       JOIN players p ON p.id = r.player_id
       WHERE r.tournament_id = ? AND r.status IN ('pending', 'registered', 'waitlisted')
       ORDER BY p.display_name COLLATE NOCASE`,
      tournamentId,
    );
  },

  /**
   * Registers (or re-registers, if a previous row was cancelled/rejected) a
   * player for a tournament. `tournament_id` + `player_id` is unique, so a
   * second registration reactivates the existing row instead of failing.
   *
   * Enforces the same rules as `evaluateRegistrationEligibility`: the
   * tournament must be published, inside its registration window and under
   * capacity. An already-active registration by the same player is always
   * allowed (it reactivates their own row without consuming a new slot).
   */
  async register(db: SQLiteDatabase, tournamentId: number, playerId: number): Promise<void> {
    const tournament = await tournamentRepository.getById(db, tournamentId);
    if (!tournament) throw new Error('Tournament not found.');
    if (tournament.status !== 'published') {
      throw new Error('This tournament is not currently open for registration.');
    }

    const now = new Date().toISOString();
    if (tournament.registration_opens_at && now < tournament.registration_opens_at) {
      throw new Error('Registration has not opened yet.');
    }
    const registrationClosesAt = tournament.registration_closes_at ?? tournament.start_at;
    if (now > registrationClosesAt) {
      throw new Error('The registration period for this tournament has closed.');
    }

    const existing = await registrationRepository.getForPlayer(db, tournamentId, playerId);
    // Organizer-removed registrations are marked 'rejected' and block re-entry;
    // a self-cancelled player keeps the right to re-register.
    if (existing?.status === 'rejected') {
      throw new Error('You were removed from this tournament and cannot register again.');
    }
    const alreadyActive = existing !== null && ACTIVE_REGISTRATION_STATUSES.includes(existing.status);
    if (!alreadyActive && (await registrationRepository.countActive(db, tournamentId)) >= tournament.capacity) {
      throw new Error('This tournament has reached its capacity.');
    }

    await registrationRepository.registerUnchecked(db, tournamentId, playerId);
  },

  /**
   * Same upsert as `register` but without the eligibility guard — for seeds,
   * fixtures and admin tooling that legitimately write registrations into
   * ongoing/closed tournaments.
   */
  async registerUnchecked(db: SQLiteDatabase, tournamentId: number, playerId: number): Promise<void> {
    await db.runAsync(
      `INSERT INTO registrations (tournament_id, player_id, status, registered_at)
       VALUES (?, ?, 'registered', CURRENT_TIMESTAMP)
       ON CONFLICT(tournament_id, player_id) DO UPDATE SET status = 'registered', registered_at = CURRENT_TIMESTAMP`,
      tournamentId,
      playerId,
    );
  },

  /** Cancels a player's registration, keeping the row (and its history) instead of deleting it. */
  async cancel(db: SQLiteDatabase, tournamentId: number, playerId: number): Promise<void> {
    await db.runAsync(
      "UPDATE registrations SET status = 'cancelled' WHERE tournament_id = ? AND player_id = ?",
      tournamentId,
      playerId,
    );
  },

  /** All registrations for a tournament (any status) with player names — for organizer management. */
  listForTournament(db: SQLiteDatabase, tournamentId: number): Promise<(Registration & { display_name: string; user_id: number | null })[]> {
    return db.getAllAsync<Registration & { display_name: string; user_id: number | null }>(
      `SELECT r.*, p.display_name, p.user_id
       FROM registrations r
       JOIN players p ON p.id = r.player_id
       WHERE r.tournament_id = ?
       ORDER BY r.registered_at ASC`,
      tournamentId,
    );
  },

  /** Tournament ids where this player's registration was rejected/removed — used to flag banned entries in listings. */
  listRejectedTournamentIds(db: SQLiteDatabase, playerId: number): Promise<number[]> {
    return db
      .getAllAsync<{ tournament_id: number }>(
        "SELECT tournament_id FROM registrations WHERE player_id = ? AND status = 'rejected'",
        playerId,
      )
      .then((rows) => rows.map((row) => row.tournament_id));
  },

  /** Directly sets a registration's status — organizer management (approve, reject, remove, readmit). */
  async setStatus(db: SQLiteDatabase, tournamentId: number, playerId: number, status: RegistrationStatus): Promise<void> {
    await db.runAsync(
      'UPDATE registrations SET status = ? WHERE tournament_id = ? AND player_id = ?',
      status,
      tournamentId,
      playerId,
    );
  },

  /** User ids of everyone actively following a tournament — registered players plus its organizer (RF-15 targets). */
  listFollowerUserIds(db: SQLiteDatabase, tournamentId: number): Promise<{ user_id: number }[]> {
    return db.getAllAsync<{ user_id: number }>(
      `SELECT DISTINCT p.user_id
       FROM registrations r JOIN players p ON p.id = r.player_id
       WHERE r.tournament_id = ? AND r.status IN ('pending', 'registered', 'waitlisted') AND p.user_id IS NOT NULL`,
      tournamentId,
    );
  },

  async delete(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM registrations WHERE id = ?', id);
  },
};

/** In-app notification feed (RF-15); rows are only written when the recipient has notifications enabled. */
export const notificationRepository = {
  create(db: SQLiteDatabase, input: { user_id: number; type: string; title: string; message: string }): Promise<number> {
    return db.runAsync(
      'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
      input.user_id,
      input.type,
      input.title,
      input.message,
    ).then((result) => result.lastInsertRowId);
  },

  listForUser(db: SQLiteDatabase, userId: number, limit = 30): Promise<AppNotification[]> {
    return db.getAllAsync<AppNotification>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?',
      userId,
      limit,
    );
  },

  /** Unread notifications of a single type — e.g. pending removal alerts to surface at login. */
  listUnreadByType(db: SQLiteDatabase, userId: number, type: string): Promise<AppNotification[]> {
    return db.getAllAsync<AppNotification>(
      'SELECT * FROM notifications WHERE user_id = ? AND type = ? AND read_at IS NULL ORDER BY id DESC',
      userId,
      type,
    );
  },

  async unreadCount(db: SQLiteDatabase, userId: number): Promise<number> {
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL',
      userId,
    );
    return row?.count ?? 0;
  },

  async markRead(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ?', id);
  },

  async markAllRead(db: SQLiteDatabase, userId: number): Promise<void> {
    await db.runAsync('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL', userId);
  },

  /** Permanently removes every notification of the user — the trash action on the profile feed. */
  async deleteAllForUser(db: SQLiteDatabase, userId: number): Promise<void> {
    await db.runAsync('DELETE FROM notifications WHERE user_id = ?', userId);
  },
};

/** Player-submitted reports about tournaments or users (RF-17). */
export const reportRepository = {
  create(db: SQLiteDatabase, input: { reporter_id: number; tournament_id?: number | null; target_user_id?: number | null; reason: string; details?: string | null }): Promise<number> {
    return db.runAsync(
      'INSERT INTO reports (reporter_id, tournament_id, target_user_id, reason, details) VALUES (?, ?, ?, ?, ?)',
      input.reporter_id,
      input.tournament_id ?? null,
      input.target_user_id ?? null,
      input.reason.trim(),
      input.details ?? null,
    ).then((result) => result.lastInsertRowId);
  },

  list(db: SQLiteDatabase, status?: ReportStatus): Promise<ReportSummary[]> {
    const conditions: string[] = [];
    const values: string[] = [];
    if (status) {
      conditions.push('r.status = ?');
      values.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return db.getAllAsync<ReportSummary>(
      `SELECT r.*, ru.username AS reporter_username, t.name AS tournament_name, tu.username AS target_username
       FROM reports r
       JOIN users ru ON ru.id = r.reporter_id
       LEFT JOIN tournaments t ON t.id = r.tournament_id
       LEFT JOIN users tu ON tu.id = r.target_user_id
       ${where}
       ORDER BY (r.status = 'open') DESC, r.id DESC`,
      values,
    );
  },

  async updateStatus(db: SQLiteDatabase, id: number, status: ReportStatus): Promise<void> {
    await db.runAsync(
      `UPDATE reports SET status = ?, resolved_at = CASE WHEN ? IN ('resolved', 'dismissed') THEN CURRENT_TIMESTAMP ELSE resolved_at END WHERE id = ?`,
      status,
      status,
      id,
    );
  },
};

/** Append-only administrative traceability (RF-17): every admin action is logged here. */
export const auditRepository = {
  log(db: SQLiteDatabase, input: { actor_user_id: number; action: string; entity_type: string; entity_id?: number | null; details?: string | null }): Promise<number> {
    return db.runAsync(
      'INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
      input.actor_user_id,
      input.action,
      input.entity_type,
      input.entity_id ?? null,
      input.details ?? null,
    ).then((result) => result.lastInsertRowId);
  },

  list(db: SQLiteDatabase, limit = 50): Promise<AuditLogSummary[]> {
    return db.getAllAsync<AuditLogSummary>(
      `SELECT a.*, u.username AS actor_username
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
       ORDER BY a.id DESC LIMIT ?`,
      limit,
    );
  },

  listForEntity(db: SQLiteDatabase, entityType: string, entityId: number): Promise<AuditLogEntry[]> {
    return db.getAllAsync<AuditLogEntry>(
      'SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC',
      entityType,
      entityId,
    );
  },
};

/** Global, admin-editable parameters stored as key/value pairs (RF-17). */
export const settingsRepository = {
  list(db: SQLiteDatabase): Promise<AppSetting[]> {
    return db.getAllAsync<AppSetting>('SELECT * FROM app_settings ORDER BY key');
  },

  async get(db: SQLiteDatabase, key: string): Promise<string | null> {
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key);
    return row?.value ?? null;
  },

  async isEnabled(db: SQLiteDatabase, key: string): Promise<boolean> {
    return (await settingsRepository.get(db, key)) === 'true';
  },

  async set(db: SQLiteDatabase, key: string, value: string): Promise<void> {
    await db.runAsync(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      key,
      value,
    );
  },
};

export const eventRepository = {
  create(db: SQLiteDatabase, input: CreateEventInput): Promise<number> {
    return db.runAsync(
      `INSERT INTO events (tournament_id, name, starts_at, ends_at, status, stream_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      input.tournament_id,
      input.name.trim(),
      input.starts_at,
      input.ends_at ?? null,
      input.status ?? 'upcoming',
      input.stream_url ?? null,
    ).then((result) => result.lastInsertRowId);
  },

  getById(db: SQLiteDatabase, id: number): Promise<TournamentEvent | null> {
    return db.getFirstAsync<TournamentEvent>('SELECT * FROM events WHERE id = ?', id);
  },

  /** Event row enriched with its tournament/game/organizer, for the detail screen. */
  getDetails(db: SQLiteDatabase, id: number): Promise<EventSummary | null> {
    return db.getFirstAsync<EventSummary>(
      `SELECT e.*, t.name AS tournament_name, t.status AS tournament_status, t.organizer_id,
        g.name AS game_name, u.username AS organizer_username
       FROM events e
       JOIN tournaments t ON t.id = e.tournament_id
       JOIN games g ON g.id = t.game_id
       JOIN users u ON u.id = t.organizer_id
       WHERE e.id = ?`,
      id,
    );
  },

  /** All events scheduled under a tournament, regardless of who is viewing (shown on the tournament's own detail screen). */
  listByTournament(db: SQLiteDatabase, tournamentId: number): Promise<TournamentEvent[]> {
    return db.getAllAsync<TournamentEvent>(
      'SELECT * FROM events WHERE tournament_id = ? ORDER BY starts_at ASC',
      tournamentId,
    );
  },

  /** Events for tournaments the user organizes or is actively registered for (RF-11). */
  listForUser(
    db: SQLiteDatabase,
    options: { userId: number; playerId: number | null; status?: TournamentEventStatus | TournamentEventStatus[] },
  ): Promise<EventSummary[]> {
    const conditions = [
      `(t.organizer_id = ? OR EXISTS (
        SELECT 1 FROM registrations r
        WHERE r.tournament_id = t.id AND r.player_id = ? AND r.status IN ('pending', 'registered', 'waitlisted')
      ))`,
    ];
    const values: (string | number)[] = [options.userId, options.playerId ?? -1];
    const statuses = options.status ? (Array.isArray(options.status) ? options.status : [options.status]) : [];
    if (statuses.length > 0) {
      conditions.push(`e.status IN (${statuses.map(() => '?').join(', ')})`);
      values.push(...statuses);
    }

    return db.getAllAsync<EventSummary>(
      `SELECT e.*, t.name AS tournament_name, t.status AS tournament_status, t.organizer_id,
        g.name AS game_name, u.username AS organizer_username
       FROM events e
       JOIN tournaments t ON t.id = e.tournament_id
       JOIN games g ON g.id = t.game_id
       JOIN users u ON u.id = t.organizer_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.starts_at ASC`,
      values,
    );
  },

  async update(
    db: SQLiteDatabase,
    id: number,
    input: Pick<CreateEventInput, 'name' | 'starts_at' | 'ends_at' | 'stream_url'>,
  ): Promise<void> {
    await db.runAsync(
      'UPDATE events SET name = ?, starts_at = ?, ends_at = ?, stream_url = ? WHERE id = ?',
      input.name.trim(),
      input.starts_at,
      input.ends_at ?? null,
      input.stream_url ?? null,
      id,
    );
  },

  async updateStatus(db: SQLiteDatabase, id: number, status: TournamentEventStatus): Promise<void> {
    await db.runAsync('UPDATE events SET status = ? WHERE id = ?', status, id);
  },

  async delete(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM events WHERE id = ?', id);
  },
};

export const stageRepository = {
  create(db: SQLiteDatabase, input: CreateStageInput): Promise<number> {
    return db.runAsync(
      'INSERT INTO stages (tournament_id, name, position, format) VALUES (?, ?, ?, ?)',
      input.tournament_id,
      input.name.trim(),
      input.position,
      input.format.trim(),
    ).then((result) => result.lastInsertRowId);
  },

  getById(db: SQLiteDatabase, id: number): Promise<Stage | null> {
    return db.getFirstAsync<Stage>('SELECT * FROM stages WHERE id = ?', id);
  },

  listByTournament(db: SQLiteDatabase, tournamentId: number): Promise<Stage[]> {
    return db.getAllAsync<Stage>('SELECT * FROM stages WHERE tournament_id = ? ORDER BY position ASC', tournamentId);
  },

  async delete(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM stages WHERE id = ?', id);
  },

  /** Closes a stage — no more rounds/matches can be added to it. */
  async close(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('UPDATE stages SET closed = 1 WHERE id = ?', id);
  },
};

const matchDetailsSelect = `
  SELECT m.*,
    p1.display_name AS player_one_name,
    p2.display_name AS player_two_name,
    pw.display_name AS winner_name,
    pr.display_name AS referee_name,
    (SELECT GROUP_CONCAT(mp.player_id) FROM match_participants mp WHERE mp.match_id = m.id ORDER BY mp.position) AS participant_ids_raw,
    (SELECT GROUP_CONCAT(pp.display_name, '|') FROM match_participants mp JOIN players pp ON pp.id = mp.player_id WHERE mp.match_id = m.id ORDER BY mp.position) AS participant_names_raw,
    (SELECT GROUP_CONCAT(mp.player_id) FROM match_participants mp WHERE mp.match_id = m.id AND mp.eliminated = 1 ORDER BY mp.position) AS eliminated_ids_raw
  FROM matches m
  LEFT JOIN players p1 ON p1.id = m.player_one_id
  LEFT JOIN players p2 ON p2.id = m.player_two_id
  LEFT JOIN players pw ON pw.id = m.winner_id
  LEFT JOIN players pr ON pr.id = m.referee_id
`;

type MatchDetailsRow = MatchDetails & {
  participant_ids_raw: string | null;
  participant_names_raw: string | null;
  eliminated_ids_raw: string | null;
};

/** Converts the aggregated participant columns into typed arrays. */
function hydrateMatchDetails(row: MatchDetailsRow): MatchDetails {
  const { participant_ids_raw, participant_names_raw, eliminated_ids_raw, ...match } = row;
  return {
    ...match,
    participant_ids: participant_ids_raw ? participant_ids_raw.split(',').map(Number) : [],
    participant_names: participant_names_raw ? participant_names_raw.split('|') : [],
    eliminated_ids: eliminated_ids_raw ? eliminated_ids_raw.split(',').map(Number) : [],
  };
}

export const matchRepository = {
  async create(db: SQLiteDatabase, input: CreateMatchInput): Promise<number> {
    const matchId = await db.runAsync(
      `INSERT INTO matches (stage_id, round_number, match_number, player_one_id, player_two_id, scheduled_at, referee_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      input.stage_id,
      input.round_number,
      input.match_number,
      input.player_one_id ?? null,
      input.player_two_id ?? null,
      input.scheduled_at ?? null,
      input.referee_id ?? null,
    ).then((result) => result.lastInsertRowId);
    for (const [position, playerId] of (input.participant_ids ?? []).entries()) {
      await db.runAsync(
        'INSERT OR IGNORE INTO match_participants (match_id, player_id, position) VALUES (?, ?, ?)',
        matchId,
        playerId,
        position,
      );
    }
    return matchId;
  },

  getById(db: SQLiteDatabase, id: number): Promise<Match | null> {
    return db.getFirstAsync<Match>('SELECT * FROM matches WHERE id = ?', id);
  },

  async getDetails(db: SQLiteDatabase, id: number): Promise<MatchDetails | null> {
    const row = await db.getFirstAsync<MatchDetailsRow>(`${matchDetailsSelect} WHERE m.id = ?`, id);
    return row ? hydrateMatchDetails(row) : null;
  },

  async listByStage(db: SQLiteDatabase, stageId: number): Promise<MatchDetails[]> {
    const rows = await db.getAllAsync<MatchDetailsRow>(
      `${matchDetailsSelect} WHERE m.stage_id = ? ORDER BY m.round_number ASC, m.match_number ASC`,
      stageId,
    );
    return rows.map(hydrateMatchDetails);
  },

  /** Matches across every stage of a tournament, optionally filtered by status (e.g. the "current matches" of an active event). */
  listForTournament(db: SQLiteDatabase, tournamentId: number, statuses?: MatchStatus[]): Promise<MatchDetails[]> {
    const conditions = ['s.tournament_id = ?'];
    const values: (string | number)[] = [tournamentId];
    if (statuses && statuses.length > 0) {
      conditions.push(`m.status IN (${statuses.map(() => '?').join(', ')})`);
      values.push(...statuses);
    }
    return db.getAllAsync<MatchDetailsRow>(
      `${matchDetailsSelect}
       JOIN stages s ON s.id = m.stage_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY (m.scheduled_at IS NULL), m.scheduled_at ASC, s.position ASC, m.round_number ASC, m.match_number ASC`,
      values,
    ).then((rows) => rows.map(hydrateMatchDetails));
  },

  /** The last completed match of a tournament (highest stage/round), used to surface the overall winner once it finishes. */
  async getFinalForTournament(db: SQLiteDatabase, tournamentId: number): Promise<MatchDetails | null> {
    const row = await db.getFirstAsync<MatchDetailsRow>(
      `${matchDetailsSelect}
       JOIN stages s ON s.id = m.stage_id
       WHERE s.tournament_id = ? AND m.status = 'completed'
       ORDER BY s.position DESC, m.round_number DESC, m.match_number ASC
       LIMIT 1`,
      tournamentId,
    );
    return row ? hydrateMatchDetails(row) : null;
  },

  /** Assigns/updates participants, schedule and referee without touching the result (RF-12). */
  async assign(
    db: SQLiteDatabase,
    id: number,
    input: { player_one_id: number | null; player_two_id: number | null; scheduled_at: string | null; referee_id: number | null },
  ): Promise<void> {
    await db.runAsync(
      'UPDATE matches SET player_one_id = ?, player_two_id = ?, scheduled_at = ?, referee_id = ? WHERE id = ?',
      input.player_one_id,
      input.player_two_id,
      input.scheduled_at,
      input.referee_id,
      id,
    );
  },

  /** Replaces every participant of a multi-player match (round matches host N players). */
  async replaceParticipants(db: SQLiteDatabase, id: number, playerIds: number[]): Promise<void> {
    await db.runAsync('DELETE FROM match_participants WHERE match_id = ?', id);
    for (const [position, playerId] of playerIds.entries()) {
      await db.runAsync(
        'INSERT OR IGNORE INTO match_participants (match_id, player_id, position) VALUES (?, ?, ?)',
        id,
        playerId,
        position,
      );
    }
  },

  /** Marks the given participants as eliminated in a multi-player match. */
  async markEliminated(db: SQLiteDatabase, id: number, playerIds: number[]): Promise<void> {
    await db.runAsync('UPDATE match_participants SET eliminated = 0 WHERE match_id = ?', id);
    for (const playerId of playerIds) {
      await db.runAsync(
        'UPDATE match_participants SET eliminated = 1 WHERE match_id = ? AND player_id = ?',
        id,
        playerId,
      );
    }
  },

  /** Players eliminated anywhere in a tournament (multi-player flag plus 1v1 losers) — they cannot be picked for later rounds. */
  listEliminatedPlayerIds(db: SQLiteDatabase, tournamentId: number): Promise<number[]> {
    return db.getAllAsync<{ player_id: number }>(
      `SELECT DISTINCT mp.player_id
         FROM match_participants mp
         JOIN matches m ON m.id = mp.match_id
         JOIN stages s ON s.id = m.stage_id
        WHERE s.tournament_id = ? AND mp.eliminated = 1
       UNION
       SELECT DISTINCT CASE WHEN m.winner_id = m.player_one_id THEN m.player_two_id ELSE m.player_one_id END
         FROM matches m
         JOIN stages s ON s.id = m.stage_id
        WHERE s.tournament_id = ? AND m.status = 'completed' AND m.winner_id IS NOT NULL`,
      tournamentId,
      tournamentId,
    ).then((rows) => rows.map((row) => row.player_id).filter((id): id is number => id != null));
  },

  /** Stores the organizer's round details message on the match. */
  async setDetails(db: SQLiteDatabase, id: number, details: string | null): Promise<void> {
    await db.runAsync('UPDATE matches SET details = ? WHERE id = ?', details, id);
  },

  async markOngoing(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync("UPDATE matches SET status = 'ongoing' WHERE id = ?", id);
  },

  /** Publishes a final score and winner, closing the match (RF-12). */
  async recordResult(
    db: SQLiteDatabase,
    id: number,
    input: { score_one: number; score_two: number; winner_id: number; evidence_uri: string | null },
  ): Promise<void> {
    await db.runAsync(
      "UPDATE matches SET score_one = ?, score_two = ?, winner_id = ?, evidence_uri = ?, status = 'completed' WHERE id = ?",
      input.score_one,
      input.score_two,
      input.winner_id,
      input.evidence_uri,
      id,
    );
  },

  /** Flags a match as disputed, pending organizer resolution. */
  async markDisputed(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync("UPDATE matches SET status = 'disputed' WHERE id = ?", id);
  },

  async updateStatus(db: SQLiteDatabase, id: number, status: MatchStatus): Promise<void> {
    await db.runAsync('UPDATE matches SET status = ? WHERE id = ?', status, id);
  },

  async delete(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM matches WHERE id = ?', id);
  },
};

export type { Ranking };