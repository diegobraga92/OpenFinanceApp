import type { CSSProperties } from 'react';
import type { Category, Transaction } from '../api';
import { deleteTransaction } from '../api';

interface Props {
  transactions: Transaction[];
  categories: Category[];
  formatMoney: (value: string) => string;
  onEdit: (transaction: Transaction) => void;
  onDelete: () => void;
}

export function TransactionTable({ transactions, categories, formatMoney, onEdit, onDelete }: Props) {
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await deleteTransaction(id);
      onDelete();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete');
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
                    <span style={{ color: '#64748b' }}>—</span>
                  )}
                </td>
                <td style={{ ...styles.td, ...styles.amount, color: isIncome ? '#22c55e' : '#ef4444' }}>
                  {isIncome ? '+' : '-'}{formatMoney(t.amount)}
                </td>
                <td style={styles.td} align="right">
                  <button style={styles.actionButton} onClick={() => onEdit(t)}>Edit</button>
                  <button style={styles.deleteButton} onClick={() => handleDelete(t.id)}>Delete</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
    color: '#94a3b8',
    fontWeight: 500,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #334155',
  },
  tr: {
    borderBottom: '1px solid #1e293b',
  },
  td: {
    padding: '0.625rem 0.75rem',
    color: '#e2e8f0',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.125rem 0.5rem',
    borderRadius: '0.375rem',
    backgroundColor: '#334155',
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
    border: '1px solid #334155',
    color: '#94a3b8',
    padding: '0.25rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
    marginRight: '0.5rem',
  },
  deleteButton: {
    background: 'transparent',
    border: '1px solid #991b1b',
    color: '#ef4444',
    padding: '0.25rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
};