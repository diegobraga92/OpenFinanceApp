/**
 * Push notification → transaction capture for PudimFinance.
 *
 * Android: a native `NotificationListenerService` (see the local
 * `expo-notification-listener` module) observes notifications posted by OTHER
 * apps once the user grants "Notification access". Each notification is parsed
 * with pattern-matched regexes tuned for common Brazilian bank/payment app
 * alerts (Nubank, Itaú, Banco do Brasil, PicPay, Mercado Pago, ...) and turned
 * into a transaction.
 *
 * This works while the app is backgrounded or killed (Android only). iOS cannot
 * observe other apps' notifications due to sandboxing, so capture is disabled
 * there.
 *
 * Settings (enabled, monitored apps, capture mode, default category) are
 * persisted in AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCategories } from '../api';
import {
  addNotificationListener,
  drainPendingNotifications as drainNativePendingNotifications,
  isNotificationAccessEnabled,
  isSupported as nativeCaptureSupported,
  openNotificationAccessSettings as openSystemNotificationAccessSettings,
  type NotificationPayload,
} from '../../modules/notification-listener';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type CaptureMode = 'auto' | 'ask';

export interface NotificationSettings {
  /** Master switch — false means notifications are ignored. */
  enabled: boolean;
  /** Android package names we watch for (empty = all apps). */
  monitoredApps: string[];
  /** `auto` creates transactions silently; `ask` prompts first. */
  mode: CaptureMode;
  /** Default category id used when the parser can't guess one. */
  defaultCategoryId: string | null;
}

const SETTINGS_KEY = 'pudim_notification_settings';

export const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  monitoredApps: [],
  mode: 'ask',
  defaultCategoryId: null,
};

/**
 * Known Brazilian banks/payment apps with their Android package names.
 * The package name is what `NotificationListenerService` reports, so the
 * "monitored apps" filter matches on it.
 *
 * NOTE: package names should be verified on a real device; a wrong value just
 * means that app won't match when the user selects it (watching all still
 * works). Add more apps here as needed.
 */
export const KNOWN_APPS: { label: string; packageName: string | null }[] = [
  { label: 'Nubank', packageName: 'com.nu.production' },
  { label: 'Itaú', packageName: 'com.itau' },
  { label: 'Banco do Brasil', packageName: 'br.com.bb.android' },
  { label: 'Bradesco', packageName: 'br.com.bradesco' },
  { label: 'Caixa', packageName: 'caixa.gov.br.app' },
  { label: 'PicPay', packageName: 'com.picpay' },
  { label: 'Mercado Pago', packageName: 'com.mercadopago.wallet' },
  { label: 'Inter', packageName: 'br.com.intermedium' },
  { label: 'Santander', packageName: 'br.com.santander' },
];

function labelToPackage(label: string): string | null {
  return KNOWN_APPS.find((app) => app.label === label)?.packageName ?? null;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  let settings: NotificationSettings;
  try {
    settings = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<NotificationSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }

  // Migrate legacy settings that stored app *labels* ("Nubank") to the
  // package names the native listener reports.
  let changed = false;
  const monitoredApps = settings.monitoredApps.map((entry) => {
    const pkg = labelToPackage(entry);
    if (pkg && pkg !== entry) {
      changed = true;
      return pkg;
    }
    return entry;
  });
  if (changed) {
    settings = { ...settings, monitoredApps };
    await saveNotificationSettings(settings);
  }
  return settings;
}

export async function saveNotificationSettings(
  settings: NotificationSettings,
): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/** Whether native notification capture is supported on this platform. */
export function isCaptureSupported(): boolean {
  return nativeCaptureSupported;
}

/** Whether the user granted "Notification access" (Android only). */
export function isNotificationAccessGranted(): boolean {
  return isNotificationAccessEnabled();
}

/** Opens the system "Notification access" settings screen (Android only). */
export function openNotificationAccessSettings(): void {
  openSystemNotificationAccessSettings();
}

// ---------------------------------------------------------------------------
// Notification parsing
// ---------------------------------------------------------------------------

