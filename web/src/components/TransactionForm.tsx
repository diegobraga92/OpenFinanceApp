import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { AccountWithBalance, Category, Transaction } from '../api';
import { createTransaction, updateTransaction } from '../api';
import { useI18n } from '../i18n';
import { categoryIcon } from '../../../shared/category-icons';

interface Props {
  categories: Category[];
  accounts: AccountWithBalance[];
  editing: Transaction | null;
  onCancel: () => void;
  onSaved: () => void;
}

export function TransactionForm({ categories, accounts, editing, onCancel, onSaved }: Props) {
  const { t } = useI18n();
  const [description, setDescription] = useState(editing?.description ?? '');
  const [amount, setAmount] = useState(editing?.amount ?? '');
  const [type, setType] = useState<'income' | 'expense'>(
    (editing?.type === 'income' || editing?.type === 'expense' ? editing.type : 'expense'),
  );
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? '');
  const [date, setDate] = useState(editing?.date ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [accountId, setAccountId] = useState(editing?.account_id ?? '');
  const [installments, setInstallments] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape for keyboard users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const filteredCategories = categories.filter((c) => c.type === type);
  const paymentAccounts = accounts.filter(
    (a) => a.account_kind === 'bank' || a.account_kind === 'cash' || a.account_kind === 'card',
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        description,
        amount,
        type,
        category_id: categoryId || null,
        date,
        notes: notes || null,
        account_id: accountId || null,
        installments: parseInt(installments, 10) > 1 ? parseInt(installments, 10) : undefined,
      };
      if (editing) {
        await updateTransaction(editing.id, payload);
      } else {
        await createTransaction(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('transactions.form.failedSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={styles.overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form style={styles.form} onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-labelledby="tx-form-title">
        <h3 id="tx-form-title" style={styles.title}>
          {editing ? t('transactions.form.edit') : t('transactions.form.add')}
        </h3>

        {error && (
          <div style={styles.error}>
            <p>{error}</p>
          </div>
        )}

        <label style={styles.label}>
          {t('common.description')}
          <input
            style={styles.input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('transactions.form.descriptionPlaceholder')}
            required
          />
        </label>

        <div style={styles.row}>
          <label style={styles.label}>
            {t('transactions.form.amount')}
            <input
              style={styles.input}
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('transactions.form.amountPlaceholder')}
              required
            />
          </label>

          <label style={styles.label}>
            {t('common.date')}
            <input
              style={styles.input}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
        </div>

        <label style={styles.label}>
          {t('common.type')}
          <div style={styles.typeToggle}>
            <button
              type="button"
              style={{ ...styles.typeButton, ...(type === 'expense' ? styles.typeButtonActive : {}) }}
              onClick={() => {
                setType('expense');
                // Reset category if the selected category is not an expense category
                const cat = categories.find((c) => c.id === categoryId);
                if (cat && cat.type !== 'expense') setCategoryId('');
              }}
            >
              {t('common.expense')}
            </button>
            <button
              type="button"
              style={{ ...styles.typeButton, ...(type === 'income' ? styles.typeButtonActive : {}) }}
              onClick={() => {
                setType('income');
                const cat = categories.find((c) => c.id === categoryId);
                if (cat && cat.type !== 'income') setCategoryId('');
              }}
            >
              {t('common.income')}
            </button>
          </div>
        </label>

        <label style={styles.label}>
          {t('common.category')}
          <select
            style={styles.input}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">— {t('common.none')} —</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${categoryIcon(c.icon)} ` : ''}{c.name}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          {t('transactions.form.account')}
          <select
            style={styles.input}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">— {t('transactions.form.defaultAccount')} —</option>
            {paymentAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.type === 'liability' ? ' 💳' : ''}
              </option>
            ))}
          </select>
          <small style={styles.hint}>{t('transactions.form.accountPlaceholder')}</small>
        </label>

        <div style={styles.row}>
          <label style={styles.label}>
            {t('transactions.form.installments')}
            <input
              style={styles.input}
              type="number"
              min={1}
              max={60}
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
            />
            <small style={styles.hint}>{t('transactions.form.installmentsHint')}</small>
            {parseInt(installments, 10) > 1 && amount && (
              <small style={styles.hint}>
                {t('transactions.form.perInstallment', {
                  installments,
                  amount: `R$ ${(parseFloat(amount) / parseInt(installments, 10)).toFixed(2)}`,
                })}
              </small>
            )}
          </label>
        </div>

        <label style={styles.label}>
          {t('common.notes')}
          <textarea
            style={{ ...styles.input, minHeight: '4rem', resize: 'vertical' }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('transactions.form.notesPlaceholder')}
          />
        </label>

        <div style={styles.actions}>
          <button
            type="button"
            style={styles.cancelButton}
            onClick={onCancel}
            disabled={saving}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            style={styles.submitButton}
            disabled={saving}
          >
            {saving ? t('common.saving') : editing ? t('transactions.form.saveChanges') : t('transactions.form.add')}
          </button>
        </div>
      </form>
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
    zIndex: 100,
    padding: '1rem',
  },
  form: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '2rem',
    width: '100%',
    maxWidth: 480,
    border: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    margin: 0,
  },
  error: {
    backgroundColor: 'var(--color-danger-bg)',
    border: '1px solid var(--color-danger-border)',
    color: 'var(--color-danger-text)',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
  },
  row: {
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
    backgroundColor: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: '0.75rem',
    color: 'var(--color-text-dim)',
  },
  typeToggle: {
    display: 'flex',
    gap: '0.5rem',
  },
  typeButton: {
    flex: 1,
    padding: '0.5rem',
    borderRadius: '0.5rem',
    border: '1px solid var(--color-border)',
    background: 'transparent',
    color: 'var(--color-text-muted)',
    fontWeight: 500,
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  typeButtonActive: {
    backgroundColor: 'var(--color-border)',
    color: 'var(--color-text)',
    borderColor: 'var(--color-border-strong)',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    marginTop: '0.5rem',
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
  submitButton: {
    padding: '0.5rem 1.25rem',
    borderRadius: '0.5rem',
    border: 'none',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
};