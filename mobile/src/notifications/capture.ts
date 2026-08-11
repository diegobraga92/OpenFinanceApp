/**
 * Push notification → transaction capture for PudimFinance.
 *
 * Watches incoming notifications (foreground via expo-notifications) and parses
 * them with pattern-matched regexes tuned for common Brazilian bank/payment app
 * alerts (Nubank, Itaú, Banco do Brasil, PicPay, Mercado Pago, ...).
 *
 * Settings (enabled, monitored apps, capture mode, default category) are
 * persisted in AsyncStorage.
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCategories } from '../api';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type CaptureMode = 'auto' | 'ask';

export interface NotificationSettings {
  /** Master switch — false means notifications are ignored. */
  enabled: boolean;
  /** App package/titles we watch for (empty = all apps). */
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

export const KNOWN_APPS: { label: string; keywords: string[] }[] = [
  { label: 'Nubank', keywords: ['nubank', 'roxinho', 'nuconta'] },
  { label: 'Itaú', keywords: ['itau', 'itaú'] },
  { label: 'Banco do Brasil', keywords: ['banco do brasil', 'bb'] },
  { label: 'Bradesco', keywords: ['bradesco'] },
  { label: 'Caixa', keywords: ['caixa', 'caixa econ'] },
  { label: 'PicPay', keywords: ['picpay'] },
  { label: 'Mercado Pago', keywords: ['mercado pago'] },
  { label: 'PIX', keywords: ['pix', 'pix copia e cola', 'pix recebido', 'pix enviado'] },
];

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<NotificationSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveNotificationSettings(
  settings: NotificationSettings,
): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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
// Permissions + listening
// ---------------------------------------------------------------------------

let configured = false;

export async function configureNotifications(): Promise<boolean> {
  if (configured) return true;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  const settings = await Notifications.getPermissionsAsync();
  if (settings.status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  }
  return true;
}

export type NotificationListener = (parsed: ParsedTransaction) => void;

/**
 * Subscribes to foreground notifications. Returns an unsubscribe function.
 * The provided listener is only called when capture is enabled AND the
 * notification body parses to a valid transaction.
 */
export function subscribeToNotifications(
  listener: NotificationListener,
): () => void {
  return Notifications.addNotificationReceivedListener((notification) => {
    // Fire-and-forget async work: reading settings + parsing.
    void (async () => {
      const settings = await getNotificationSettings();
      if (!settings.enabled) return;

      const body = notification.request.content.body ?? '';
      const title = notification.request.content.title ?? '';
      if (!body && !title) return;

      const categories = await fetchCategories().catch(() => []);
      const parsed = parseNotification(
        `${title} ${body}`,
        categories,
        settings.defaultCategoryId,
      );
      if (parsed) listener(parsed);
    })();
  }).remove;
}

export { Notifications };

