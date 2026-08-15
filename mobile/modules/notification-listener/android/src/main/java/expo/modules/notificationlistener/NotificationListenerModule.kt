package expo.modules.notificationlistener

import android.app.Notification
import android.content.Intent
import android.provider.Settings
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Bridge that lets the [NotificationListenerService] reach the JS side.
 * The service runs in the app process and forwards posted notifications here.
 */
object NotificationListenerHolder {
  @Volatile
  var module: NotificationListenerModule? = null
}

class NotificationListenerModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("ExpoNotificationListener")

    Events("onNotificationPosted")

    OnCreate {
      NotificationListenerHolder.module = this@NotificationListenerModule
    }

    Function("isEnabled") {
      isNotificationAccessGranted()
    }

    AsyncFunction("openSettings") {
      openNotificationAccessSettings()
    }
  }

  private fun isNotificationAccessGranted(): Boolean {
    val context = appContext.reactContext ?: return false
    return NotificationManagerCompat.getEnabledListenerPackages(context)
      .contains(context.packageName)
  }

  private fun openNotificationAccessSettings() {
    val context = appContext.reactContext ?: return
    val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(intent)
  }

  /** Called by [NotificationListenerService] for every posted notification. */
  fun handlePosted(sbn: StatusBarNotification) {
    val notification = sbn.notification ?: return
    val extras = notification.extras ?: return
    val payload = mapOf(
      "packageName" to sbn.packageName,
      "title" to (extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""),
      "text" to (extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""),
      "bigText" to (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: ""),
      "postTime" to sbn.postTime,
    )
    sendEvent("onNotificationPosted", payload)
  }
}
