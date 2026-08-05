import { useState, type CSSProperties, type FormEvent } from 'react';
import type { Category, Transaction } from '../api';
import { createTransaction, updateTransaction } from '../api';

interface Props {
  categories: Category[];
  editing: Transaction | null;
  onCancel: () => void;
  onSaved: () => void;
}

export function TransactionForm({ categories, editing, onCancel, onSaved }: Props) {
  const [description, setDescription] = useState(editing?.description ?? '');
  const [amount, setAmount] = useState(editing?.amount ?? '');
  const [type, setType] = useState<'income' | 'expense'>(
    (editing?.type === 'income' || editing?.type === 'expense' ? editing.type : 'expense'),
  );
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? '');
  const [date, setDate] = useState(editing?.date ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCategories = categories.filter((c) => c.type === type);

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
      };
      if (editing) {
        await updateTransaction(editing.id, payload);
      } else {
        await createTransaction(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <form style={styles.form} onSubmit={handleSubmit}>
        <h3 style={styles.title}>
          {editing ? 'Edit Transaction' : 'Add Transaction'}
        </h3>

        {error && (
          <div style={styles.error}>
            <p>{error}</p>
          </div>
        )}

        <label style={styles.label}>
          Description
          <input
            style={styles.input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Lunch at Restaurante X"
            required
          />
        </label>

        <div style={styles.row}>
          <label style={styles.label}>
            Amount (R$)
            <input
              style={styles.input}
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </label>

          <label style={styles.label}>
            Date
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
          Type
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
              Expense
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
              Income
            </button>
          </div>
        </label>

        <label style={styles.label}>
          Category
          <select
            style={styles.input}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">— No category —</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ''}{c.name}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Notes
          <textarea
            style={{ ...styles.input, minHeight: '4rem', resize: 'vertical' }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes…"
          />
        </label>

        <div style={styles.actions}>
          <button
            type="button"
            style={styles.cancelButton}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={styles.submitButton}
            disabled={saving}
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Transaction'}
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '1rem',
  },
  form: {
    backgroundColor: '#1e293b',
    borderRadius: '1rem',
    padding: '2rem',
    width: '100%',
    maxWidth: 480,
    border: '1px solid #334155',
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
    backgroundColor: '#450a0a',
    border: '1px solid #991b1b',
    color: '#fca5a5',
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
    color: '#94a3b8',
    flex: 1,
  },
  input: {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    color: '#e2e8f0',
    fontSize: '0.875rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  typeToggle: {
    display: 'flex',
    gap: '0.5rem',
  },
  typeButton: {
    flex: 1,
    padding: '0.5rem',
    borderRadius: '0.5rem',
    border: '1px solid #334155',
    background: 'transparent',
    color: '#94a3b8',
    fontWeight: 500,
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  typeButtonActive: {
    backgroundColor: '#334155',
    color: '#e2e8f0',
    borderColor: '#475569',
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
    border: '1px solid #334155',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  submitButton: {
    padding: '0.5rem 1.25rem',
    borderRadius: '0.5rem',
    border: 'none',
    backgroundColor: '#22c55e',
    color: '#0f172a',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
};