export interface ParsedTransaction {
  /** `income` or `expense`. */
  type: 'income' | 'expense';
  /** Decimal string amount, e.g. "49.90". */
  amount: string;
  /** Cleaned-up merchant/payer description. */
  description: string;
  /** ISO date string (YYYY-MM-DD). */
  date: string;
  /** Category id when we could map one, otherwise null. */
  categoryId: string | null;
}

/** Normalizes a Brazilian amount like "R$ 1.234,56" → "1234.56". */
function normalizeAmount(raw: string): string {
  let cleaned = raw.replace(/[^0-9.,]/g, '');
  // If both separators exist, the last one is the decimal separator.
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }
  return cleaned;
}

const EXPENSE_KEYWORDS = [
  'compra', 'aprovada', 'debito', 'débito', 'transferencia enviada',
  'transferência enviada', 'pagamento efetuado', 'pagamento realizado',
  'pix enviado', 'pix realizado', 'saque', 'comprou', 'cobranca',
  'cobrança', 'fatura', 'parcela', 'boleto pago', 'boleto',
  'cartao', 'cartão', 'conta de', 'compras no cart',
];

const INCOME_KEYWORDS = [
  'recebido', 'recebida', 'recebeu', 'credito', 'crédito', 'entrada', 'pix recebido',
  'pagamento recebido', 'transferencia recebida', 'transferência recebida',
  'deposito', 'depósito', 'rendimento', 'estorno', 'reembolso',
];

/** Maps a guessed merchant word to an existing category by fuzzy matching. */
export function guessCategory(
  description: string,
  categories: { id: string; name: string; type: string }[],
): string | null {
  const d = description.toLowerCase();
  const map: [RegExp, string][] = [
    [/supermerc|mercado|extra|carrefour|pao de acucar|pão de açúcar|dia |assai|atacadao/i, 'Food & Groceries'],
    [/restaurante|iFood|ifood|rappi|uber eats|delivery|lanche|pizza|hamburg/i, 'Food & Groceries'],
    [/posto|shell|petrobras|gasolina|combustivel|combustível/i, 'Transportation'],
    [/uber|99taxis|99taxi|transporte|metro|metrô|onibus|ônibus|recarga/i, 'Transportation'],
    [/luz|energia|eletropaulo|enel|agua|água|sabesp|gas|gás|comgas|internet|vivo|claro|tim|telefone/i, 'Utilities'],
    [/netflix|spotify|prime|disney|hbo|deezer|youtube|premium/i, 'Subscriptions'],
    [/farmacia|farmácia|droga|drogasil|drogaraia|pague menos|hospital|medico|médico/i, 'Healthcare'],
    [/aluguel|condominio|condomínio|imovel|imóvel|iptu/i, 'Housing'],
    [/salario|salário|empresa|emprego|holerite|pagamento de sal/i, 'Salary'],
    [/freela|freelance|projeto|consultoria/i, 'Freelance'],
    [/invest|rendimento|cdb|acoes|ações|tesouro|fundo/i, 'Investments'],
    [/amazon|mercadolivre|mercado livre|magazine|casas bahia|shopping|loja/i, 'Shopping'],
  ];
  for (const [re, name] of map) {
    if (re.test(d)) {
      const found = categories.find(
        (c) => c.name.toLowerCase() === name.toLowerCase(),
      );
      if (found) return found.id;
    }
  }
  return null;
}


/**
 * Parses a notification body into a transaction when the format matches a
 * bank/payment alert. Returns null for non-financial notifications.
 */
