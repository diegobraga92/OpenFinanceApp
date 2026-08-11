/**
 * Server configuration for PudimFinance mobile.
 *
 * The backend URL can be configured directly in the app (Settings → Server)
 * instead of being baked into the binary. The value is persisted in
 * AsyncStorage and cached in memory so the API layer can read it synchronously
 * after the first load.
 *
 * Priority: user-configured URL (AsyncStorage) → EXPO_PUBLIC_API_BASE_URL env
 * → http://localhost:3000 (emulator default).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL_KEY = 'pudim_server_url';

let cached: string | null = null;

/** Default from the environment, or localhost for emulator/dev builds. */
export function getDefaultServerUrl(): string {
  return process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
}

/** Normalizes a user-entered server address. Returns '' for blank input. */
export function normalizeServerUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return '';
  // Strip trailing slashes (http://host:3000/ → http://host:3000)
  url = url.replace(/\/+$/, '');
  // Add protocol if missing (192.168.1.100:3000 → http://192.168.1.100:3000)
  if (!/^https?:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  return url;
}

/**
 * Returns the current API base URL. The first call reads AsyncStorage; later
 * calls use the in-memory cache. Never throws — falls back to the default.
 */
export async function getApiBaseUrl(): Promise<string> {
  if (cached) return cached;
  try {
    const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
    const normalized = stored ? normalizeServerUrl(stored) : '';
    cached = normalized || getDefaultServerUrl();
  } catch {
    cached = getDefaultServerUrl();
  }
  return cached;
}

/**
 * Persists a new server URL and updates the in-memory cache so subsequent API
 * calls immediately use it. Returns the normalized value.
 */
export async function setApiBaseUrl(raw: string): Promise<string> {
  const normalized = normalizeServerUrl(raw);
  if (!normalized) {
    throw new Error('Server address cannot be empty');
  }
  await AsyncStorage.setItem(SERVER_URL_KEY, normalized);
  cached = normalized;
  return normalized;
}

/** Pings the backend /health endpoint to verify a server address works. */
export async function testServerConnection(raw: string): Promise<boolean> {
  const url = normalizeServerUrl(raw);
  if (!url) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}
