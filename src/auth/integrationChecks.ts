import type { SQLiteDatabase } from 'expo-sqlite';
import { userRepository } from '../database/repositories';
import { AuthError, createAuthService } from './authService';

class MemorySessionStore {
  userId: number | null = null;

  async readUserId(): Promise<number | null> {
    return this.userId;
  }

  async saveUserId(userId: number): Promise<void> {
    this.userId = userId;
  }

  async clear(): Promise<void> {
    this.userId = null;
  }
}

export async function runAuthIntegrationChecks(db: SQLiteDatabase): Promise<void> {
  const sessionStore = new MemorySessionStore();
  const authService = createAuthService(db, sessionStore);
  const suffix = `${Date.now()}`;
  const email = `auth-check-${suffix}@example.invalid`;
  const username = `auth-check-${suffix}`;
  const password = 'TestPass12';
  let userId: number | null = null;

  try {
    // Registration creates an active account that can sign in immediately
    await authService.register({
      username,
      email,
      password,
      acceptedTerms: true,
    });

    const storedUser = await userRepository.getByLogin(db, email);
    if (!storedUser) {
      throw new Error('Registration did not persist the new user.');
    }
    userId = storedUser.id;
    if (!storedUser.password_hash.startsWith('argon2id$')) {
      throw new Error('Password was not stored as an Argon2id hash.');
    }
    if (storedUser.password_hash.includes(password)) {
      throw new Error('Plaintext password was stored in the user record.');
    }
    if (storedUser.terms_accepted_at === null) {
      throw new Error('Terms acceptance timestamp was not recorded.');
    }

    let duplicateRejected = false;
    try {
      await authService.register({
        username,
        email,
        password,
        acceptedTerms: true,
      });
    } catch {
      duplicateRejected = true;
    }
    if (!duplicateRejected) {
      throw new Error('A duplicate username/email registration was not rejected.');
    }

    const signedInUser = await authService.signIn(email, password);
    if (signedInUser.id !== userId || 'password_hash' in signedInUser) {
      throw new Error('Sign in returned an invalid public session.');
    }
    const restoredUser = await authService.restoreSession();
    if (restoredUser?.id !== userId) {
      throw new Error('Secure-session restore check failed.');
    }

    let incorrectPasswordRejected = false;
    try {
      await authService.signIn(email, 'WrongPass12');
    } catch (error) {
      incorrectPasswordRejected = error instanceof AuthError && error.code === 'INVALID_CREDENTIALS';
    }
    if (!incorrectPasswordRejected) {
      throw new Error('Incorrect password was not rejected.');
    }

    await authService.signOut();
    if (sessionStore.userId !== null || (await authService.restoreSession()) !== null) {
      throw new Error('Sign out did not clear the persisted session.');
    }
  } finally {
    if (userId !== null) await userRepository.delete(db, userId);
    await sessionStore.clear();
  }
}
