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
  let userId: number | null = null;

  try {
    const registration = await authService.register({
      username: `auth-check-${suffix}`,
      email,
      password: 'TierX-Test-Password-73',
      acceptedTerms: true,
    });
    userId = registration.user.id;

    const storedUser = await userRepository.getById(db, userId);
    if (!storedUser || !storedUser.password_hash.startsWith('argon2id$')) {
      throw new Error('Password was not stored as an Argon2id hash.');
    }
    if (storedUser.password_hash.includes('TierX-Test-Password-73')) {
      throw new Error('Plaintext password was stored in the user record.');
    }
    if (storedUser.terms_accepted_at === null) {
      throw new Error('Terms acceptance timestamp was not recorded.');
    }
    if (storedUser.is_verified) {
      throw new Error('New offline account must remain unverified until email verification succeeds.');
    }

    let pendingLoginRejected = false;
    try {
      await authService.signIn(email, 'TierX-Test-Password-73');
    } catch (error) {
      pendingLoginRejected = error instanceof AuthError && error.code === 'EMAIL_NOT_VERIFIED';
    }
    if (!pendingLoginRejected) {
      throw new Error('An unverified account was not rejected during sign in.');
    }

    let emailDeliveryRejected = false;
    try {
      await authService.sendVerificationCode(email);
    } catch (error) {
      emailDeliveryRejected = error instanceof AuthError && error.code === 'EMAIL_PROVIDER_UNAVAILABLE';
    }
    if (!emailDeliveryRejected) {
      throw new Error('Missing email provider was not reported as unavailable.');
    }

    await userRepository.setVerified(db, userId);
    const signedInUser = await authService.signIn(email, 'TierX-Test-Password-73');
    if (signedInUser.id !== userId || 'password_hash' in signedInUser) {
      throw new Error('Verified user sign in returned an invalid public session.');
    }
    const restoredUser = await authService.restoreSession();
    if (restoredUser?.id !== userId) {
      throw new Error('Secure-session restore check failed.');
    }

    let incorrectPasswordRejected = false;
    try {
      await authService.signIn(email, 'Wrong-password-73');
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