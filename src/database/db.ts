import type { SQLiteDatabase } from 'expo-sqlite';
import { databaseKeyPragma, getDatabaseKey } from './encryption';
import { DATABASE_VERSION, indexes, migrations } from './schema';

// expo-sqlite caches and reuses the underlying native connection for a given
// database path across JS reloads (Fast Refresh, dev double-invocation,
// etc.). SQLCipher only allows the key to be set once per connection, so
// re-running the `PRAGMA key` statement on an already-keyed connection
// corrupts its cipher state. Track which connections have already been
// initialized so repeated onInit calls for the same connection are no-ops.
const initializedConnections = new WeakSet<SQLiteDatabase>();

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  if (initializedConnections.has(db)) return;
  initializedConnections.add(db);

  // SQLCipher: the key must be the first statement executed on the connection.
  await db.execAsync(databaseKeyPragma(await getDatabaseKey()));
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

    // `withExclusiveTransactionAsync` opens a brand new native connection for
    // the transaction, which would not have the SQLCipher key applied. Use
    // `withTransactionAsync`, which reuses this already-keyed connection,
    // since migrations run once at startup before any other code touches
    // the database and don't need cross-connection exclusivity.
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration);
      await db.execAsync(indexes);
      await db.execAsync(`PRAGMA user_version = ${nextVersion};`);
    });
    currentVersion = nextVersion;
  }

  await db.execAsync(indexes);
  await db.execAsync('PRAGMA foreign_keys = ON;');
}
