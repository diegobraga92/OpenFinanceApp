import type { CSSProperties, ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({
  icon = '🗂️',
  title,
  description,
  actionLabel,
  onAction,
  compact,
}: Props) {
  return (
    <div style={compact ? styles.wrapperCompact : styles.wrapper}>
      <div style={styles.icon} aria-hidden="true">
        {icon}
      </div>
      <h4 style={styles.title}>{title}</h4>
      {description && <p style={styles.description}>{description}</p>}
      {actionLabel && onAction && (
        <button type="button" style={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '3rem 1rem',
    gap: '0.5rem',
  },
  wrapperCompact: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '1.5rem 1rem',
    gap: '0.5rem',
  },
  icon: {
    fontSize: '2.25rem',
    marginBottom: '0.25rem',
    opacity: 0.85,
  },
  title: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--color-text)',
  },
  description: {
    margin: 0,
    maxWidth: 360,
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
    lineHeight: 1.5,
  },
  action: {
    marginTop: '0.5rem',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    border: 'none',
    padding: '0.5rem 1.25rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
