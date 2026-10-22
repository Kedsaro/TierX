import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { createAuthService } from './authService';
import type { AuthenticatedUser, AuthService } from './authService';

const SESSION_KEY = 'tierx.auth.user-id';

// Reading from SecureStore immediately after a cold app start can
// intermittently return null even when a session was previously saved: the
// Android Keystore-backed cipher it relies on is not always ready yet right
// after process start. A null result is indistinguishable from "no session",
// so retry a couple of times with a short backoff before concluding there is
// none; a real logged-out user only pays a small, bounded extra delay.
async function readSessionIdWithRetry(): Promise<string | null> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const storedId = await SecureStore.getItemAsync(SESSION_KEY);
    if (storedId) return storedId;
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 150));
  }
  return null;
}

class SecureSessionStore {
  async readUserId(): Promise<number | null> {
    const storedId = await readSessionIdWithRetry();
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
  register: (input: { username: string; email: string; password: string; acceptedTerms: boolean }) => ReturnType<AuthService['register']>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const sessionStore = new SecureSessionStore();

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [authService] = useState(() => createAuthService(db, sessionStore));
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


  async function signOut(): Promise<void> {
    await authService.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, authService, signIn, register: authService.register, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}