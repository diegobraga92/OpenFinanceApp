import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import {
  Category,
  createInstallmentPlan,
  deleteInstallmentPlan,
  fetchInstallmentPlan,
  fetchInstallmentPlans,
  generateInstallments,
  InstallmentPlan,
  InstallmentPlanDetail,
  payInstallment,
} from '../api';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { useToast } from './Toast';
import { useI18n } from '../i18n';

interface Props {
  categories: Category[];
  formatMoney: (value: string | number) => string;
}

interface FormState {
  description: string;
  total_amount: string;
  installments: string;
  category_id: string;
  start_date: string;
}

export function InstallmentManager({ categories, formatMoney }: Props) {
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>({
    description: '',
    total_amount: '',
    installments: '3',
    category_id: '',
    start_date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<InstallmentPlan | null>(null);
  const [detail, setDetail] = useState<InstallmentPlanDetail | null>(null);
  const { push: pushToast } = useToast();
  const { t } = useI18n();

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInstallmentPlans();
      setPlans(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('installments.failedLoad'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const openDetail = async (id: string) => {
    try {
      const d = await fetchInstallmentPlan(id);
      setDetail(d);
    } catch (err) {
      pushToast({ message: err instanceof Error ? err.message : t('installments.failedLoadDetail') });
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const total = parseFloat(form.total_amount);
      const count = parseInt(form.installments, 10);
      if (form.description.trim().length === 0) throw new Error(t('installments.validation.desc'));
      if (!total || total <= 0) throw new Error(t('installments.validation.total'));
      if (count < 2 || count > 60) throw new Error(t('installments.validation.count'));
      if (!form.start_date) throw new Error(t('installments.validation.date'));

      await createInstallmentPlan({
        description: form.description.trim(),
        total_amount: form.total_amount,
        installments: count,
        category_id: form.category_id || undefined,
        start_date: form.start_date,
      });
      setShowForm(false);
      setForm({
        description: '',
        total_amount: '',
        installments: '3',
        category_id: '',
        start_date: new Date().toISOString().slice(0, 10),
      });
      await loadPlans();
      pushToast({ message: t('installments.created') });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('installments.failedCreate'));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async (id: string) => {
    try {
      const res = await generateInstallments(id);
      pushToast({
        message: t('installments.generated', { count: res.generated }),
      });
      await loadPlans();
      if (detail && detail.plan.id === id) {
        setDetail(await fetchInstallmentPlan(id));
      }
    } catch (err) {
      pushToast({ message: err instanceof Error ? err.message : t('installments.failedGenerate') });
    }
  };

  const handlePay = async (planId: string, number: number) => {
    try {
      await payInstallment(planId, number);
      pushToast({ message: t('installments.markedPaid', { number }) });
      setDetail(await fetchInstallmentPlan(planId));
      await loadPlans();
    } catch (err) {
      pushToast({ message: err instanceof Error ? err.message : t('installments.failedPay') });
    }
  };

  const handleDelete = async (plan: InstallmentPlan) => {
    try {
      await deleteInstallmentPlan(plan.id);
      setPendingDelete(null);
      setDetail(null);
      await loadPlans();
      pushToast({ message: t('installments.deleted') });
    } catch (err) {
      pushToast({ message: err instanceof Error ? err.message : t('installments.failedDelete') });
    }
  };

  const paidPct = (plan: InstallmentPlan) =>
    plan.installments > 0 ? Math.round((plan.progress.paid_count / plan.installments) * 100) : 0;
  return (
    <div>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>{t('installments.title')}</h2>
        <button style={styles.primaryButton} onClick={() => setShowForm(true)}>{t('installments.newPlan')}</button>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          <p>{error}</p>
          <button onClick={loadPlans} style={styles.retryButton}>{t('common.retry')}</button>
        </div>
      )}

      {!loading && plans.length === 0 && !showForm && (
        <EmptyState
          icon="📅"
          title={t('installments.noTitle')}
          description={t('installments.noDesc')}
        />
      )}

      {plans.map((plan) => {
        const pct = paidPct(plan);
        const overDue = plan.progress.pending_count > 0 && plan.start_date <= new Date().toISOString().slice(0, 10);
        return (
          <div key={plan.id} style={styles.planCard}>
            <div style={styles.planHeader}>
              <div style={styles.planCategory}>
                <span style={{ ...styles.categoryIcon, backgroundColor: plan.category_color || 'var(--color-border)' }}>
                  {plan.category_icon || '📦'}
                </span>
                <div>
                  <div style={styles.planTitle}>{plan.description}</div>
                  <div style={styles.planSubtitle}>
                    {plan.category_name || t('installments.uncategorised')} · {t('installments.paidCount', { paid: plan.progress.paid_count, total: plan.installments })} ·{' '}
                    {t('installments.perMonth', { amount: formatMoney(plan.installment_amount) })}
                  </div>
                </div>
              </div>
              <div style={styles.planAmounts}>
                <div style={styles.planTotal}>{formatMoney(plan.total_amount)}</div>
                <div style={styles.planRemaining}>
                  {t('installments.left', { amount: formatMoney(plan.progress.remaining_amount) })}
                </div>
              </div>
            </div>
            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${pct}%`,
                  backgroundColor: pct >= 100 ? 'var(--color-primary)' : 'var(--color-warning-text)',
                }}
              />
            </div>
            <div style={styles.planActions}>
              {overDue && plan.progress.pending_count > 0 && (
                <button style={styles.generateButton} onClick={() => handleGenerate(plan.id)}>
                  {t('installments.generate')}
                </button>
              )}
              <button style={styles.secondaryButton} onClick={() => openDetail(plan.id)}>
                {t('installments.view')}
              </button>
              <button style={styles.deleteButton} onClick={() => setPendingDelete(plan)}>{t('common.delete')}</button>
            </div>
          </div>
        );
      })}


      {detail && (
        <div style={styles.overlay} onClick={() => setDetail(null)}>
          <div style={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
            <div style={styles.detailHeader}>
              <h3 style={styles.detailTitle}>{detail.plan.description}</h3>
              <button style={styles.closeButton} onClick={() => setDetail(null)}>✕</button>
            </div>
            <div style={styles.detailMeta}>
              <span>{formatMoney(detail.plan.installment_amount)} × {detail.plan.installments}</span>
              <span>{t('installments.detailTotal', { amount: formatMoney(detail.plan.total_amount) })}</span>
              <span>{t('installments.detailRemaining', { paid: detail.plan.progress.paid_count, pending: detail.plan.progress.pending_count })}</span>
            </div>
            <div style={styles.installmentList}>
              {detail.installments.map((inst) => (
                <div key={inst.id} style={styles.installmentRow}>
                  <span style={styles.installmentNumber}>#{inst.installment_number}</span>
                  <span style={styles.installmentDue}>{inst.due_date}</span>
                  <span style={styles.installmentStatus}>
                    {inst.status === 'paid' ? t('installments.statusPaid') : inst.status === 'generated' ? t('installments.statusGenerated') : t('installments.statusPending')}
                  </span>
                  {inst.status !== 'paid' && (
                    <button
                      style={styles.payButton}
                      onClick={() => handlePay(detail.plan.id, inst.installment_number)}
                    >
                      {t('installments.markPaid')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}


      {showForm && (
        <div style={styles.overlay} onClick={() => setShowForm(false)}>
          <form style={styles.form} onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
            <h3 style={styles.formTitle}>{t('installments.form.title')}</h3>

            <label style={styles.label}>
              {t('installments.form.description')}
              <input
                style={styles.input}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('installments.form.descriptionPlaceholder')}
              />
            </label>

            <div style={styles.formRow}>
              <label style={styles.label}>
                {t('installments.form.total')}
                <input
                  style={styles.input}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.total_amount}
                  onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                  placeholder="1200.00"
                />
              </label>
              <label style={styles.label}>
                {t('installments.form.count')}
                <input
                  style={styles.input}
                  type="number"
                  min="2"
                  max="60"
                  value={form.installments}
                  onChange={(e) => setForm({ ...form, installments: e.target.value })}
                />
              </label>
            </div>

            {form.total_amount && form.installments && parseInt(form.installments, 10) > 0 && (
              <div style={styles.monthPreview}>
                {t('installments.form.perMonth', { amount: formatMoney((parseFloat(form.total_amount) / parseInt(form.installments, 10)).toFixed(2)) })}
              </div>
            )}

            <label style={styles.label}>
              {t('installments.form.categoryOptional')}
              <select
                style={styles.input}
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">{t('common.none')}</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              {t('installments.form.firstDate')}
              <input
                style={styles.input}
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </label>

            <div style={styles.actions}>
              <button type="button" style={styles.cancelButton} onClick={() => setShowForm(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" style={styles.submitButton} disabled={saving}>
                {saving ? t('common.creating') : t('installments.form.create')}
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          open={!!pendingDelete}
          title={t('installments.deleteTitle')}
          message={t('installments.deleteMessage', { description: pendingDelete.description })}
          confirmLabel={t('common.delete')}
          onConfirm={() => handleDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
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
  generateButton: {
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    border: 'none',
    padding: '0.25rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
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
  planCard: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '1rem',
    padding: '1.25rem',
    marginBottom: '1rem',
  },
  planHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '0.75rem',
  },
  planCategory: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  categoryIcon: {
    width: '2.5rem',
    height: '2.5rem',
    borderRadius: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
  },
  planTitle: {
    fontSize: '1rem',
    fontWeight: 600,
  },
  planSubtitle: {
    color: 'var(--color-text-muted)',
    fontSize: '0.8125rem',
  },
  planAmounts: {
    textAlign: 'right',
  },
  planTotal: {
    fontSize: '1rem',
    fontWeight: 700,
  },
  planRemaining: {
    color: 'var(--color-text-muted)',
    fontSize: '0.8125rem',
  },
  progressTrack: {
    height: '0.5rem',
    borderRadius: '9999px',
    backgroundColor: 'var(--color-border)',
    overflow: 'hidden',
    marginBottom: '0.75rem',
  },
  progressFill: {
    height: '100%',
    borderRadius: '9999px',
    transition: 'width 0.3s ease',
  },
  planActions: {
    display: 'flex',
    gap: '0.5rem',
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
  detailPanel: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '1.5rem',
    width: '100%',
    maxWidth: 560,
    border: '1px solid var(--color-border)',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  detailTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    margin: 0,
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-muted)',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  detailMeta: {
    display: 'flex',
    gap: '1rem',
    color: 'var(--color-text-muted)',
    fontSize: '0.875rem',
    marginBottom: '1rem',
    flexWrap: 'wrap',
  },
  installmentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  installmentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0.75rem',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
  },
  installmentNumber: {
    fontWeight: 600,
    fontSize: '0.875rem',
    minWidth: '2.5rem',
  },
  installmentDue: {
    color: 'var(--color-text-muted)',
    fontSize: '0.8125rem',
    flex: 1,
  },
  installmentStatus: {
    fontSize: '0.8125rem',
    flex: 1,
  },
  payButton: {
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    border: 'none',
    padding: '0.25rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
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
    maxHeight: '85vh',
    overflowY: 'auto',
  },
  formTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    margin: 0,
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
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

