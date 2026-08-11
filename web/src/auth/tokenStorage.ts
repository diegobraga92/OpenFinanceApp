/**
 * Auth session persistence for the web app.
 *
 * Tokens are kept in `localStorage` so a page refresh keeps the user signed in.
 * The API layer (`src/api.ts`) reads/writes these keys directly, and the
 * `AuthContext` subscribes to `AUTH_CHANGED_EVENT` to stay in sync when the
 * API layer refreshes or clears a session (e.g. expired refresh token).
 */

export const TOKEN_KEY = 'pudim_token';
export const REFRESH_TOKEN_KEY = 'pudim_refresh_token';
export const USER_KEY = 'pudim_user';

/** Custom event dispatched whenever the session changes outside of React state. */
export const AUTH_CHANGED_EVENT = 'pudim:auth-changed';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuthSession(accessToken: string, refreshToken: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Notifies the AuthContext that the session changed (refresh or expiry). */
export function notifyAuthChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
  }
}
