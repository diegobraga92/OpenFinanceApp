import { setWidgetSpentToday } from '../../modules/android-widget';

export { ADD_URI_PREFIX, computeSpentToday, formatWidgetMoney } from './quickAddWidget';

/**
 * Pushes a fresh "spent today" value to every Quick Add widget instance on the
 * home screen. Call after data loads or any transaction mutation.
 *
 * Silently no-ops when the native widget module isn't linked (iOS/web/Expo Go).
 */
export function updateQuickAddWidget(spentToday: string): void {
  setWidgetSpentToday(spentToday);
}

