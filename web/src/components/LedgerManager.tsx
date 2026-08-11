import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import {
  AccountWithBalance,
  LedgerEntry,
  LedgerTransaction,
  createLedgerTransaction,
  fetchAccountsWithBalance,
  fetchLedgerTransactions,
  migrateSingleToDouble,
} from '../api';
import { useToast } from './Toast';
import { EmptyState } from './EmptyState';

interface Props {
  formatMoney: (value: string | number) => string;
}

interface EntryForm {
  debitAccountId: string;
  creditAccountId: string;
  amount: string;
}

const EMPTY_ENTRY: EntryForm = {
  debitAccountId: '',
  creditAccountId: '',
  amount: '',
};

export function LedgerManager({ formatMoney }: Props) {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entry, setEntry] = useState<EntryForm>(EMPTY_ENTRY);
  const { push: pushToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [txns, accts] = await Promise.all([
        fetchLedgerTransactions(),
        fetchAccountsWithBalance(),
      ]);
      setTransactions(txns);
      setAccounts(accts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(entry.amount);
    if (!description.trim() || !entry.debitAccountId || !entry.creditAccountId || !(amt > 0)) {
      setError('Fill in description, both accounts and a positive amount');
      return;
    }
    if (entry.debitAccountId === entry.creditAccountId) {
      setError('Debit and credit accounts must be different');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createLedgerTransaction({
        description: description.trim(),
        date,
        entries: [
          { account_id: entry.debitAccountId, debit_amount: String(amt), credit_amount: '0', description: 'Debit' },
          { account_id: entry.creditAccountId, debit_amount: '0', credit_amount: String(amt), description: 'Credit' },
        ],
      });
      pushToast({ message: 'Ledger transaction created' });
      setShowForm(false);
      setDescription('');
      setEntry(EMPTY_ENTRY);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ledger transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleMigrate = async () => {
    try {
      const res = await migrateSingleToDouble();
      pushToast({
        message: `Migrated ${res.migrated} of ${res.total_processed} transactions`,
      });
      await load();
    } catch (err) {
      pushToast({
        message: err instanceof Error ? err.message : 'Migration failed',
      });
    }
  };

  const renderEntry = (en: LedgerEntry) => (
    <div key={en.id} style={styles.entry}>
      <span style={styles.entryAccount}>{en.account_name || en.account_id.slice(0, 8)}</span>
      {parseFloat(en.debit_amount) > 0 ? (
        <span style={styles.entryDebit}>DR {formatMoney(en.debit_amount)}</span>
      ) : (
        <span style={styles.entryCredit}>CR {formatMoney(en.credit_amount)}</span>
      )}
    </div>
  );

  const renderTransaction = (t: LedgerTransaction) => (
    <div key={t.transaction_id} style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.cardHeaderText}>
          <p style={styles.cardDescription}>{t.description}</p>
          <p style={styles.cardDate}>{t.date}</p>
        </div>
        <span style={styles.cardId}>{t.transaction_id.slice(0, 8)}…</span>
      </div>
      <div style={styles.entries}>{t.entries.map(renderEntry)}</div>
    </div>
  );


  return (
    <div>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>Ledger</h2>
        <div style={styles.pageActions}>
          <button type="button" style={styles.secondaryButton} onClick={handleMigrate}>
            ⬆ Migrate single→double
          </button>
          <button type="button" style={styles.primaryButton} onClick={() => setShowForm(true)}>
            + New Ledger Entry
          </button>
        </div>
      </div>

      {error && (
        <div style={styles.error}>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="skeleton" style={{ height: 120, borderRadius: '1rem' }} />
      ) : transactions.length === 0 ? (
        <EmptyState
          icon="📒"
          title="No ledger transactions yet"
          description="Double-entry transactions keep a balanced, immutable record of every movement. Create one to get started."
          actionLabel="+ New Ledger Entry"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div style={styles.list}>{transactions.map(renderTransaction)}</div>
      )}

      {showForm && (
        <div style={styles.overlay} role="presentation" onMouseDown={() => setShowForm(false)}>
          <div
            style={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ledger-form-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 id="ledger-form-title" style={styles.modalTitle}>New Ledger Transaction</h3>
              <button type="button" style={styles.modalClose} onClick={() => setShowForm(false)} aria-label="Close">
                ✕
              </button>
            </div>

            {error && (
              <div style={styles.error}>
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleCreate} style={styles.form}>
              <label style={styles.label}>
                Description
                <input
                  style={styles.input}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Groceries at Supermarket X"
                  required
                />
              </label>

              <label style={styles.label}>
                Date
                <input
                  type="date"
                  style={styles.input}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>

              <div style={styles.formRow}>
                <label style={styles.label}>
                  Debit account
                  <select
                    style={styles.select}
                    value={entry.debitAccountId}
                    onChange={(e) => setEntry((f) => ({ ...f, debitAccountId: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.label}>
                  Credit account
                  <select
                    style={styles.select}
                    value={entry.creditAccountId}
                    onChange={(e) => setEntry((f) => ({ ...f, creditAccountId: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label style={styles.label}>
                Amount (R$)
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  style={styles.input}
                  value={entry.amount}
                  onChange={(e) => setEntry((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </label>

              <div style={styles.modalActions}>
                <button type="button" style={styles.cancelButton} onClick={() => setShowForm(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" style={styles.submitButton} disabled={saving}>
                  {saving ? 'Saving…' : 'Create entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
  pageActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  card: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '0.75rem',
    padding: '1rem',
    border: '1px solid var(--color-border)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.75rem',
  },
  cardHeaderText: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.75rem',
  },
  cardDescription: {
    margin: 0,
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: 'var(--color-text)',
  },
  cardDate: {
    margin: 0,
    fontSize: '0.75rem',
    color: 'var(--color-text-dim)',
  },
  cardId: {
    fontSize: '0.75rem',
    color: 'var(--color-text-dim)',
    fontFamily: 'monospace',
  },
  entries: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  entry: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--color-bg)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
  },
  entryAccount: {
    fontSize: '0.875rem',
    color: 'var(--color-text)',
  },
  entryDebit: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--color-danger-text)',
  },
  entryCredit: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--color-income)',
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
  formRow: {
    display: 'flex',
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
  select: {
    backgroundColor: 'var(--color-input-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
    width: '100%',
    boxSizing: 'border-box',
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
  secondaryButton: {
    backgroundColor: 'transparent',
    color: 'var(--color-text-muted)',
    border: '1px solid var(--color-border)',
    padding: '0.625rem 1.25rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  submitButton: {
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
};

