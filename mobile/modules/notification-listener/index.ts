import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

/**
 * A push notification posted by any app, as observed by the native Android
 * `NotificationListenerService` (requires the user to grant "Notification
 * access" in system settings).
 *
 * This module is Android-only: iOS sandboxing makes it impossible for an app
 * to observe notifications destined for other apps.
 */
export type NotificationPayload = {
  /** Android application id of the app that posted the notification. */
  packageName: string;
  /** Notification title (usually the bank/app name). */
  title: string;
  /** Notification body. */
  text: string;
  /** Expanded/rich body (often contains the parsed transaction line). */
  bigText: string;
  /** Small additional line (rarely used; may hold the amount). */
  subText?: string;
  /** Multi-line body (some apps only populate `EXTRA_TEXT_LINES`). */
  textLines?: string;
  /** Posting timestamp (epoch millis). */
  postTime: number;
};

export type NotificationListenerSubscription = {
  remove: () => void;
};

/** The native module only exists on Android. */
export const isSupported: boolean = Platform.OS === 'android';

function native(): any {
  if (!isSupported) {
    throw new Error('expo-notification-listener is only available on Android');
  }
  return requireNativeModule('ExpoNotificationListener');
}

/** True when the user granted "Notification access" to this app. */
export function isNotificationAccessEnabled(): boolean {
  if (!isSupported) return false;
  return native().isEnabled();
}

/** Opens the system "Notification access" settings screen. */
export function openNotificationAccessSettings(): void {
  if (!isSupported) return;
  void native().openSettings();
}

/**
 * Subscribe to notifications posted by other apps.
 * Returns an unsubscribe handle (remove()).
 */
export function addNotificationListener(
  listener: (payload: NotificationPayload) => void,
): NotificationListenerSubscription {
  return native().addListener('onNotificationPosted', listener);
}

/**
 * Returns (and clears) notifications that were captured by the native
 * `NotificationListenerService` while the app process was killed. Because no JS
 * runtime was alive at capture time, the service persisted them to a durable
 * queue; the app drains it on launch.
 */
export function drainPendingNotifications(): NotificationPayload[] {
  if (!isSupported) return [];
  return native().drainPendingNotifications();
}
