import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import {
  acknowledgeAllBudgetAlerts,
  acknowledgeBudgetAlert,
  BudgetAlertListResponse,
  BudgetSummaryItem,
  BudgetSummaryResponse,
  Category,
  createBudget,
  deleteBudget,
  fetchBudgetAlerts,
  fetchBudgetSummary,
} from '../api';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { useToast } from './Toast';

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
  const [alerts, setAlerts] = useState<BudgetAlertListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BudgetSummaryItem | null>(null);
  const [form, setForm] = useState<FormState>({ category_id: '', amount_limit: '' });
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BudgetSummaryItem | null>(null);
  const { push: pushToast } = useToast();

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

  const loadAlerts = useCallback(async () => {
    try {
      const data = await fetchBudgetAlerts({ acknowledged: false });
      setAlerts(data);
    } catch {
      // Alerts are non-critical — don't block the page if they fail.
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeBudgetAlert(id);
      await loadAlerts();
      pushToast({ message: 'Alert acknowledged' });
    } catch (err) {
      pushToast({ message: err instanceof Error ? err.message : 'Failed to acknowledge alert' });
    }
  };

  const handleAcknowledgeAll = async () => {
    try {
      await acknowledgeAllBudgetAlerts();
      await loadAlerts();
      pushToast({ message: 'All alerts acknowledged' });
    } catch (err) {
      pushToast({ message: err instanceof Error ? err.message : 'Failed to acknowledge alerts' });
    }
  };

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
      pushToast({ message: 'Budget saved' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBudget(id);
      setPendingDelete(null);
      await loadData();
      pushToast({ message: 'Budget deleted' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete budget');
    }
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 100) return 'var(--color-danger)';
    if (percentage >= 80) return 'var(--color-warning)';
    return 'var(--color-primary)';
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

      {alerts && alerts.items.length > 0 && (
        <div style={styles.alertSection}>
          <div style={styles.alertHeader}>
            <h3 style={styles.alertTitle}>
              ⚠️ Budget Alerts {alerts.unacknowledged_count > 0 && `(${alerts.unacknowledged_count})`}
            </h3>
            <button style={styles.ackAllButton} onClick={handleAcknowledgeAll}>
              Acknowledge all
            </button>
          </div>
          {alerts.items.map((alert) => {
            const pct = Math.round(
              parseFloat(alert.actual_spent) / Math.max(parseFloat(alert.amount_limit), 0.01) * 100,
            );
            const overLimit = pct >= 100;
            return (
              <div key={alert.id} style={styles.alertCard}>
                <div style={styles.alertInfo}>
                  <span style={styles.alertCategory}>
                    {alert.category_icon ? `${alert.category_icon} ` : ''}{alert.category_name}
                  </span>
                  <span style={{ ...styles.alertText, color: overLimit ? 'var(--color-danger)' : 'var(--color-warning-text)' }}>
                    {formatMoney(alert.actual_spent)} of {formatMoney(alert.amount_limit)} ({pct}%)
                    {overLimit ? ' — over budget' : ' — near limit'}
                  </span>
                </div>
                <button
                  style={styles.ackButton}
                  onClick={() => handleAcknowledge(alert.id)}
                >
                  Acknowledge
                </button>
              </div>
            );
          })}
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
          <EmptyState
            icon="🎯"
            title={`No budgets for ${MONTHS[month - 1]} ${year}`}
            description="Set a spending limit per category to track how much you use each month."
            actionLabel="+ Add Budget"
            onAction={openCreate}
          />
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
              <p style={{ ...styles.overviewValue, color: 'var(--color-expense)' }}>{formatMoney(summary.total_spent)}</p>
            </div>
            <div style={styles.overviewCard}>
              <p style={styles.overviewLabel}>Remaining</p>
              <p style={{
                ...styles.overviewValue,
                color: parseFloat(summary.total_budgeted) - parseFloat(summary.total_spent) >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
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
                      <span style={{ ...styles.categoryIcon, backgroundColor: item.budget.color || 'var(--color-border)' }}>
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
                      <button style={styles.deleteButton} onClick={() => setPendingDelete(item)}>Delete</button>
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete budget?"
        message={
          pendingDelete
            ? `The budget for ${pendingDelete.budget.category_name} (${MONTHS[month - 1]} ${year}) will be removed. This action cannot be undone.`
            : ''
        }
        onConfirm={() => pendingDelete && handleDelete(pendingDelete.budget.id)}
        onCancel={() => setPendingDelete(null)}
      />
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
    color: 'var(--color-text-muted)',
    fontSize: '0.875rem',
    margin: '0.25rem 0 0 0',
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
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--color-danger-bg)',
    border: '1px solid var(--color-danger-border)',
    color: 'var(--color-danger-text)',
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    marginBottom: '1.5rem',
  },
  retryButton: {
    backgroundColor: 'var(--color-danger-border)',
    color: 'var(--color-danger-text)',
    border: 'none',
    padding: '0.375rem 1rem',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontWeight: 500,
  },
  alertSection: {
    backgroundColor: 'var(--color-warning-bg, rgba(245, 158, 11, 0.08))',
    border: '1px solid var(--color-warning-border, rgba(245, 158, 11, 0.35))',
    borderRadius: '0.75rem',
    padding: '1rem',
    marginBottom: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  alertHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  alertTitle: {
    margin: 0,
    fontSize: '0.9375rem',
    fontWeight: 600,
  },
  ackAllButton: {
    background: 'transparent',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)',
    padding: '0.25rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  alertCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    padding: '0.625rem 0.875rem',
  },
  alertInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    minWidth: 0,
  },
  alertCategory: {
    fontSize: '0.875rem',
    fontWeight: 600,
  },
  alertText: {
    fontSize: '0.8125rem',
  },
  ackButton: {
    background: 'transparent',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)',
    padding: '0.25rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  monthNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    marginBottom: '2rem',
  },
  navButton: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)',
    borderRadius: '0.5rem',
    width: '2.5rem',
    height: '2.5rem',
    fontSize: '1.25rem',
    cursor: 'pointer',
  },
  monthLabel: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--color-text)',
    minWidth: '10rem',
    textAlign: 'center',
  },
  loading: {
    textAlign: 'center',
    padding: '3rem 0',
    color: 'var(--color-text-dim)',
  },
  emptyCard: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '2rem',
    textAlign: 'center',
    border: '1px dashed var(--color-border)',
  },
  emptyText: {
    color: 'var(--color-text)',
    fontSize: '1rem',
    margin: '0 0 0.5rem 0',
  },
  emptySubtext: {
    color: 'var(--color-text-dim)',
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
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '1.25rem',
    border: '1px solid var(--color-border)',
  },
  overviewLabel: {
    color: 'var(--color-text-muted)',
    fontSize: '0.75rem',
    margin: '0 0 0.25rem 0',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  overviewValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
    color: 'var(--color-text)',
  },
  budgetList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  budgetCard: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '1.25rem',
    border: '1px solid var(--color-border)',
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
    color: 'var(--color-text)',
    fontWeight: 500,
    fontSize: '0.9375rem',
  },
  warningBadge: {
    backgroundColor: 'var(--color-warning-bg)',
    color: 'var(--color-warning-text)',
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
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)',
    padding: '0.25rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
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
  progressTrack: {
    height: '0.625rem',
    borderRadius: '9999px',
    backgroundColor: 'var(--color-border)',
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
    color: 'var(--color-text-muted)',
  },
  pctText: {
    fontWeight: 600,
  },
  remainingRow: {
    marginTop: '0.25rem',
  },
  remainingText: {
    color: 'var(--color-primary)',
    fontSize: '0.8125rem',
  },
  overText: {
    color: 'var(--color-danger)',
    fontSize: '0.8125rem',
  },
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
  },
  formTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    margin: 0,
  },
  formWarning: {
    color: 'var(--color-warning-text)',
    fontSize: '0.875rem',
    margin: 0,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
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
  monthPreview: {
    color: 'var(--color-text-muted)',
    fontSize: '0.875rem',
  },
  error: {
    backgroundColor: 'var(--color-danger-bg)',
    border: '1px solid var(--color-danger-border)',
    color: 'var(--color-danger-text)',
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