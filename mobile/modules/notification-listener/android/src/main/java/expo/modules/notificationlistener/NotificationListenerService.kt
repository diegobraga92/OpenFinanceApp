package expo.modules.notificationlistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Android system service that observes notifications posted by ANY app once the
 * user grants "Notification access" (Settings → Special app access →
 * Notification access).
 *
 * While the app process is alive, each notification is forwarded to the JS side
 * through [NotificationListenerModule]. If the app was killed, the JS module
 * doesn't exist yet, so the raw notification is persisted in a durable queue
 * ([NotificationCaptureQueue]) and processed on the next app launch.
 */
class NotificationListenerService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val payload = extractPayload(sbn) ?: return
    val module = NotificationListenerHolder.module
    if (module != null && module.isReactContextReady()) {
      module.handlePosted(payload)
    } else {
      // The JS runtime isn't alive (app killed / cold-starting). Persist the
      // notification so the next launch can drain and process it.
      NotificationCaptureQueue.enqueue(applicationContext, payload)
    }
  }
}

/** Extracts the fields the JS side consumes from a posted notification. */
internal fun extractPayload(sbn: StatusBarNotification): Map<String, Any?>? {
  val notification = sbn.notification ?: return null
  val extras = notification.extras ?: return null
  val textLines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
    ?.joinToString("\n") { it?.toString() ?: "" }
  return mapOf(
    "packageName" to sbn.packageName,
    "title" to (extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""),
    "text" to (extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""),
    "bigText" to (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: ""),
    "subText" to (extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString() ?: ""),
    "textLines" to (textLines ?: ""),
    "postTime" to sbn.postTime,
  )
}
