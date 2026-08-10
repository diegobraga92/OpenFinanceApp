import { useState, type CSSProperties } from 'react';
import type { Category, Transaction } from '../api';
import { deleteTransaction } from '../api';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  transactions: Transaction[];
  categories: Category[];
  formatMoney: (value: string) => string;
  onEdit: (transaction: Transaction) => void;
  onDelete: () => void;
}

export function TransactionTable({ transactions, categories, formatMoney, onEdit, onDelete }: Props) {
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteTransaction(id);
      setPendingDelete(null);
      onDelete();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  };

  return (
    <div style={styles.wrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Date</th>
            <th style={styles.th}>Description</th>
            <th style={styles.th}>Category</th>
            <th style={styles.th} align="right">Amount</th>
            <th style={styles.th} align="right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => {
            const cat = t.category_id ? categoryById.get(t.category_id) : undefined;
            const isIncome = t.type === 'income';
            return (
              <tr key={t.id} style={styles.tr}>
                <td style={styles.td}>{formatDate(t.date)}</td>
                <td style={styles.td}>{t.description}</td>
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
                  {isIncome ? '+' : '-'}{formatMoney(t.amount)}
                </td>
                <td style={styles.td} align="right">
                  <button style={styles.actionButton} onClick={() => onEdit(t)}>Edit</button>
                  <button style={styles.deleteButton} onClick={() => setPendingDelete(t)}>Delete</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete transaction?"
        message={
          pendingDelete
            ? `"${pendingDelete.description}" (${formatMoney(pendingDelete.amount)}) will be permanently removed. This action cannot be undone.`
            : ''
        }
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={() => pendingDelete && handleDelete(pendingDelete.id)}
        onCancel={() => !deleting && setPendingDelete(null)}
      />
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    overflowX: 'auto',
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