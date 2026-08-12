/**
 * Connectivity helper (no imports from api.ts — avoids circular deps).
 */
import NetInfo from '@react-native-community/netinfo';

/** Returns whether the device currently has network connectivity. */
export async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch {
    // If NetInfo fails, assume online and let the request fail naturally.
    return true;
  }
}

/** Generates a v4-like UUID string without a crypto dependency. */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
