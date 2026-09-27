import type { SQLiteDatabase } from 'expo-sqlite';
import { DATABASE_VERSION, indexes, migrations } from './schema';

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion > DATABASE_VERSION) {
    throw new Error(`Database version ${currentVersion} is newer than supported version ${DATABASE_VERSION}.`);
  }

  while (currentVersion < DATABASE_VERSION) {
    const nextVersion = currentVersion + 1;
    const migration = migrations[nextVersion];
    if (!migration) {
      throw new Error(`Missing database migration ${nextVersion}.`);
    }

    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(migration);
      await transaction.execAsync(indexes);
      await transaction.execAsync(`PRAGMA user_version = ${nextVersion};`);
    });
    currentVersion = nextVersion;
  }

  await db.execAsync(indexes);
  await db.execAsync('PRAGMA foreign_keys = ON;');
}