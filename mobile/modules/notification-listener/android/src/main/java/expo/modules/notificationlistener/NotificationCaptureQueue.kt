package expo.modules.notificationlistener

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Durable queue of raw notifications captured while the app process was dead
 * (no JS runtime alive to receive them). The native
 * [NotificationListenerService] writes here when
 * [NotificationListenerHolder.module] is null, and the JS side drains the queue
 * on the next app launch.
 *
 * Bounded to [MAX_ITEMS] so unrelated apps can't grow it without limit.
 */
internal object NotificationCaptureQueue {
  private const val PREFS_NAME = "pudim_notification_queue"
  private const val KEY_ITEMS = "items"
  private const val MAX_ITEMS = 200

  fun enqueue(context: Context, payload: Map<String, Any?>) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val items = read(prefs).toMutableList()
    // Dedup: drop any existing entry for the same posting so a re-delivered
    // notification isn't processed twice.
    val dedupKey = dedupKeyOf(payload)
    items.removeAll { it.optString(KEY_DEDUP) == dedupKey }
    while (items.size >= MAX_ITEMS) items.removeAt(0)
    items.add(JSONObject(payload).put(KEY_DEDUP, dedupKey))
    // commit() (not apply()) so the write is durable even if the OS kills this
    // freshly-restarted process right after delivering the notification.
    prefs.edit().putString(KEY_ITEMS, JSONArray(items).toString()).commit()
  }

  /** Returns and clears all persisted notifications. */
  fun drain(context: Context): List<Map<String, Any?>> {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val items = read(prefs)
    prefs.edit().remove(KEY_ITEMS).apply()
    return items.map { item ->
      mapOf(
        "packageName" to item.optString("packageName"),
        "title" to item.optString("title"),
        "text" to item.optString("text"),
        "bigText" to item.optString("bigText"),
        "subText" to item.optString("subText"),
        "textLines" to item.optString("textLines"),
        "postTime" to item.optLong("postTime"),
      )
    }
  }

  private const val KEY_DEDUP = "_dedupKey"

  private fun dedupKeyOf(payload: Map<String, Any?>): String =
    "${payload["postTime"]}|${payload["packageName"]}|${payload["title"]}"

  private fun read(prefs: SharedPreferences): MutableList<JSONObject> {
    val raw = prefs.getString(KEY_ITEMS, null) ?: return mutableListOf()
    return try {
      val arr = JSONArray(raw)
      (0 until arr.length()).mapTo(mutableListOf()) { arr.getJSONObject(it) }
    } catch (_: Exception) {
      mutableListOf()
    }
  }
}