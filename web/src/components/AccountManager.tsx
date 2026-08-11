import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import type { AccountWithBalance } from '../api';
import { createAccount, deleteAccount, updateAccount } from '../api';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';

interface Props {
  accounts: AccountWithBalance[];
  onAccountsChanged: () => Promise<AccountWithBalance[]>;
}

type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

const ACCOUNT_TYPES: { key: AccountType; label: string; icon: string; blurb: string }[] = [
  { key: 'asset', label: 'Assets', icon: '💰', blurb: 'Cash, bank accounts and savings' },
  { key: 'liability', label: 'Liabilities & Credit Cards', icon: '💳', blurb: 'Credit cards, loans and debts' },
  { key: 'equity', label: 'Equity', icon: '🏛️', blurb: 'Net worth and capital' },
  { key: 'income', label: 'Income', icon: '📥', blurb: 'Salary and earnings sources' },
  { key: 'expense', label: 'Expense', icon: '📤', blurb: 'Spending categories' },
];

interface FormState {
  name: string;
  type: AccountType;
}

const EMPTY_FORM: FormState = { name: '', type: 'asset' };

export function AccountManager({ accounts, onAccountsChanged }: Props) {
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<AccountWithBalance | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push: pushToast } = useToast();

  // Close the modal on Escape for keyboard users.
  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowForm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm]);

  const openCreate = (type: AccountType) => {
    setEditingId(null);
    setForm({ name: '', type });
    setError(null);
    setShowForm(true);
  };

  const openEdit = (a: AccountWithBalance) => {
    setEditingId(a.id);
    setForm({ name: a.name, type: a.type as AccountType });
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = { name, type: form.type };
    try {
      if (editingId) {
        await updateAccount(editingId, payload);
        pushToast({ message: `Account "${name}" updated` });
      } else {
        await createAccount(payload);
        pushToast({ message: `Account "${name}" created` });
      }
      setShowForm(false);
      await onAccountsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteAccount(deleting.id);
      pushToast({ message: `Account "${deleting.name}" deleted` });
      setDeleting(null);
      await onAccountsChanged();
    } catch (err) {
      setDeleting(null);
      pushToast({
        message: err instanceof Error ? err.message : 'Failed to delete account',
      });
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) => a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q),
    );
  }, [query, accounts]);

  const formatBalance = (a: AccountWithBalance) => {
    const n = Math.abs(parseFloat(a.balance));
    return n.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const renderAccountCard = (a: AccountWithBalance) => {
    const isDebt = a.type === 'liability';
    const isIncomeOrExpense = a.type === 'income' || a.type === 'expense';
    return (
      <div key={a.id} style={styles.card}>
        <div
          style={{
            ...styles.accountIcon,
            backgroundColor: isDebt
              ? 'rgba(239, 68, 68, 0.15)'
              : isIncomeOrExpense
                ? 'rgba(34, 197, 94, 0.12)'
                : 'rgba(59, 130, 246, 0.12)',
          }}
          aria-hidden="true"
        >
          {isDebt ? '💳' : isIncomeOrExpense ? '📊' : '🏦'}
        </div>
        <div style={styles.cardInfo}>
          <p style={styles.cardName}>{a.name}</p>
          <p style={styles.cardMeta}>
            {a.transaction_count} ledger entr{a.transaction_count === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <div style={styles.balanceWrap}>
          <span style={isDebt ? styles.balanceDebt : styles.balanceNormal}>
            {formatBalance(a)}
          </span>
        </div>
        <div style={styles.cardActions}>
          <button
            type="button"
            style={styles.iconAction}
            onClick={() => openEdit(a)}
            aria-label={`Edit ${a.name}`}
            title="Edit"
          >
            ✏️
          </button>
          <button
            type="button"
            style={styles.iconActionDanger}
            onClick={() => setDeleting(a)}
            aria-label={`Delete ${a.name}`}
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>
    );
  };

  const renderGroup = (group: (typeof ACCOUNT_TYPES)[number]) => {
    const items = visible.filter((a) => a.type === group.key);
    return (
      <div key={group.key} style={styles.group}>
        <div style={styles.groupHeader}>
          <span style={styles.groupIcon} aria-hidden="true">
            {group.icon}
          </span>
          <div style={styles.groupHeaderText}>
            <h4 style={styles.groupTitle}>{group.label}</h4>
            <p style={styles.groupBlurb}>{group.blurb}</p>
          </div>
          <span style={styles.groupBadge}>{items.length}</span>
          <button
            type="button"
            style={styles.groupAdd}
            onClick={() => openCreate(group.key)}
            aria-label={`Add ${group.label}`}
            title="Add account"
          >
            +
          </button>
        </div>
        {items.length > 0 ? (
          <div style={styles.list}>{items.map(renderAccountCard)}</div>
        ) : (
          <p style={styles.groupEmpty}>No {group.label.toLowerCase()} yet.</p>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>Accounts</h2>
        <button type="button" style={styles.primaryButton} onClick={() => openCreate('asset')}>
          + New Account
        </button>
      </div>

      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <input
            style={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search accounts…"
            aria-label="Search accounts"
          />
          {query && (
            <button
              type="button"
              style={styles.searchClear}
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon="🏦"
          title="No accounts yet"
          description="Create your first account — a checking account, credit card or savings — to start tracking balances."
          actionLabel="+ New Account"
          onAction={() => openCreate('asset')}
        />
      ) : (
        <div style={styles.summaryBar}>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>💰 Total assets</span>
            <span style={styles.summaryValue}>
              {accounts
                .filter((a) => a.type === 'asset')
                .reduce((sum, a) => sum + parseFloat(a.balance), 0)
                .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>💳 Total debt</span>
            <span style={{ ...styles.summaryValue, ...styles.summaryDebt }}>
              {accounts
                .filter((a) => a.type === 'liability')
                .reduce((sum, a) => sum + Math.abs(parseFloat(a.balance)), 0)
                .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>
      )}

      {accounts.length > 0 && (
        <div style={styles.groups}>{ACCOUNT_TYPES.map(renderGroup)}</div>
      )}


      {showForm && (
        <div
          style={styles.overlay}
          role="presentation"
          onMouseDown={() => setShowForm(false)}
        >
          <div
            style={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-form-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 id="account-form-title" style={styles.modalTitle}>
                {editingId ? 'Edit Account' : 'New Account'}
              </h3>
              <button
                type="button"
                style={styles.modalClose}
                onClick={() => setShowForm(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {error && (
              <div style={styles.error}>
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.label}>
                Name
                <input
                  style={styles.input}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Nubank Credit Card"
                  required
                  autoFocus
                />
              </label>

              <label style={styles.label}>
                Type
                <div style={styles.typeGrid}>
                  {ACCOUNT_TYPES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      style={
                        form.type === t.key ? styles.typeButtonActive : styles.typeButton
                      }
                      onClick={() => setForm((f) => ({ ...f, type: t.key }))}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </label>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.cancelButton}
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.submitButton} disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete "${deleting?.name}"?`}
        message="This will permanently remove the account. It can only be deleted if no ledger entries or sub-accounts reference it."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}


const styles: Record<string, CSSProperties> = {
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
  },
  pageTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
  },
  toolbar: {
    marginBottom: '1.5rem',
  },
  summaryBar: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  summaryItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    backgroundColor: 'var(--color-surface)',
    borderRadius: '0.75rem',
    padding: '0.875rem 1.125rem',
    border: '1px solid var(--color-border)',
  },
  summaryLabel: {
    fontSize: '0.75rem',
    color: 'var(--color-text-dim)',
  },
  summaryValue: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  summaryDebt: {
    color: 'var(--color-danger-text)',
  },
  searchWrap: {
    position: 'relative',
  },
  searchInput: {
    backgroundColor: 'var(--color-input-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    padding: '0.625rem 2rem 0.625rem 0.875rem',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  searchClear: {
    position: 'absolute',
    right: '0.375rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-dim)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    padding: '0.25rem',
  },
  groups: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  group: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '1.25rem',
    border: '1px solid var(--color-border)',
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.75rem',
  },
  groupIcon: {
    fontSize: '1.25rem',
  },
  groupHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  groupTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
  },
  groupBlurb: {
    margin: '0.125rem 0 0 0',
    fontSize: '0.75rem',
    color: 'var(--color-text-dim)',
  },
  groupBadge: {
    backgroundColor: 'var(--color-surface-hover)',
    color: 'var(--color-text-muted)',
    borderRadius: '9999px',
    padding: '0.125rem 0.5rem',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  groupAdd: {
    width: '1.75rem',
    height: '1.75rem',
    borderRadius: '0.5rem',
    border: '1px solid var(--color-border)',
    background: 'transparent',
    color: 'var(--color-text-muted)',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupEmpty: {
    color: 'var(--color-text-dim)',
    fontSize: '0.875rem',
    margin: 0,
    padding: '0.25rem 0',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.625rem 0.75rem',
    borderRadius: '0.625rem',
    backgroundColor: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
  },
  accountIcon: {
    width: '2.25rem',
    height: '2.25rem',
    borderRadius: '0.625rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '1.125rem',
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    margin: 0,
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardMeta: {
    margin: 0,
    fontSize: '0.75rem',
    color: 'var(--color-text-dim)',
  },
  balanceWrap: {
    flexShrink: 0,
    textAlign: 'right',
  },
  balanceNormal: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--color-text)',
  },
  balanceDebt: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--color-danger-text)',
  },
  cardActions: {
    display: 'flex',
    gap: '0.25rem',
    flexShrink: 0,
  },
  iconAction: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    padding: '0.375rem',
    borderRadius: '0.375rem',
    opacity: 0.7,
  },
  iconActionDanger: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    padding: '0.375rem',
    borderRadius: '0.375rem',
    opacity: 0.7,
  },


  error: {
    backgroundColor: 'var(--color-danger-bg)',
    border: '1px solid var(--color-danger-border)',
    color: 'var(--color-danger-text)',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
    flex: 1,
  },
  input: {
    backgroundColor: 'var(--color-input-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  typeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '0.375rem',
  },
  typeButton: {
    padding: '0.5rem',
    borderRadius: '0.375rem',
    border: '1px solid var(--color-border)',
    background: 'transparent',
    color: 'var(--color-text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  },
  typeButtonActive: {
    padding: '0.5rem',
    borderRadius: '0.375rem',
    border: '1px solid var(--color-primary)',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  },
  submitButton: {
    alignSelf: 'flex-end',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    border: 'none',
    padding: '0.5rem 1.5rem',
    borderRadius: '0.5rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.875rem',
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
  modal: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '1.5rem',
    maxWidth: 560,
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-card)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  modalTitle: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 700,
  },
  modalClose: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-dim)',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '0.25rem',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  primaryButton: {
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    border: 'none',
    padding: '0.625rem 1.25rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

