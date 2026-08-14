import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { fetchMe } from '../api';
import { clearAuthSession, getAccessToken, type AuthUser } from '../auth';
import { colors, spacing, typography } from '../theme/tokens';
import { LoginScreen } from '../screens/LoginScreen';

interface AuthContextValue {
  user: AuthUser | null;
  logout: () => void;
  /**
   * True when the session was restored from storage on startup (returning
   * user) as opposed to a fresh password login in this session.
   */
  restored: boolean;
}

const AuthUserContext = createContext<AuthContextValue>({
  user: null,
  logout: () => {},
  restored: false,
});

/** Access the signed-in user and logout action from anywhere in the app. */
export function useAuthUser(): AuthContextValue {
  return useContext(AuthUserContext);
}

/**
 * Validates a stored session on startup and renders either the login screen or
 * the app's main content. Exposes the signed-in user so the drawer can show a
 * logout action.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const token = await getAccessToken();
      if (!token) {
        if (mounted) setReady(true);
        return;
      }
      try {
        const me = await fetchMe(token);
        if (mounted) {
          setRestored(true);
          setUser(me);
        }
      } catch {
        // fetchMe already attempted a refresh; a hard failure cleared the session.
        if (mounted) {
          await clearAuthSession();
          setUser(null);
        }
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleAuthenticated = useCallback((next: AuthUser) => {
    setRestored(false);
    setUser(next);
  }, []);

  const handleLogout = useCallback(async () => {
    await clearAuthSession();
    setRestored(false);
    setUser(null);
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (!user) {
    return <LoginScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <AuthUserContext.Provider value={{ user, logout: handleLogout, restored }}>
      {children}
    </AuthUserContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: typography.md,
  },
});
