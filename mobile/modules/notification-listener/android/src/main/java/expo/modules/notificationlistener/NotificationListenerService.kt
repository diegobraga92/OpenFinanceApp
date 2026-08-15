package expo.modules.notificationlistener

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Android system service that observes notifications posted by ANY app once the
 * user grants "Notification access" (Settings → Special app access →
 * Notification access). Each posted notification is forwarded to the JS side
 * through [NotificationListenerModule].
 *
 * This runs even while the app is backgrounded or killed, so notifications are
 * captured reliably — not just in the foreground.
 */
class NotificationListenerService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    NotificationListenerHolder.module?.handlePosted(sbn)
  }
}
