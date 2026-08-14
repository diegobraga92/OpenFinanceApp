import { useState, type CSSProperties } from 'react';
import type { Category, Transaction } from '../api';
import { deleteTransaction } from '../api';
import { ConfirmDialog } from './ConfirmDialog';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useI18n } from '../i18n';

interface Props {
  transactions: Transaction[];
  categories: Category[];
  formatMoney: (value: string) => string;
  onEdit: (transaction: Transaction) => void;
  onDelete: (deleted: Transaction) => void;
}

export function TransactionTable({ transactions, categories, formatMoney, onEdit, onDelete }: Props) {
  const { t, formatDate } = useI18n();
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const handleDelete = async (deleted: Transaction) => {
    setDeleting(true);
    try {
      await deleteTransaction(deleted.id);
      setPendingDelete(null);
      onDelete(deleted);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t('transactions.failedToDelete'));
    } finally {
      setDeleting(false);
    }
  };

  const deleteDialog = (
    <ConfirmDialog
      open={pendingDelete !== null}
      title={t('transactions.deleteTitle')}
      message={
        pendingDelete
          ? t('transactions.deleteMessage', {
              description: pendingDelete.description,
              amount: formatMoney(pendingDelete.amount),
            })
          : ''
      }
      confirmLabel={deleting ? t('common.deleting') : t('common.delete')}
      onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
      onCancel={() => !deleting && setPendingDelete(null)}
    />
  );

  if (isMobile) {
    return (
      <div style={styles.cardList}>
        {transactions.map((tx) => {
          const cat = tx.category_id ? categoryById.get(tx.category_id) : undefined;
          const isIncome = tx.type === 'income';
          return (
            <div key={tx.id} className="card" style={styles.card}>
              <div style={styles.cardTop}>
                <span style={styles.cardDate}>{formatDate(tx.date)}</span>
                <span
                  style={{
                    ...styles.cardAmount,
                    color: isIncome ? 'var(--color-income)' : 'var(--color-expense)',
                  }}
                >
                  {isIncome ? '+' : '-'}{formatMoney(tx.amount)}
                </span>
              </div>
              <div style={styles.cardDescription}>{tx.description}</div>
              {tx.installment_plan_id && (
                <span style={styles.installmentBadge}>{t('transactions.installment')}</span>
              )}
              <div style={styles.cardBottom}>
                {cat ? (
                  <span style={styles.badge}>
                    {cat.icon && <span style={styles.icon}>{cat.icon}</span>}
                    {cat.name}
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-text-dim)' }}>—</span>
                )}
                <div style={styles.cardActions}>
                  <button style={styles.actionButton} onClick={() => onEdit(tx)}>{t('transactions.edit')}</button>
                  <button style={styles.deleteButton} onClick={() => setPendingDelete(tx)}>{t('common.delete')}</button>
                </div>
              </div>
            </div>
          );
        })}
        {deleteDialog}
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>{t('transactions.table.date')}</th>
            <th style={styles.th}>{t('transactions.table.description')}</th>
            <th style={styles.th}>{t('transactions.table.category')}</th>
            <th style={styles.th} align="right">{t('transactions.table.amount')}</th>
            <th style={styles.th} align="right">{t('transactions.table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const cat = tx.category_id ? categoryById.get(tx.category_id) : undefined;
            const isIncome = tx.type === 'income';
            return (
              <tr key={tx.id} style={styles.tr}>
                <td style={styles.td}>{formatDate(tx.date)}</td>
                <td style={styles.td}>
                  <div style={styles.descCell}>
                    {tx.description}
                    {tx.installment_plan_id && (
                      <span style={styles.installmentBadge}>{t('transactions.installment')}</span>
                    )}
                  </div>
                </td>
                <td style={styles.td}>
                  {cat ? (
                    <span style={styles.badge}>
                      {cat.icon && <span style={styles.icon}>{cat.icon}</span>}
                      {cat.name}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-text-dim)' }}>—</span>
                  )}
                </td>
                <td style={{ ...styles.td, ...styles.amount, color: isIncome ? 'var(--color-income)' : 'var(--color-expense)' }}>
                  {isIncome ? '+' : '-'}{formatMoney(tx.amount)}
                </td>
                <td style={styles.td} align="right">
                  <button style={styles.actionButton} onClick={() => onEdit(tx)}>{t('transactions.edit')}</button>
                  <button style={styles.deleteButton} onClick={() => setPendingDelete(tx)}>{t('common.delete')}</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {deleteDialog}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    overflowX: 'auto',
  },
  cardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  card: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.75rem',
    padding: '0.875rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    boxShadow: 'var(--shadow-card)',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardDate: {
    color: 'var(--color-text-muted)',
    fontSize: '0.8125rem',
  },
  cardAmount: {
    fontWeight: 700,
    fontSize: '1rem',
    fontVariantNumeric: 'tabular-nums',
  },
  cardDescription: {
    color: 'var(--color-text)',
    fontSize: '0.9375rem',
    fontWeight: 500,
  },
  installmentBadge: {
    backgroundColor: 'var(--color-warning-bg, rgba(245, 158, 11, 0.15))',
    border: '1px solid var(--color-warning-border, rgba(245, 158, 11, 0.4))',
    color: 'var(--color-warning-text)',
    fontSize: '0.625rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    padding: '0.125rem 0.375rem',
    borderRadius: '0.25rem',
    marginLeft: '0.375rem',
    whiteSpace: 'nowrap',
  },
  descCell: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  cardBottom: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.625rem 0.75rem',
    color: 'var(--color-text-muted)',
    fontWeight: 500,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--color-border)',
  },
  tr: {
    borderBottom: '1px solid var(--color-surface)',
  },
  td: {
    padding: '0.625rem 0.75rem',
    color: 'var(--color-text)',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.125rem 0.5rem',
    borderRadius: '0.375rem',
    backgroundColor: 'var(--color-border)',
    fontSize: '0.75rem',
  },
  icon: {
    fontSize: '0.875rem',
  },
  amount: {
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  actionButton: {
    background: 'transparent',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)',
    padding: '0.25rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
    marginRight: '0.5rem',
  },
  deleteButton: {
    background: 'transparent',
    border: '1px solid var(--color-danger-border)',
    color: 'var(--color-danger)',
    padding: '0.25rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
};