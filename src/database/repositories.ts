import type { SQLiteDatabase } from 'expo-sqlite';
import type { Country, Game } from '../types/catalog';
import type { CreateEventInput, EventSummary, TournamentEvent, TournamentEventStatus } from '../types/event';
import type { CreateMatchInput, CreateStageInput, Match, MatchDetails, MatchStatus, Stage } from '../types/match';
import type { CreatePlayerInput, Player, Ranking, RankingWithPlayer, UpdatePlayerInput } from '../types/player';
import type { MatchHistoryItem, PlayerRankSummary, ProfileStats, UserPreferences } from '../types/profile';
import type { Registration } from '../types/registration';
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
      `SELECT COUNT(*) AS count FROM registrations
       WHERE player_id = ? AND status IN ('pending', 'registered', 'waitlisted')`,
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
        g.name AS game_name
       FROM matches m
       JOIN stages s ON s.id = m.stage_id
       JOIN tournaments t ON t.id = s.tournament_id
       JOIN games g ON g.id = t.game_id
       LEFT JOIN players p1 ON p1.id = m.player_one_id
       LEFT JOIN players p2 ON p2.id = m.player_two_id
       LEFT JOIN players pw ON pw.id = m.winner_id
       LEFT JOIN players pr ON pr.id = m.referee_id
       WHERE (m.player_one_id = ? OR m.player_two_id = ?) AND m.status = 'completed'
       ORDER BY m.id DESC
       LIMIT ?`,
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
        scope, format, capacity, rules, requirements, prizes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.scope ?? 'local',
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
        visibility = ?, scope = ?, format = ?, capacity = ?, rules = ?, requirements = ?, prizes = ?,
        status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      input.name.trim(), input.description ?? null, input.image_uri ?? null, input.game_id,
      input.country_id, input.organizer_id, input.timezone.trim(), input.start_at, input.end_at ?? null,
      input.registration_opens_at ?? null, input.registration_closes_at ?? null,
      input.visibility ?? 'public', input.scope ?? 'local', input.format.trim(), input.capacity,
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
   */
  async register(db: SQLiteDatabase, tournamentId: number, playerId: number): Promise<void> {
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

  async delete(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM registrations WHERE id = ?', id);
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
};

const matchDetailsSelect = `
  SELECT m.*,
    p1.display_name AS player_one_name,
    p2.display_name AS player_two_name,
    pw.display_name AS winner_name,
    pr.display_name AS referee_name
  FROM matches m
  LEFT JOIN players p1 ON p1.id = m.player_one_id
  LEFT JOIN players p2 ON p2.id = m.player_two_id
  LEFT JOIN players pw ON pw.id = m.winner_id
  LEFT JOIN players pr ON pr.id = m.referee_id
`;

export const matchRepository = {
  create(db: SQLiteDatabase, input: CreateMatchInput): Promise<number> {
    return db.runAsync(
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
  },

  getById(db: SQLiteDatabase, id: number): Promise<Match | null> {
    return db.getFirstAsync<Match>('SELECT * FROM matches WHERE id = ?', id);
  },

  getDetails(db: SQLiteDatabase, id: number): Promise<MatchDetails | null> {
    return db.getFirstAsync<MatchDetails>(`${matchDetailsSelect} WHERE m.id = ?`, id);
  },

  listByStage(db: SQLiteDatabase, stageId: number): Promise<MatchDetails[]> {
    return db.getAllAsync<MatchDetails>(
      `${matchDetailsSelect} WHERE m.stage_id = ? ORDER BY m.round_number ASC, m.match_number ASC`,
      stageId,
    );
  },

  /** Matches across every stage of a tournament, optionally filtered by status (e.g. the "current matches" of an active event). */
  listForTournament(db: SQLiteDatabase, tournamentId: number, statuses?: MatchStatus[]): Promise<MatchDetails[]> {
    const conditions = ['s.tournament_id = ?'];
    const values: (string | number)[] = [tournamentId];
    if (statuses && statuses.length > 0) {
      conditions.push(`m.status IN (${statuses.map(() => '?').join(', ')})`);
      values.push(...statuses);
    }
    return db.getAllAsync<MatchDetails>(
      `${matchDetailsSelect}
       JOIN stages s ON s.id = m.stage_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY (m.scheduled_at IS NULL), m.scheduled_at ASC, s.position ASC, m.round_number ASC, m.match_number ASC`,
      values,
    );
  },

  /** The last completed match of a tournament (highest stage/round), used to surface the overall winner once it finishes. */
  getFinalForTournament(db: SQLiteDatabase, tournamentId: number): Promise<MatchDetails | null> {
    return db.getFirstAsync<MatchDetails>(
      `${matchDetailsSelect}
       JOIN stages s ON s.id = m.stage_id
       WHERE s.tournament_id = ? AND m.status = 'completed'
       ORDER BY s.position DESC, m.round_number DESC, m.match_number ASC
       LIMIT 1`,
      tournamentId,
    );
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