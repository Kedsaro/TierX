import type { SQLiteDatabase } from 'expo-sqlite';
import type { Country, Game } from '../types/catalog';
import type { CreatePlayerInput, Player, Ranking, RankingWithPlayer } from '../types/player';
import type { CreateTournamentInput, Tournament, TournamentFilters } from '../types/tournament';
import type { CreateUserInput, User } from '../types/user';

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
      'INSERT INTO players (display_name, user_id, country_id, favorite_game_id) VALUES (?, ?, ?, ?)',
      input.display_name.trim(),
      input.user_id ?? null,
      input.country_id ?? null,
      input.favorite_game_id ?? null,
    ).then((result) => result.lastInsertRowId);
  },

  getById(db: SQLiteDatabase, id: number): Promise<Player | null> {
    return db.getFirstAsync<Player>('SELECT * FROM players WHERE id = ?', id);
  },

  list(db: SQLiteDatabase): Promise<Player[]> {
    return db.getAllAsync<Player>('SELECT * FROM players ORDER BY display_name COLLATE NOCASE');
  },

  async update(db: SQLiteDatabase, id: number, displayName: string): Promise<void> {
    await db.runAsync(
      'UPDATE players SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      displayName.trim(),
      id,
    );
  },

  async delete(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM players WHERE id = ?', id);
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

  list(db: SQLiteDatabase, filters: TournamentFilters = {}): Promise<Tournament[]> {
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
    return db.getAllAsync<Tournament>(
      `SELECT t.* FROM tournaments t
       JOIN games g ON g.id = t.game_id
       JOIN users u ON u.id = t.organizer_id
       ${where}
       ORDER BY t.start_at ASC, t.id DESC`,
      values,
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

  async delete(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM rankings WHERE id = ?', id);
  },
};

export type { Ranking };