package expo.modules.notificationlistener

import android.content.Intent
import android.provider.Settings
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

    Function("drainPendingNotifications") {
      drainPendingNotifications()
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

  /** True while the React context is still able to deliver JS events. */
  fun isReactContextReady(): Boolean = appContext.reactContext != null

  /** Called by [NotificationListenerService] for every posted notification. */
  fun handlePosted(payload: Map<String, Any?>) {
    sendEvent("onNotificationPosted", payload)
  }

  /** Returns (and clears) notifications persisted while the app was killed. */
  private fun drainPendingNotifications(): List<Map<String, Any?>> {
    val context = appContext.reactContext
    return if (context == null) emptyList() else NotificationCaptureQueue.drain(context)
  }
}
