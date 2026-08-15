/**
 * Helpers for the Android home-screen Quick Add widget.
 *
 * The widget itself is fully native (RemoteViews + AppWidgetProvider in the
 * local `expo-android-widget` module); this file holds the shared JS logic for
 * computing/pushing the "spent today" value and the deep-link URIs.
 */

/** Deep-link prefix for opening the Add Transaction form. */
export const ADD_URI_PREFIX = 'pudimfinance://add';

/** Build an ISO date string (YYYY-MM-DD) from a local Date — avoids UTC off-by-one. */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Sum of today's expense transactions — same rule as the in-app Quick Add card. */
export function computeSpentToday(
  transactions: { type: string; amount: string; date: string }[],
): number {
  const today = toIsoDate(new Date());
  return transactions
    .filter((tx) => tx.type === 'expense' && tx.date === today)
    .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
}

/** Format a number as Brazilian Reais, e.g. 1234.56 → "R$ 1.234,56". */
export function formatWidgetMoney(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}
