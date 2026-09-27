import type { SQLiteDatabase } from 'expo-sqlite';
import { userRepository } from '../database/repositories';
import type { User } from '../types/user';
import { hashPassword, verifyPassword } from './passwordHash';
import { validateRegistration } from './validation';

export type AuthenticatedUser = Omit<User, 'password_hash'>;

export interface SessionStore {
  readUserId(): Promise<number | null>;
  saveUserId(userId: number): Promise<void>;
  clear(): Promise<void>;
}

export interface EmailAccountProvider {
  sendVerificationCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  sendPasswordResetCode(email: string): Promise<void>;
  verifyPasswordResetCode(email: string, code: string): Promise<void>;
  sendLoginCode(email: string): Promise<void>;
  verifyLoginCode(email: string, code: string): Promise<void>;
}

export type AuthErrorCode = 'INVALID_CREDENTIALS' | 'EMAIL_NOT_VERIFIED' | 'EMAIL_PROVIDER_UNAVAILABLE' | 'EMAIL_PROVIDER_ERROR';

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AuthService {
  register(input: { username: string; email: string; password: string; acceptedTerms: boolean }): Promise<{ user: AuthenticatedUser; email: string }>;
  signIn(login: string, password: string): Promise<AuthenticatedUser>;
  signInWithCode(login: string, password: string, code: string): Promise<AuthenticatedUser>;
  sendLoginCode(login: string, password: string): Promise<{ email: string }>;
  restoreSession(): Promise<AuthenticatedUser | null>;
  signOut(): Promise<void>;
  sendVerificationCode(email: string): Promise<void>;
  verifyEmail(email: string, code: string): Promise<void>;
  sendPasswordResetCode(email: string): Promise<void>;
  resetPassword(email: string, code: string, newPassword: string): Promise<void>;
}

function publicUser(user: User): AuthenticatedUser {
  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function emailProviderUnavailable(): AuthError {
  return new AuthError(
    'EMAIL_PROVIDER_UNAVAILABLE',
    'Email verification and password recovery are unavailable until an email provider is configured. Your account has not been verified.',
  );
}

export function createAuthService(
  db: SQLiteDatabase,
  sessionStore: SessionStore,
  emailProvider?: EmailAccountProvider,
): AuthService {
  return {
    async register(input) {
      const validationErrors = validateRegistration({
        username: input.username,
        email: input.email,
        password: input.password,
        confirmPassword: input.password,
        acceptedTerms: input.acceptedTerms,
      });
      const firstValidationError = Object.values(validationErrors)[0];
      if (firstValidationError) throw new Error(firstValidationError);
      const passwordHash = await hashPassword(input.password);
      const userId = await userRepository.create(db, {
        username: input.username,
        email: input.email,
        password_hash: passwordHash,
        terms_accepted: true,
      });
      const user = await userRepository.getById(db, userId);
      if (!user) throw new Error('The account could not be loaded after registration.');
      return { user: publicUser(user), email: user.email };
    },

    async signIn(login, password) {
      const user = await userRepository.getByLogin(db, login);
      if (!user) {
        throw new AuthError('INVALID_CREDENTIALS', 'The username/email or password is incorrect.');
      }
      if (!user.is_verified) {
        throw new AuthError('EMAIL_NOT_VERIFIED', 'Verify your email address before signing in.');
      }
      if (!(await verifyPassword(password, user.password_hash))) {
        throw new AuthError('INVALID_CREDENTIALS', 'The username/email or password is incorrect.');
      }

      await sessionStore.saveUserId(user.id);
      return publicUser(user);
    },

    async sendLoginCode(login, password) {
      const user = await userRepository.getByLogin(db, login);
      if (!user) {
        throw new AuthError('INVALID_CREDENTIALS', 'The username/email or password is incorrect.');
      }
      if (!user.is_verified) {
        throw new AuthError('EMAIL_NOT_VERIFIED', 'Verify your email address before signing in.');
      }
      if (!(await verifyPassword(password, user.password_hash))) {
        throw new AuthError('INVALID_CREDENTIALS', 'The username/email or password is incorrect.');
      }

      if (!emailProvider) throw emailProviderUnavailable();
      await emailProvider.sendLoginCode(user.email);
      return { email: user.email };
    },

    async signInWithCode(login, password, code) {
      const user = await userRepository.getByLogin(db, login);
      if (!user) {
        throw new AuthError('INVALID_CREDENTIALS', 'The username/email or password is incorrect.');
      }
      if (!user.is_verified) {
        throw new AuthError('EMAIL_NOT_VERIFIED', 'Verify your email address before signing in.');
      }
      if (!(await verifyPassword(password, user.password_hash))) {
        throw new AuthError('INVALID_CREDENTIALS', 'The username/email or password is incorrect.');
      }

      if (!emailProvider) throw emailProviderUnavailable();
      await emailProvider.verifyLoginCode(user.email, code);

      await sessionStore.saveUserId(user.id);
      return publicUser(user);
    },

    async restoreSession() {
      const userId = await sessionStore.readUserId();
      if (userId === null) return null;
      const user = await userRepository.getById(db, userId);
      if (!user?.is_verified) {
        await sessionStore.clear();
        return null;
      }
      return publicUser(user);
    },

    async signOut() {
      await sessionStore.clear();
    },

    async sendVerificationCode(email) {
      if (!emailProvider) throw emailProviderUnavailable();
      await emailProvider.sendVerificationCode(email);
    },

    async verifyEmail(email, code) {
      if (!emailProvider) throw emailProviderUnavailable();
      await emailProvider.verifyCode(email, code);
      const user = await userRepository.getByLogin(db, email);
      if (!user) throw new AuthError('INVALID_CREDENTIALS', 'The account could not be found.');
      await userRepository.setVerified(db, user.id);
    },

    async sendPasswordResetCode(email) {
      if (!emailProvider) throw emailProviderUnavailable();
      await emailProvider.sendPasswordResetCode(email);
    },

    async resetPassword(email, code, newPassword) {
      if (!emailProvider) throw emailProviderUnavailable();
      await emailProvider.verifyPasswordResetCode(email, code);
      const user = await userRepository.getByLogin(db, email);
      if (!user) throw new AuthError('INVALID_CREDENTIALS', 'The account could not be found.');
      await userRepository.updatePasswordHash(db, user.id, await hashPassword(newPassword));
    },
  };
}