import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import {
  BudgetSummaryItem,
  BudgetSummaryResponse,
  Category,
  createBudget,
  deleteBudget,
  fetchBudgetSummary,
} from '../api';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Props {
  categories: Category[];
  formatMoney: (value: string | number) => string;
}

interface FormState {
  category_id: string;
  amount_limit: string;
}

export function BudgetManager({ categories, formatMoney }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [summary, setSummary] = useState<BudgetSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BudgetSummaryItem | null>(null);
  const [form, setForm] = useState<FormState>({ category_id: '', amount_limit: '' });
  const [saving, setSaving] = useState(false);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summ = await fetchBudgetSummary(year, month);
      setSummary(summ);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budgets');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ category_id: '', amount_limit: '' });
    setShowForm(true);
  };

  const openEdit = (item: BudgetSummaryItem) => {
    setEditing(item);
    setForm({
      category_id: item.budget.category_id,
      amount_limit: String(item.budget.amount_limit),
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createBudget({
        category_id: form.category_id,
        month,
        year,
        amount_limit: form.amount_limit,
      });
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this budget?')) return;
    try {
      await deleteBudget(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete budget');
    }
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 100) return '#ef4444';
    if (percentage >= 80) return '#f59e0b';
    return '#22c55e';
  };

  const formatPct = (value: string | number) => {
    const n = typeof value === 'string' ? parseFloat(value) : value;
    return `${Math.round(n)}%`;
  };

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Budgets</h2>
          <p style={styles.pageSubtitle}>Set monthly spending limits per category</p>
        </div>
        <button style={styles.primaryButton} onClick={openCreate} disabled={expenseCategories.length === 0}>
          + Add Budget
        </button>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          <p>{error}</p>
          <button onClick={loadData} style={styles.retryButton}>Retry</button>
        </div>
      )}

      <div style={styles.monthNav}>
        <button style={styles.navButton} onClick={prevMonth}>←</button>
        <span style={styles.monthLabel}>{MONTHS[month - 1]} {year}</span>
        <button
          style={styles.navButton}
          onClick={nextMonth}
          disabled={year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)}
        >
          →
        </button>
      </div>

      {loading ? (
        <div style={styles.loading}>
          <p>Loading budgets…</p>
        </div>
      ) : summary && summary.items.length === 0 ? (
        <div style={styles.emptyCard}>
          <p style={styles.emptyText}>No budgets set for {MONTHS[month - 1]} {year}.</p>
          <p style={styles.emptySubtext}>Click "+ Add Budget" to set your first spending limit.</p>
        </div>
      ) : summary ? (
        <div>
          <div style={styles.overviewCards}>
            <div style={styles.overviewCard}>
              <p style={styles.overviewLabel}>Total Budgeted</p>
              <p style={styles.overviewValue}>{formatMoney(summary.total_budgeted)}</p>
            </div>
            <div style={styles.overviewCard}>
              <p style={styles.overviewLabel}>Total Spent</p>
              <p style={{ ...styles.overviewValue, color: '#ef4444' }}>{formatMoney(summary.total_spent)}</p>
            </div>
            <div style={styles.overviewCard}>
              <p style={styles.overviewLabel}>Remaining</p>
              <p style={{
                ...styles.overviewValue,
                color: parseFloat(summary.total_budgeted) - parseFloat(summary.total_spent) >= 0 ? '#22c55e' : '#ef4444',
              }}>
                {formatMoney(parseFloat(summary.total_budgeted) - parseFloat(summary.total_spent))}
              </p>
            </div>
          </div>

          <div style={styles.budgetList}>
            {summary.items.map((item) => {
              const pct = parseFloat(item.percentage);
              const color = getProgressColor(pct);
              return (
                <div key={item.budget.id} style={styles.budgetCard}>
                  <div style={styles.budgetHeader}>
                    <div style={styles.budgetCategory}>
                      <span style={{ ...styles.categoryIcon, backgroundColor: item.budget.color || '#334155' }}>
                        {item.budget.icon || '•'}
                      </span>
                      <span style={styles.categoryName}>{item.budget.category_name}</span>
                      {pct >= 80 && (
                        <span style={styles.warningBadge}>
                          {pct >= 100 ? 'Over budget' : 'Warning'}
                        </span>
                      )}
                    </div>
                    <div style={styles.budgetActions}>
                      <button style={styles.actionButton} onClick={() => openEdit(item)}>Edit</button>
                      <button style={styles.deleteButton} onClick={() => handleDelete(item.budget.id)}>Delete</button>
                    </div>
                  </div>

                  <div style={styles.progressTrack}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${Math.min(100, pct)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>

                  <div style={styles.budgetMeta}>
                    <span style={styles.spentText}>
                      {formatMoney(item.actual_spent)} of {formatMoney(item.budget.amount_limit)}
                    </span>
                    <span style={{ ...styles.pctText, color }}>
                      {formatPct(item.percentage)}
                    </span>
                  </div>

                  <div style={styles.remainingRow}>
                    {parseFloat(item.remaining) >= 0 ? (
                      <span style={styles.remainingText}>
                        {formatMoney(item.remaining)} remaining
                      </span>
                    ) : (
                      <span style={styles.overText}>
                        {formatMoney(Math.abs(parseFloat(item.remaining)))} over budget
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {showForm && (
        <div style={styles.overlay}>
          <form style={styles.form} onSubmit={handleSubmit}>
            <h3 style={styles.formTitle}>
              {editing ? `Edit Budget — ${editing.budget.category_name}` : 'Add Budget'}
            </h3>

            {expenseCategories.length === 0 && (
              <p style={styles.formWarning}>No expense categories available. Create one first.</p>
            )}

            <label style={styles.label}>
              Category
              <select
                style={styles.input}
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                required
                disabled={!!editing}
              >
                <option value="">— Select category —</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ''}{c.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              Monthly Limit (R$)
              <input
                style={styles.input}
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount_limit}
                onChange={(e) => setForm({ ...form, amount_limit: e.target.value })}
                placeholder="500.00"
                required
              />
            </label>

            <div style={styles.monthPreview}>
              Applies to: <strong>{MONTHS[month - 1]} {year}</strong>
            </div>

            {error && (
              <div style={styles.error}>
                <p>{error}</p>
              </div>
            )}

            <div style={styles.actions}>
              <button
                type="button"
                style={styles.cancelButton}
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={styles.submitButton}
                disabled={saving || expenseCategories.length === 0}
              >
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Budget'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
  },
  pageTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
  },
  pageSubtitle: {
    color: '#94a3b8',
    fontSize: '0.875rem',
    margin: '0.25rem 0 0 0',
  },
  primaryButton: {
    backgroundColor: '#22c55e',
    color: '#0f172a',
    border: 'none',
    padding: '0.625rem 1.25rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#450a0a',
    border: '1px solid #991b1b',
    color: '#fca5a5',
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    marginBottom: '1.5rem',
  },
  retryButton: {
    backgroundColor: '#991b1b',
    color: '#fca5a5',
    border: 'none',
    padding: '0.375rem 1rem',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontWeight: 500,
  },
  monthNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    marginBottom: '2rem',
  },
  navButton: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: '0.5rem',
    width: '2.5rem',
    height: '2.5rem',
    fontSize: '1.25rem',
    cursor: 'pointer',
  },
  monthLabel: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#e2e8f0',
    minWidth: '10rem',
    textAlign: 'center',
  },
  loading: {
    textAlign: 'center',
    padding: '3rem 0',
    color: '#64748b',
  },
  emptyCard: {
    backgroundColor: '#1e293b',
    borderRadius: '1rem',
    padding: '2rem',
    textAlign: 'center',
    border: '1px dashed #334155',
  },
  emptyText: {
    color: '#e2e8f0',
    fontSize: '1rem',
    margin: '0 0 0.5rem 0',
  },
  emptySubtext: {
    color: '#64748b',
    fontSize: '0.875rem',
    margin: 0,
  },
  overviewCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  overviewCard: {
    backgroundColor: '#1e293b',
    borderRadius: '1rem',
    padding: '1.25rem',
    border: '1px solid #334155',
  },
  overviewLabel: {
    color: '#94a3b8',
    fontSize: '0.75rem',
    margin: '0 0 0.25rem 0',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  overviewValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
    color: '#e2e8f0',
  },
  budgetList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  budgetCard: {
    backgroundColor: '#1e293b',
    borderRadius: '1rem',
    padding: '1.25rem',
    border: '1px solid #334155',
  },
  budgetHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.75rem',
  },
  budgetCategory: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  categoryIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2rem',
    height: '2rem',
    borderRadius: '0.5rem',
    fontSize: '1rem',
  },
  categoryName: {
    color: '#e2e8f0',
    fontWeight: 500,
    fontSize: '0.9375rem',
  },
  warningBadge: {
    backgroundColor: '#7c2d12',
    color: '#fbbf24',
    fontSize: '0.625rem',
    fontWeight: 600,
    padding: '0.125rem 0.5rem',
    borderRadius: '9999px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  budgetActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  actionButton: {
    background: 'transparent',
    border: '1px solid #334155',
    color: '#94a3b8',
    padding: '0.25rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
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
  progressTrack: {
    height: '0.625rem',
    borderRadius: '9999px',
    backgroundColor: '#334155',
    overflow: 'hidden',
    marginBottom: '0.5rem',
  },
  progressFill: {
    height: '100%',
    borderRadius: '9999px',
    transition: 'width 0.3s ease',
  },
  budgetMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.8125rem',
  },
  spentText: {
    color: '#94a3b8',
  },
  pctText: {
    fontWeight: 600,
  },
  remainingRow: {
    marginTop: '0.25rem',
  },
  remainingText: {
    color: '#22c55e',
    fontSize: '0.8125rem',
  },
  overText: {
    color: '#ef4444',
    fontSize: '0.8125rem',
  },
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
  },
  formTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    margin: 0,
  },
  formWarning: {
    color: '#fbbf24',
    fontSize: '0.875rem',
    margin: 0,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    fontSize: '0.875rem',
    color: '#94a3b8',
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
  monthPreview: {
    color: '#94a3b8',
    fontSize: '0.875rem',
  },
  error: {
    backgroundColor: '#450a0a',
    border: '1px solid #991b1b',
    color: '#fca5a5',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
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