import type { SQLiteDatabase } from 'expo-sqlite';
import {
  countryRepository,
  gameRepository,
  playerRepository,
  tournamentRepository,
  userRepository,
} from './repositories';

export async function runDatabaseIntegrationChecks(db: SQLiteDatabase): Promise<void> {
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (version?.user_version !== 3) {
    throw new Error(`Expected database version 3, found ${version?.user_version ?? 0}.`);
  }

  const requiredTables = [
    'users', 'games', 'countries', 'players', 'tournaments', 'rankings', 'registrations',
    'events', 'stages', 'matches', 'notifications', 'user_preferences', 'reports', 'audit_logs',
  ];
  const installedTables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  const installedTableNames = new Set(installedTables.map((table) => table.name));
  for (const tableName of requiredTables) {
    if (!installedTableNames.has(tableName)) {
      throw new Error(`Required database table ${tableName} is missing.`);
    }
  }

  const foreignKeys = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
  if (foreignKeys?.foreign_keys !== 1) {
    throw new Error('SQLite foreign key enforcement is disabled.');
  }

  const suffix = `${Date.now()}`;
  let userId: number | null = null;
  let gameId: number | null = null;
  let countryId: number | null = null;
  let playerId: number | null = null;
  let tournamentId: number | null = null;

  try {
    userId = await userRepository.create(db, {
      username: `db-check-${suffix}`,
      email: `db-check-${suffix}@example.invalid`,
      password_hash: 'test-hash-only',
      terms_accepted: true,
    });
    gameId = await gameRepository.create(db, `DB Check ${suffix}`, 'Integration');
    countryId = await countryRepository.create(db, {
      name: `Test Country ${suffix}`,
      code: 'ZZ',
    });
    playerId = await playerRepository.create(db, {
      display_name: `DB Check Player ${suffix}`,
      user_id: userId,
      country_id: countryId,
      favorite_game_id: gameId,
    });

    const player = await playerRepository.getById(db, playerId);
    if (!player || player.display_name !== `DB Check Player ${suffix}`) {
      throw new Error('Player read-after-create check failed.');
    }
    await playerRepository.update(db, playerId, `DB Check Player Updated ${suffix}`);
    const updatedPlayer = await playerRepository.getById(db, playerId);
    if (updatedPlayer?.display_name !== `DB Check Player Updated ${suffix}`) {
      throw new Error('Player update check failed.');
    }

    tournamentId = await tournamentRepository.create(db, {
      name: `DB Check Tournament ${suffix}`,
      game_id: gameId,
      country_id: countryId,
      organizer_id: userId,
      timezone: 'UTC',
      start_at: '2030-01-01T12:00:00.000Z',
      format: 'single_elimination',
      capacity: 8,
    });

    const filteredTournaments = await tournamentRepository.list(db, {
      search: `DB Check Tournament ${suffix}`,
      gameId,
      countryId,
      organizerId: userId,
    });
    if (!filteredTournaments.some((tournament) => tournament.id === tournamentId)) {
      throw new Error('Tournament filtered query check failed.');
    }

    await tournamentRepository.update(db, tournamentId, {
      name: `DB Check Tournament Updated ${suffix}`,
      game_id: gameId,
      country_id: countryId,
      organizer_id: userId,
      timezone: 'UTC',
      start_at: '2030-01-01T12:00:00.000Z',
      format: 'single_elimination',
      capacity: 16,
    });
    const updatedTournament = await tournamentRepository.getById(db, tournamentId);
    if (updatedTournament?.capacity !== 16 || updatedTournament.name !== `DB Check Tournament Updated ${suffix}`) {
      throw new Error('Tournament update check failed.');
    }

    let rejectedInvalidTournament = false;
    try {
      await tournamentRepository.create(db, {
        name: 'Invalid integration tournament',
        game_id: gameId,
        country_id: countryId,
        organizer_id: userId,
        timezone: 'UTC',
        start_at: '2030-01-01T12:00:00.000Z',
        format: 'single_elimination',
        capacity: 0,
      });
    } catch {
      rejectedInvalidTournament = true;
    }
    if (!rejectedInvalidTournament) {
      throw new Error('Invalid tournament constraint check failed.');
    }

    await tournamentRepository.delete(db, tournamentId);
    tournamentId = null;
    await playerRepository.delete(db, playerId);
    playerId = null;
    await countryRepository.delete(db, countryId);
    countryId = null;
    await gameRepository.delete(db, gameId);
    gameId = null;
    await userRepository.delete(db, userId);
    userId = null;
  } finally {
    if (tournamentId !== null) await tournamentRepository.delete(db, tournamentId);
    if (playerId !== null) await playerRepository.delete(db, playerId);
    if (countryId !== null) await countryRepository.delete(db, countryId);
    if (gameId !== null) await gameRepository.delete(db, gameId);
    if (userId !== null) await userRepository.delete(db, userId);
  }
}