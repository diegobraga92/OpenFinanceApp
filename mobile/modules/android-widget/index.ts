import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

/**
 * JS bridge for the native Android Quick Add home-screen widget.
 *
 * The widget itself is fully native (AppWidgetProvider + RemoteViews) and
 * reads the "spent today" value from SharedPreferences. This module lets the
 * app push a fresh value whenever transactions change.
 *
 * Android-only.
 */
export const isWidgetSupported: boolean = Platform.OS === 'android';

function native(): any {
  if (!isWidgetSupported) {
    throw new Error('expo-android-widget is only available on Android');
  }
  return requireNativeModule('PudimWidget');
}

/**
 * Push a new "spent today" value to every Quick Add widget instance on the
 * home screen. Silently no-ops when the native module isn't linked.
 */
export function setWidgetSpentToday(value: string): void {
  if (!isWidgetSupported) return;
  try {
    native().setSpentToday(value);
  } catch {
    // Native module not linked (e.g. running from Expo Go or pre-dev-build).
  }
}
