import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { defaultDatabaseDirectory, openDatabaseAsync } from 'expo-sqlite';
import { DATABASE_NAME } from './schema';

const DATABASE_KEY_SECURESTORE_KEY = 'tierx.db.encryption-key';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

let pendingDatabaseKey: Promise<string> | null = null;

/**
 * Returns the SQLCipher key, generating and persisting a random 256-bit key
 * in Android Keystore (via expo-secure-store) on first use.
 *
 * Memoized so that concurrent callers (e.g. React effects double-invoked in
 * development) always resolve to the same key instead of racing to generate
 * and persist two different keys for the same database file.
 */
export async function getDatabaseKey(): Promise<string> {
  if (!pendingDatabaseKey) {
    pendingDatabaseKey = (async () => {
      const storedKey = await SecureStore.getItemAsync(DATABASE_KEY_SECURESTORE_KEY);
      if (storedKey && /^[a-f\d]{64}$/i.test(storedKey)) return storedKey;

      const generatedKey = toHex(Crypto.getRandomBytes(32));
      await SecureStore.setItemAsync(DATABASE_KEY_SECURESTORE_KEY, generatedKey);
      return generatedKey;
    })().catch((error) => {
      pendingDatabaseKey = null;
      throw error;
    });
  }
  return pendingDatabaseKey;
}

export function databaseKeyPragma(key: string): string {
  return `PRAGMA key = "x'${key}'"`;
}

/**
 * Migrates a legacy plaintext database into a SQLCipher-encrypted one.
 * Must run before the main database is opened. If the existing file is
 * already encrypted, missing, or empty, this is a no-op.
 */
export async function migrateLegacyDatabase(databaseKey: string): Promise<void> {
  const directoryUri = defaultDatabaseDirectory as string;
  const directoryPath = directoryUri.replace(/^file:\/\//, '');
  const legacyUri = `${directoryUri}${DATABASE_NAME}`;
  const encryptedTempPath = `${directoryPath}${DATABASE_NAME}.encrypted`;

  const fileInfo = await FileSystem.getInfoAsync(legacyUri);
  if (!fileInfo.exists) return;

  // Use a dedicated connection: expo-sqlite reuses a cached native connection
  // for the same path + options, and we must not share it with the keyed
  // connection the SQLiteProvider opens for the same database name.
  const legacyDb = await openDatabaseAsync(DATABASE_NAME, { useNewConnection: true });
  let hasPlaintextData = false;
  try {
    const row = await legacyDb.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' LIMIT 1",
    );
    hasPlaintextData = row !== null;
  } catch {
    // The file exists but cannot be read without a key: already encrypted.
    hasPlaintextData = false;
  }

  if (!hasPlaintextData) {
    await legacyDb.closeAsync();
    return;
  }

  try {
    await legacyDb.execAsync(`ATTACH DATABASE '${encryptedTempPath}' AS encrypted KEY "x'${databaseKey}'"`);
    await legacyDb.execAsync(`SELECT sqlcipher_export('encrypted')`);
    await legacyDb.execAsync('DETACH DATABASE encrypted');
  } finally {
    await legacyDb.closeAsync();
  }

  await FileSystem.deleteAsync(legacyUri);
  await FileSystem.moveAsync({ from: `${directoryUri}${DATABASE_NAME}.encrypted`, to: legacyUri });
}
