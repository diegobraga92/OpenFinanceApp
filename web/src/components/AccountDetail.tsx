import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Category, MonthlyReportItem, Transaction } from '../api';
import { fetchMonthlyReport, fetchTransactions } from '../api';
import { useI18n } from '../i18n';
import { categoryIcon } from '../../../shared/category-icons';

/** Minimal account shape — works for both `AccountWithBalance` and `CardOverview`. */
export interface AccountLike {
  id: string;
  name: string;
  type?: string;
  account_kind?: string | null;
}

interface Props {
  account: AccountLike;
  categories: Category[];
  onClose: () => void;
}

/** Number of months shown in the per-account monthly summary. */
const SUMMARY_MONTHS = 12;

export function AccountDetail({ account, categories, onClose }: Props) {
  const { t, formatMoney, formatDate, monthNames } = useI18n();
  const [report, setReport] = useState<MonthlyReportItem[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const start = new Date(
          now.getFullYear(),
          now.getMonth() - (SUMMARY_MONTHS - 1),
          1,
        );
        const [reportData, txData] = await Promise.all([
          fetchMonthlyReport(
            start.getFullYear(),
            start.getMonth() + 1,
            now.getFullYear(),
            now.getMonth() + 1,
            account.id,
          ),
          fetchTransactions({ account_id: account.id, page_size: 200 }),
        ]);
        if (cancelled) return;
        setReport(reportData.months);
        setTransactions(txData.items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('accounts.detail.failedLoad'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account.id, t]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Report is chronological ascending; show newest month first.
  const monthsDesc = report ? [...report].reverse() : [];
  const hasActivity = report?.some(
    (m) => parseFloat(m.income_total) !== 0 || parseFloat(m.expense_total) !== 0,
  );

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={account.name}
      >
        <div style={styles.modalHeader}>
          <div style={styles.modalTitleBlock}>
            <h3 style={styles.modalTitle}>
              {t('accounts.detail.title', { name: account.name })}
            </h3>
            <span style={styles.modalSubtitle}>
              {t('accounts.detail.lastMonths', { count: SUMMARY_MONTHS })}
            </span>
          </div>
          <button
            type="button"
            style={styles.modalClose}
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p style={styles.emptyText}>{t('common.loading')}</p>
        ) : error ? (
          <p style={styles.error}>{error}</p>
        ) : (
          <>
            <h4 style={styles.sectionTitle}>{t('accounts.detail.monthlySummary')}</h4>
            {!hasActivity ? (
              <p style={styles.emptyText}>{t('accounts.detail.noMonthlyData')}</p>
            ) : (
              <div style={styles.summaryGrid}>
                <div style={styles.summaryHead}>
                  <span style={styles.summaryHeadCell}>{t('reports.month')}</span>
                  <span style={styles.summaryHeadCell}>{t('reports.income')}</span>
                  <span style={styles.summaryHeadCell}>{t('reports.expenses')}</span>
                  <span style={styles.summaryHeadCell}>{t('reports.netShort')}</span>
                </div>
                {monthsDesc.map((m) => (
                  <div key={`${m.year}-${m.month}`} style={styles.summaryRow}>
                    <span style={styles.summaryMonth}>
                      {monthNames[m.month - 1]} {m.year}
                    </span>
                    <span style={styles.summaryValue}>
                      {formatMoney(m.income_total)}
                    </span>
                    <span style={{ ...styles.summaryValue, color: 'var(--color-expense)' }}>
                      {formatMoney(m.expense_total)}
                    </span>
                    <span
                      style={{
                        ...styles.summaryValue,
                        fontWeight: 600,
                        color: parseFloat(m.balance) >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
                      }}
                    >
                      {formatMoney(m.balance)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <h4 style={styles.sectionTitle}>{t('accounts.detail.transactions')}</h4>
            {transactions.length === 0 ? (
              <p style={styles.emptyText}>{t('accounts.detail.noTransactions')}</p>
            ) : (
              <div style={styles.txList}>
                {transactions.map((tx) => {
                  const cat = tx.category_id ? categoryById.get(tx.category_id) : undefined;
                  const isIncome = tx.type === 'income';
                  return (
                    <div key={tx.id} style={styles.txRow}>
                      <span style={styles.txDate}>{formatDate(tx.date)}</span>
                      <span style={styles.txDescBlock}>
                        <span style={styles.txDesc}>{tx.description}</span>
                        {cat && (
                          <span style={styles.txBadge}>
                            {cat.icon && (
                              <span style={styles.txBadgeIcon}>
                                {categoryIcon(cat.icon)}
                              </span>
                            )}
                            {cat.name}
                          </span>
                        )}
                      </span>
                      <span
                        style={{
                          ...styles.txAmount,
                          color: isIncome ? 'var(--color-income)' : 'var(--color-expense)',
                        }}
                      >
                        {isIncome ? '+' : '-'}
                        {formatMoney(tx.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
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
    zIndex: 300,
    padding: '1rem',
  },
  modal: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '1.5rem',
    maxWidth: 640,
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-card)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  modalTitleBlock: {
    minWidth: 0,
  },
  modalTitle: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 700,
  },
  modalSubtitle: {
    display: 'block',
    marginTop: '0.25rem',
    fontSize: '0.75rem',
    color: 'var(--color-text-dim)',
  },
  modalClose: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-dim)',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '0.25rem',
  },
  sectionTitle: {
    margin: '1rem 0 0.5rem',
    fontSize: '0.875rem',
    fontWeight: 600,
  },
  summaryGrid: {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--color-border)',
    borderRadius: '0.625rem',
    overflow: 'hidden',
  },
  summaryHead: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
    backgroundColor: 'var(--color-surface-hover)',
    padding: '0.5rem 0.75rem',
  },
  summaryHeadCell: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--color-text-muted)',
  },
  summaryRow: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
    alignItems: 'center',
    padding: '0.5rem 0.75rem',
    borderTop: '1px solid var(--color-border)',
  },
  summaryMonth: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text)',
  },
  summaryValue: {
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
    fontVariantNumeric: 'tabular-nums',
  },
  txList: {
    display: 'flex',
    flexDirection: 'column',
  },
  txRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0',
    borderBottom: '1px solid var(--color-border)',
    fontSize: '0.875rem',
  },
  txDate: {
    flexShrink: 0,
    color: 'var(--color-text-dim)',
    fontSize: '0.75rem',
    width: '5.5rem',
  },
  txDescBlock: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    flexWrap: 'wrap',
  },
  txDesc: {
    fontWeight: 500,
    color: 'var(--color-text)',
  },
  txBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.0625rem 0.375rem',
    borderRadius: '0.375rem',
    backgroundColor: 'var(--color-border)',
    fontSize: '0.6875rem',
    color: 'var(--color-text-muted)',
  },
  txBadgeIcon: {
    fontSize: '0.75rem',
  },
  txAmount: {
    flexShrink: 0,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
  },
  emptyText: {
    color: 'var(--color-text-dim)',
    textAlign: 'center',
    padding: '1.5rem 0',
    margin: 0,
  },
  error: {
    color: 'var(--color-danger-text)',
    textAlign: 'center',
    padding: '1rem 0',
    margin: 0,
  },
};

