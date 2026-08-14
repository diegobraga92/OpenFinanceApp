import { useState, type CSSProperties, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n';
import { LanguageToggle } from './LanguageToggle';

type Mode = 'login' | 'register';

/**
 * Full-screen login / registration form shown when no valid session exists.
 * Uses the same CSS custom properties as the rest of the app, so it adapts to
 * the active theme automatically.
 */
export function LoginScreen() {
  const { login, register } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, displayName.trim() || undefined);
      }
      // On success the AuthContext updates `user`, and App re-renders into the
      // main dashboard — nothing else to do here.
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.authFailed'));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.langWrap}>
          <LanguageToggle />
        </div>
        <div style={styles.logo} aria-hidden="true">🏦</div>
        <h1 style={styles.title}>PudimFinance</h1>
        <p style={styles.subtitle}>
          {mode === 'login'
            ? t('login.subtitle')
            : t('login.registerSubtitle')}
        </p>

        {error && (
          <div role="alert" style={styles.errorBox}>
            <p style={styles.errorText}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {mode === 'register' && (
            <div style={styles.field}>
              <label htmlFor="pudim-display-name" style={styles.label}>{t('login.displayName')}</label>
              <input
                id="pudim-display-name"
                type="text"
                autoComplete="name"
                style={styles.input}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ada Lovelace"
              />
            </div>
          )}

          <div style={styles.field}>
            <label htmlFor="pudim-email" style={styles.label}>{t('login.email')}</label>
            <input
              id="pudim-email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              style={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="pudim-password" style={styles.label}>{t('login.password')}</label>
            <input
              id="pudim-password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              style={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? t('login.minChars') : '••••••••'}
            />
          </div>

          <button type="submit" style={styles.submit} disabled={busy}>
            {busy ? t('login.pleaseWait') : mode === 'login' ? t('login.signIn') : t('login.createAccount')}
          </button>
        </form>

        <p style={styles.switchText}>
          {mode === 'login' ? (
            <>
              {t('login.noAccount')}{' '}
              <button type="button" style={styles.switchLink} onClick={() => switchMode('register')}>
                {t('login.createOne')}
              </button>
            </>
          ) : (
            <>
              {t('login.hasAccount')}{' '}
              <button type="button" style={styles.switchLink} onClick={() => switchMode('login')}>
                {t('login.signIn')}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}


const styles: Record<string, CSSProperties> = {
  wrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  langWrap: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '0.5rem',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '1rem',
    boxShadow: 'var(--shadow-card)',
    padding: '2rem',
    textAlign: 'center',
  },
  logo: {
    fontSize: '3rem',
    marginBottom: '0.5rem',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 700,
  },
  subtitle: {
    margin: '0.375rem 0 1.5rem',
    color: 'var(--color-text-muted)',
    fontSize: '0.875rem',
  },
  errorBox: {
    backgroundColor: 'var(--color-danger-bg)',
    border: '1px solid var(--color-danger-border)',
    borderRadius: '0.5rem',
    padding: '0.625rem 0.875rem',
    marginBottom: '1rem',
  },
  errorText: {
    margin: 0,
    color: 'var(--color-danger-text)',
    fontSize: '0.8125rem',
    textAlign: 'left',
  },
  field: {
    textAlign: 'left',
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--color-text-muted)',
    marginBottom: '0.375rem',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'var(--color-input-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    padding: '0.625rem 0.875rem',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
  },
  submit: {
    width: '100%',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.75rem 1.25rem',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  switchText: {
    marginTop: '1.25rem',
    marginBottom: 0,
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
  },
  switchLink: {
    background: 'transparent',
    border: 'none',
    padding: 0,
    color: 'var(--color-primary)',
    fontWeight: 600,
    fontSize: 'inherit',
    cursor: 'pointer',
  },
};

