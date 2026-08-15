package expo.modules.androidwidget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WidgetModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("PudimWidget")

    // Stores a fresh "spent today" value and re-renders the home-screen widget.
    Function("setSpentToday") { value: String ->
      val context = appContext.reactContext ?: return@Function
      context
        .getSharedPreferences("pudim_widget_prefs", android.content.Context.MODE_PRIVATE)
        .edit()
        .putString("spent_today", value)
        .apply()
      QuickAddWidgetProvider.updateAll(context)
    }
  }
}