export function parseNotification(
  body: string,
  categories: { id: string; name: string; type: string }[],
  fallbackCategoryId: string | null,
): ParsedTransaction | null {
  const text = body.trim();
  if (!text) return null;

  // Amount is mandatory for us to consider this a financial alert.
  const amountMatch =
    text.match(/R\$\s*([0-9][0-9.,]*)/i) ||
    text.match(/([0-9][0-9.,]*)\s*(?:reais|real|brl)/i);
  if (!amountMatch) return null;

  const amount = normalizeAmount(amountMatch[1]);
  const numericAmount = parseFloat(amount);
  if (!(numericAmount > 0)) return null;

  const lower = text.toLowerCase();
  const isIncome = INCOME_KEYWORDS.some((k) => lower.includes(k));
  const isExpense = EXPENSE_KEYWORDS.some((k) => lower.includes(k));

  // If neither income nor expense keyword matched, treat R$ amounts with
  // "em" (purchase at X) as expenses, otherwise skip.
  let type: 'income' | 'expense' | null = null;
  if (isIncome && !isExpense) type = 'income';
  else if (isExpense) type = 'expense';
  else if (/\bem\b|\bat\b|compra/i.test(text)) type = 'expense';

  if (!type) return null;

  // Extract a description: take the text after "em"/"de"/"no" and strip noise.
  let description = text;
  const merchantMatch = text.match(
    /\b(?:em|no|na|de|do|da)\s+([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ0-9][A-Za-zÁÉÍÓÚÀÂÊÔÃÕÇ0-9 ]{2,40})/,
  );
  if (merchantMatch) {
    description = merchantMatch[1].trim();
  } else {
    // Fallback: strip the leading alert verb and amount.
    description = text
      .replace(/R\$\s*[0-9][0-9.,]*/i, '')
      .replace(/^[a-záéíóúàâêôãõçü]+ de\s*/i, '')
      .replace(/^[a-záéíóúàâêôãõçü]+\s*/i, '')
      .replace(/[•·:]/g, '')
      .trim();
  }

  // Drop trailing punctuation and "às HH:MM" markers.
  description = description
    .replace(/\s+às?\s+[0-9]{1,2}[:h][0-9]{2}.*$/i, '')
    .replace(/\s+(?:final|cartao|cartão)\s+[0-9*]+.*$/i, '')
    .replace(/^[-–—\s]+/, '')
    .replace(/[.,\s]+$/, '')
    .trim()
    .slice(0, 80);

  // If the description is still a bare verb (e.g. "pago", "realizado"),
  // fall back to a generic label rather than a useless word.
  const USELESS_DESCRIPTIONS =
    /^(pago|paga|realizado|realizada|efetuado|efetuada|aprovado|aprovada|recebido|recebida|recebeu|compra|saque|boleto|fatura)$/i;
  if (description.length <= 3 || USELESS_DESCRIPTIONS.test(description)) {
    description = 'Notificação bancária';
  }

  const categoryId = guessCategory(description, categories) ?? fallbackCategoryId;
  const today = new Date().toISOString().slice(0, 10);

  return {
    type,
    amount,
    description: description || 'Notificação bancária',
    date: today,
    categoryId,
  };
}


// ---------------------------------------------------------------------------
// Pending review inbox (ask mode)
// ---------------------------------------------------------------------------

/** A captured, parsed transaction waiting for the user's confirmation. */
export interface PendingCapture {
  id: string;
  description: string;
  amount: string;
  type: 'income' | 'expense';
  categoryId: string | null;
  date: string;
  /** Android package name of the app that posted the notification. */
  sourcePackage: string;
  /** User-facing label (resolved from KNOWN_APPS, falls back to package). */
  sourceLabel: string;
  postTime: number;
  /** Stable key used to merge/dedupe identical captures. */
  dedupKey: string;
}

const PENDING_KEY = 'pudim_pending_captures';
const MAX_PENDING = 200;

