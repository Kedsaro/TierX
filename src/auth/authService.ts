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

export type AuthErrorCode = 'INVALID_CREDENTIALS';

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AuthService {
  register(input: { username: string; email: string; password: string; acceptedTerms: boolean }): Promise<{ email: string }>;
  signIn(login: string, password: string): Promise<AuthenticatedUser>;
  restoreSession(): Promise<AuthenticatedUser | null>;
  signOut(): Promise<void>;
}

function publicUser(user: User): AuthenticatedUser {
  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export function createAuthService(
  db: SQLiteDatabase,
  sessionStore: SessionStore,
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

      const existingUser = await userRepository.getByLogin(db, input.username);
      const existingEmail = await userRepository.getByLogin(db, input.email);
      if (existingUser || existingEmail) {
        throw new Error('An account with this username or email already exists.');
      }

      const passwordHash = await hashPassword(input.password);
      const userId = await userRepository.create(db, {
        username: input.username,
        email: input.email,
        password_hash: passwordHash,
        terms_accepted: input.acceptedTerms,
      });
      await userRepository.setVerified(db, userId);

      return { email: input.email };
    },

    async signIn(login, password) {
      const user = await userRepository.getByLogin(db, login);
      if (!user) {
        throw new AuthError('INVALID_CREDENTIALS', 'The username/email or password is incorrect.');
      }
      if (!(await verifyPassword(password, user.password_hash))) {
        throw new AuthError('INVALID_CREDENTIALS', 'The username/email or password is incorrect.');
      }

      await sessionStore.saveUserId(user.id);
      return publicUser(user);
    },

    async restoreSession() {
      const userId = await sessionStore.readUserId();
      if (userId === null) return null;
      const user = await userRepository.getById(db, userId);
      if (!user) {
        await sessionStore.clear();
        return null;
      }
      return publicUser(user);
    },

    async signOut() {
      await sessionStore.clear();
    },
  };
}
