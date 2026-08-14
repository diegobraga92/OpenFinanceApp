import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  toIntlLocale,
  translate,
  type Locale,
  type TranslationKey,
} from '../../../shared/i18n';

const STORAGE_KEY = 'pudim_lang';

export interface I18nContextValue {
  /** Current UI locale. */
  locale: Locale;
  /** Switch the UI language (persisted to AsyncStorage). */
  setLocale: (locale: Locale) => void;
  /** Translate a key, optionally interpolating `{param}` tokens. */
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  /** Format a number as BRL currency using the active locale. */
  formatMoney: (value: string | number) => string;
  /** Format a YYYY-MM-DD date for the active locale. */
  formatDate: (isoDate: string) => string;
  /** Format a full ISO timestamp for the active locale. */
  formatDateTime: (iso: string) => string;
  /** Full month names (January… / janeiro…) for the active locale. */
  monthNames: string[];
  /** Short month names (Jan… / jan…) for the active locale. */
  shortMonthNames: string[];
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

/** Best-effort device-language detection without expo-localization. */
function detectSystemLocale(): Locale {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().locale || '';
    return resolved.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
  } catch {
    return 'en';
  }
}

function buildMonthNames(locale: Locale, short: boolean): string[] {
  const intl = toIntlLocale(locale);
  return Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1, 12).toLocaleDateString(intl, {
      month: short ? 'short' : 'long',
    }),
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [ready, setReady] = useState(false);

  // Load the persisted language (fall back to the device locale) before
  // rendering children so the whole tree starts in the right language.
  useEffect(() => {
    let mounted = true;
    (async () => {
      let next: Locale = detectSystemLocale();
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'en' || stored === 'pt-BR') next = stored;
      } catch {
        // Ignore storage failures; fall back to detection.
      }
      if (mounted) {
        setLocaleState(next);
        setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const intl = toIntlLocale(locale);
    return {
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
      formatMoney: (value) => {
        const n = typeof value === 'string' ? parseFloat(value) : value;
        return (Number.isFinite(n) ? n : 0).toLocaleString(intl, {
          style: 'currency',
          currency: 'BRL',
        });
      },
      formatDate: (isoDate) => {
        const d = new Date(`${isoDate}T00:00:00`);
        return Number.isNaN(d.getTime()) ? isoDate : d.toLocaleDateString(intl);
      },
      formatDateTime: (iso) => {
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(intl);
      },
      monthNames: buildMonthNames(locale, false),
      shortMonthNames: buildMonthNames(locale, true),
    };
  }, [locale, setLocale]);

  if (!ready) return null;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}