/** Normalizes a description for dedup: lowercase, accents stripped, trimmed. */
function normalizeForDedup(description: string): string {
  return description
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Stable dedup key so the same transaction isn't queued/imported twice. */
export function dedupKeyOf(parsed: ParsedTransaction): string {
  return `${parsed.type}|${parsed.amount}|${normalizeForDedup(parsed.description)}|${parsed.date}`;
}

/** Resolves a package name to its user-facing label for grouping. */
export function sourceLabelOf(packageName: string): string {
  return KNOWN_APPS.find((app) => app.packageName === packageName)?.label ?? packageName;
}

/** Builds a PendingCapture from a parsed transaction + its source notification. */
export function toPendingCapture(
  parsed: ParsedTransaction,
  packageName: string,
  postTime: number,
): PendingCapture {
  return {
    id: `pc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: parsed.description,
    amount: parsed.amount,
    type: parsed.type,
    categoryId: parsed.categoryId,
    date: parsed.date,
    sourcePackage: packageName,
    sourceLabel: sourceLabelOf(packageName),
    postTime,
    dedupKey: dedupKeyOf(parsed),
  };
}

export async function getPendingCaptures(): Promise<PendingCapture[]> {
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PendingCapture[];
  } catch {
    return [];
  }
}

export async function savePendingCaptures(items: PendingCapture[]): Promise<void> {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(items.slice(0, MAX_PENDING)));
}

/**
 * Adds a capture to the inbox, merging an existing entry with the same dedup
 * key (so a re-delivered notification doesn't show up twice). Returns the next
 * inbox contents.
 */
/** Serializes read-modify-write access to the inbox (AsyncStorage is async). */
let inboxWriteChain: Promise<unknown> = Promise.resolve();
function serializeInbox<T>(task: () => Promise<T>): Promise<T> {
  const result = inboxWriteChain.then(task);
  // Keep the chain alive even if this task rejects.
  inboxWriteChain = result.catch(() => undefined);
  return result;
}

export function addPendingCapture(item: PendingCapture): Promise<PendingCapture[]> {
  return serializeInbox(async () => {
    const items = await getPendingCaptures();
    const existingIdx = items.findIndex((c) => c.dedupKey === item.dedupKey);
    const next = [...items];
    if (existingIdx >= 0) {
      next[existingIdx] = {
        ...next[existingIdx],
        postTime: Math.max(next[existingIdx].postTime, item.postTime),
      };
    } else {
      next.push(item);
      if (next.length > MAX_PENDING) next.shift();
    }
    await savePendingCaptures(next);
    return next;
  });
}

export function removePendingCapture(id: string): Promise<PendingCapture[]> {
  return serializeInbox(async () => {
    const items = await getPendingCaptures();
    const next = items.filter((c) => c.id !== id);
    await savePendingCaptures(next);
    return next;
  });
}

// ---------------------------------------------------------------------------
// Notification access + listening
// ---------------------------------------------------------------------------

export type NotificationListener = (parsed: ParsedTransaction, payload: NotificationPayload) => void;

/**
 * Applies settings, monitored-app filtering and parsing to a single raw
 * notification payload, calling `listener` when it results in a valid
 * transaction. Shared by the live subscription and the drain-on-launch path so
 * both behave identically.
 */
export async function handleNotificationPayload(
  payload: NotificationPayload,
  listener: NotificationListener,
): Promise<void> {
  const settings = await getNotificationSettings();
  if (!settings.enabled) return;

  // Filter by monitored apps (package names). Empty = watch all apps.
  if (
    settings.monitoredApps.length > 0 &&
    !settings.monitoredApps.includes(payload.packageName)
  ) {
    return;
  }

  const text = [payload.title, payload.text, payload.bigText, payload.textLines, payload.subText]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (!text) return;

  const categories = await fetchCategories().catch(() => []);
  const parsed = parseNotification(
    text,
    categories,
    settings.defaultCategoryId,
  );
  if (parsed) listener(parsed, payload);
}

/**
 * Subscribes to notifications posted by OTHER apps via the native Android
 * `NotificationListenerService`. Returns an unsubscribe function.
 *
 * The provided listener is only called when capture is enabled AND the
 * notification matches the monitored apps (if any) AND parses to a valid
 * transaction. On platforms without the native module this is a no-op.
 */
export function subscribeToNotifications(
  listener: NotificationListener,
): () => void {
  if (!nativeCaptureSupported) return () => {};

  return addNotificationListener((payload: NotificationPayload) => {
    // Fire-and-forget async work: reading settings + parsing.
    void handleNotificationPayload(payload, listener);
  }).remove;
}

/**
 * Processes notifications that were captured by the native
 * `NotificationListenerService` while the app was killed (persisted to a
 * durable queue because no JS runtime was alive to receive them). Returns the
 * number of raw payloads drained. No-op on platforms without the native module.
 */
export async function drainPendingNotifications(
  listener: NotificationListener,
): Promise<number> {
  if (!nativeCaptureSupported) return 0;
  const pending = drainNativePendingNotifications();
  for (const payload of pending) {
    void handleNotificationPayload(payload, listener);
  }
  return pending.length;
}

