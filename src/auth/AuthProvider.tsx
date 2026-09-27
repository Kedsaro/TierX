import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { createAuthService } from './authService';
import { createResendEmailProvider } from './resendEmailProvider';
import type { AuthenticatedUser, AuthService } from './authService';

const SESSION_KEY = 'tierx.auth.user-id';

class SecureSessionStore {
  async readUserId(): Promise<number | null> {
    const storedId = await SecureStore.getItemAsync(SESSION_KEY);
    if (!storedId || !/^\d+$/.test(storedId)) return null;
    return Number(storedId);
  }

  async saveUserId(userId: number): Promise<void> {
    await SecureStore.setItemAsync(SESSION_KEY, String(userId));
  }

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
}

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  authService: AuthService;
  signIn: (login: string, password: string) => Promise<void>;
  sendLoginCode: (login: string, password: string) => Promise<{ email: string }>;
  signInWithCode: (login: string, password: string, code: string) => Promise<void>;
  register: (input: { username: string; email: string; password: string; acceptedTerms: boolean }) => ReturnType<AuthService['register']>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const sessionStore = new SecureSessionStore();

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const emailProvider = createResendEmailProvider();
  const [authService] = useState(() => createAuthService(db, sessionStore, emailProvider));
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    authService.restoreSession().then(
      (restoredUser) => {
        if (active) {
          setUser(restoredUser);
          setIsLoading(false);
        }
      },
      () => {
        if (active) {
          setUser(null);
          setIsLoading(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [authService]);

  async function signIn(login: string, password: string): Promise<void> {
    setUser(await authService.signIn(login, password));
  }

  async function sendLoginCode(login: string, password: string): Promise<{ email: string }> {
    return await authService.sendLoginCode(login, password);
  }

  async function signInWithCode(login: string, password: string, code: string): Promise<void> {
    setUser(await authService.signInWithCode(login, password, code));
  }

  async function signOut(): Promise<void> {
    await authService.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, authService, signIn, sendLoginCode, signInWithCode, register: authService.register, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}