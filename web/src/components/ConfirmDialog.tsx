import { useEffect, type CSSProperties } from 'react';
import { useI18n } from '../i18n';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const resolvedConfirm = confirmLabel ?? t('confirm.delete');
  const resolvedCancel = cancelLabel ?? t('confirm.cancel');
  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      style={styles.overlay}
      role="presentation"
      onMouseDown={onCancel}
    >
      <div
        style={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" style={styles.title}>
          {title}
        </h3>
        <p style={styles.message}>{message}</p>
        <div style={styles.actions}>
          <button
            type="button"
            style={styles.cancelButton}
            onClick={onCancel}
            autoFocus
          >
            {resolvedCancel}
          </button>
          <button
            type="button"
            style={styles.confirmButton}
            onClick={onConfirm}
          >
            {resolvedConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'var(--color-overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: '1rem',
  },
  dialog: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '1.5rem',
    maxWidth: 400,
    width: '100%',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-card)',
  },
  title: {
    margin: '0 0 0.5rem 0',
    fontSize: '1.125rem',
    fontWeight: 700,
  },
  message: {
    margin: 0,
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    marginTop: '1.25rem',
  },
  cancelButton: {
    padding: '0.5rem 1.25rem',
    borderRadius: '0.5rem',
    border: '1px solid var(--color-border)',
    background: 'transparent',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  confirmButton: {
    padding: '0.5rem 1.25rem',
    borderRadius: '0.5rem',
    border: 'none',
    backgroundColor: 'var(--color-danger)',
    color: 'var(--color-on-danger)',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
};
