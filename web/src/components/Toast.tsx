import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useI18n } from '../i18n';

interface ToastItem {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  push: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const { t } = useI18n();

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (item: Omit<ToastItem, 'id'>) => {
      const id = ++idRef.current;
      setToasts((ts) => [...ts, { ...item, id }]);
      const timeout = item.onAction ? 7000 : 3500;
      window.setTimeout(() => dismiss(id), timeout);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div style={styles.container} role="region" aria-label={t('toast.notifications')}>
        {toasts.map((toast) => (
          <div key={toast.id} style={styles.toast} role="status">
            <span style={styles.message}>{toast.message}</span>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                style={styles.action}
                onClick={() => {
                  toast.onAction?.();
                  dismiss(toast.id);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
            <button
              type="button"
              style={styles.close}
              onClick={() => dismiss(toast.id)}
              aria-label={t('toast.dismissNotification')}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const styles: Record<string, CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: '1.5rem',
    right: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    zIndex: 300,
    maxWidth: 'min(380px, calc(100vw - 2rem))',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.75rem',
    padding: '0.75rem 1rem',
    boxShadow: 'var(--shadow-card)',
    animation: 'toast-in 0.25s ease',
    fontSize: '0.875rem',
  },
  message: {
    flex: 1,
    lineHeight: 1.4,
  },
  action: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-primary)',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '0.8125rem',
    whiteSpace: 'nowrap',
  },
  close: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-dim)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    padding: '0.125rem',
  },
};
