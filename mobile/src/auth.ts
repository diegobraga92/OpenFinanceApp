/**
 * Auth session persistence for the React Native app.
 *
 * Tokens are kept in AsyncStorage so relaunching the app keeps the user signed
 * in. The API layer (`src/api.ts`) reads/writes these keys directly, and the
 * `AuthGate` screen subscribes to the session to know when to show login.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'pudim_token';
const REFRESH_TOKEN_KEY = 'pudim_refresh_token';
const USER_KEY = 'pudim_user';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function setAuthSession(
  accessToken: string,
  refreshToken: string,
  user: AuthUser,
): Promise<void> {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
    [USER_KEY, JSON.stringify(user)],
  ]);
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
}
