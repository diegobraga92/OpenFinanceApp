import type { CSSProperties } from 'react';
import { useI18n } from '../i18n';
import type { Locale } from '../../../shared/i18n';

const OPTIONS: { value: Locale; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'pt-BR', label: 'PT' },
];

/**
 * Segmented EN / PT control for switching the UI language.
 * Rendered next to the theme toggle in the header.
 */
export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div
      style={styles.group}
      role="group"
      aria-label={t('app.language')}
      title={t('app.language')}
    >
      {OPTIONS.map((opt) => {
        const active = locale === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            style={{ ...styles.button, ...(active ? styles.buttonActive : {}) }}
            aria-pressed={active}
            onClick={() => setLocale(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.125rem',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    padding: '0.125rem',
  },
  button: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-muted)',
    borderRadius: '0.375rem',
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    lineHeight: 1,
  },
  buttonActive: {
    backgroundColor: 'var(--color-surface-hover)',
    color: 'var(--color-text)',
  },
};
