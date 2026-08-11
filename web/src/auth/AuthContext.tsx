import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchMe, loginUser, registerUser } from '../api';
import {
  AUTH_CHANGED_EVENT,
  clearAuthSession,
  getAccessToken,
  getStoredUser,
  setAuthSession,
  type AuthUser,
} from './tokenStorage';

interface AuthContextValue {
  /** Currently signed-in user, or `null` when signed out. */
  user: AuthUser | null;
  /** Current access token (used by admin-only features such as the audit log). */
  token: string | null;
  /** `true` while an existing session is being validated on startup. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, displayName?: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(getAccessToken()));

  // Validate an existing session on startup: if the access token is stale the
  // request layer refreshes it automatically; a hard failure signs the user out.
  useEffect(() => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      setIsLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const me = await fetchMe(accessToken);
        if (mounted) setUser(me);
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Keep React state in sync with session changes from the API layer
  // (automatic refresh, or a cleared session after refresh failure).
  useEffect(() => {
    const sync = () => {
      setToken(getAccessToken());
      setUser(getStoredUser());
      if (!getAccessToken()) setIsLoading(false);
    };
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, sync);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginUser({ email, password });
    setAuthSession(res.access_token, res.refresh_token, res.user);
    setUser(res.user);
    setToken(res.access_token);
    return res.user;
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const res = await registerUser({
        email,
        password,
        display_name: displayName?.trim() || null,
      });
      setAuthSession(res.access_token, res.refresh_token, res.user);
      setUser(res.user);
      setToken(res.access_token);
      return res.user;
    },
    [],
  );

  const logout = useCallback(() => {
    clearAuthSession();
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, login, register, logout }),
    [user, token, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
