import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  Category,
  fetchBudgetSummary,
  fetchCategories,
  fetchSummary,
  fetchTransactions,
  SummaryResponse,
  Transaction,
} from './api';
import { TransactionForm } from './components/TransactionForm';
import { CategoryManager } from './components/CategoryManager';
import { TransactionTable } from './components/TransactionTable';
import { AuditDashboard } from './components/AuditDashboard';
import { BudgetManager } from './components/BudgetManager';
import { ReceiptScanner } from './components/ReceiptScanner';
import { ReconciliationUpload } from './components/ReconciliationUpload';
import { ReportsDashboard } from './components/ReportsDashboard';
import { EmptyState } from './components/EmptyState';
import { useTheme } from './theme/ThemeContext';

type Tab = 'dashboard' | 'transactions' | 'categories' | 'budgets' | 'reports' | 'reconciliation' | 'receipts' | 'audit';

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [budgetAlert, setBudgetAlert] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const { toggle: toggleTheme, mode: themeMode } = useTheme();

  const loadCategories = useCallback(async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
      return [];
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      const data = await fetchTransactions({ page_size: 50 });
      setTransactions(data.items);
      return data.items;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
      return [];
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, summ, txns] = await Promise.all([
        loadCategories(),
        fetchSummary(),
        loadTransactions(),
      ]);
      setCategories(cats);
      setSummary(summ);
      setTransactions(txns);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [loadCategories, loadTransactions]);

  // Check for budget alerts on dashboard load
  const checkBudgetAlerts = useCallback(async () => {
    try {
      const now = new Date();
      const { items } = await fetchBudgetSummary(now.getFullYear(), now.getMonth() + 1);
      const over = items.filter((i) => parseFloat(i.percentage) >= 80);
      if (over.length > 0) {
        const worst = [...over].sort(
          (a, b) => parseFloat(b.percentage) - parseFloat(a.percentage),
        )[0];
        const pct = Math.round(parseFloat(worst.percentage));
        const extras = over.length - 1;
        const prefix = extras > 0 ? `${extras} more budget${extras > 1 ? 's' : ''} at/over 80% · ` : '';
        setBudgetAlert(
          `⚠️ ${prefix}You've spent ${pct}% of your ${worst.budget.category_name} budget this month`
        );
      } else {
        setBudgetAlert(null);
      }
    } catch {
      // Budget alerts are non-critical; ignore errors
    }
  }, []);

  useEffect(() => {
    loadData();
    checkBudgetAlerts();
  }, [loadData, checkBudgetAlerts]);

  const handleTransactionCreated = async () => {
    setShowForm(false);
    setEditingTransaction(null);
    await loadData();
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTransaction(null);
  };

  const formatMoney = (value: string | number) => {
    const n = typeof value === 'string' ? parseFloat(value) : value;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Auth token for admin-only features (populated when a login flow saves it).
  const authToken = localStorage.getItem('pudim_token') || '';

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerInner} className="header-inner">
          <h1
            style={styles.logo}
            onClick={() => { setTab('dashboard'); setNavOpen(false); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setTab('dashboard'); setNavOpen(false); } }}
          >
            🏦 PudimFinance
          </h1>
          <button
            type="button"
            className="nav-toggle"
            aria-label="Toggle navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            {navOpen ? '✕' : '☰'}
          </button>
          <nav
            style={styles.nav}
            className={navOpen ? 'app-nav app-nav-open' : 'app-nav'}
            aria-label="Main navigation"
          >
            {([
              ['dashboard', 'Dashboard'],
              ['transactions', 'Transactions'],
              ['budgets', 'Budgets'],
              ['reports', 'Reports'],
              ['reconciliation', 'Reconciliation'],
              ['receipts', 'Receipts'],
              ['audit', 'Audit'],
              ['categories', 'Categories'],
            ] as [Tab, string][]).map(([key, label]) => (
              <button
                key={key}
                style={{ ...styles.navButton, ...(tab === key ? styles.navButtonActive : {}) }}
                aria-current={tab === key ? 'page' : undefined}
                onClick={() => { setTab(key); setNavOpen(false); }}
              >
                {label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            style={styles.themeToggle}
            onClick={toggleTheme}
            aria-label={themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {themeMode === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {error && (
          <div style={styles.errorBanner}>
            <p>{error}</p>
            <button onClick={loadData} style={styles.retryButton}>Retry</button>
          </div>
        )}

        {budgetAlert && (
          <div style={styles.budgetAlertBanner}>
            <p style={styles.budgetAlertText}>{budgetAlert}</p>
            <button style={styles.budgetAlertDismiss} onClick={() => setBudgetAlert(null)}>✕</button>
          </div>
        )}

        {loading && !error ? (
          <div aria-label="Loading" aria-busy="true">
            <div className="skeleton" style={{ height: 180, marginBottom: '2rem' }} />
            <div className="skeleton" style={{ height: 220, marginBottom: '2rem' }} />
            <div className="skeleton" style={{ height: 120 }} />
          </div>
        ) : tab === 'dashboard' ? (
          <div>
            <div style={styles.balanceCard}>
              <p style={styles.balanceLabel}>Current Balance</p>
              <h2 style={{
                ...styles.balanceValue,
                color: parseFloat(summary?.balance ?? '0') < 0 ? 'var(--color-expense)' : 'var(--color-income)',
              }}>
                {formatMoney(summary?.balance ?? '0')}
              </h2>
              <div style={styles.balanceRow}>
                <div style={styles.balanceItem}>
                  <p style={styles.balanceItemLabel}>Income</p>
                  <p style={{ ...styles.balanceItemValue, color: 'var(--color-income)' }}>
                    {formatMoney(summary?.income_total ?? '0')}
                  </p>
                </div>
                <div style={styles.balanceItem}>
                  <p style={styles.balanceItemLabel}>Expenses</p>
                  <p style={{ ...styles.balanceItemValue, color: 'var(--color-expense)' }}>
                    {formatMoney(summary?.expense_total ?? '0')}
                  </p>
                </div>
              </div>
            </div>

            {summary && summary.by_category.length > 0 && (
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Category Breakdown</h3>
                <div style={styles.categoryBars}>
                  {summary.by_category.slice(0, 8).map((cat) => (
                    <div key={cat.category_id || 'none'} style={styles.categoryBar}>
                      <div style={styles.categoryBarHeader}>
                        <span style={styles.categoryBarName}>
                          {cat.icon && <span style={styles.categoryIcon}>{cat.icon}</span>}
                          {cat.category_name || 'Uncategorised'}
                        </span>
                        <span style={styles.categoryBarTotal}>{formatMoney(cat.total)}</span>
                      </div>
                      <div style={styles.categoryBarTrack}>
                        <div style={{
                          ...styles.categoryBarFill,
                          width: `${Math.min(100, (parseFloat(cat.total) / Math.max(parseFloat(summary.income_total), parseFloat(summary.expense_total), 1)) * 100)}%`,
                          backgroundColor: cat.color || '#6366f1',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>Recent Transactions</h3>
                <button style={styles.viewAllButton} onClick={() => setTab('transactions')}>
                  View all →
                </button>
              </div>
              {transactions.length === 0 ? (
                <EmptyState
                  compact
                  icon="💸"
                  title="No transactions yet"
                  description="Add your first income or expense to start tracking your money."
                  actionLabel="+ Add Transaction"
                  onAction={() => {
                    setEditingTransaction(null);
                    setShowForm(true);
                  }}
                />
              ) : (
                <TransactionTable
                  transactions={transactions.slice(0, 8)}
                  categories={categories}
                  formatMoney={formatMoney}
                  onEdit={(t) => {
                    setEditingTransaction(t);
                    setShowForm(true);
                  }}
                  onDelete={() => loadData()}
                />
              )}
            </div>
          </div>
        ) : tab === 'budgets' ? (
          <BudgetManager categories={categories} formatMoney={formatMoney} />
        ) : tab === 'reports' ? (
          <ReportsDashboard formatMoney={formatMoney} />
        ) : tab === 'reconciliation' ? (
          <ReconciliationUpload formatMoney={formatMoney} />
        ) : tab === 'receipts' ? (
          <ReceiptScanner formatMoney={formatMoney} />
        ) : tab === 'audit' ? (
          <AuditDashboard token={authToken} />
        ) : tab === 'transactions' ? (
          <div>
            <div style={styles.pageHeader}>
              <h2 style={styles.pageTitle}>Transactions</h2>
              <button
                style={styles.primaryButton}
                onClick={() => {
                  setEditingTransaction(null);
                  setShowForm(true);
                }}
              >
                + Add Transaction
              </button>
            </div>

            {showForm && (
              <TransactionForm
                categories={categories}
                editing={editingTransaction}
                onCancel={handleCloseForm}
                onSaved={handleTransactionCreated}
              />
            )}

            {transactions.length === 0 ? (
              <div style={styles.section}>
                <EmptyState
                  icon="💸"
                  title="No transactions yet"
                  description="Every expense and income starts here — add your first one to see your balance come to life."
                  actionLabel="+ Add Transaction"
                  onAction={() => {
                    setEditingTransaction(null);
                    setShowForm(true);
                  }}
                />
              </div>
            ) : (
              <TransactionTable
                transactions={transactions}
                categories={categories}
                formatMoney={formatMoney}
                onEdit={(t) => {
                  setEditingTransaction(t);
                  setShowForm(true);
                }}
                onDelete={() => loadData()}
              />
            )}
          </div>
        ) : (
          <CategoryManager
            categories={categories}
            onCategoriesChanged={loadCategories}
          />
        )}
      </main>

      <footer style={styles.footer}>
        <p>PudimFinance • Personal finance tracking</p>
      </footer>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-text)',
  },
  header: {
    backgroundColor: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    padding: '0 2rem',
  },
  headerInner: {
    maxWidth: 1200,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 0',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  logo: {
    fontSize: '1.25rem',
    fontWeight: 700,
    cursor: 'pointer',
    margin: 0,
  },
  nav: {
    display: 'flex',
    flex: 1,
    justifyContent: 'center',
    gap: '0.25rem',
  },
  navButton: {
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    border: '1px solid transparent',
    background: 'transparent',
    color: 'var(--color-text-muted)',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  navButtonActive: {
    backgroundColor: 'var(--color-surface-hover)',
    color: 'var(--color-text)',
  },
  themeToggle: {
    background: 'transparent',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)',
    borderRadius: '0.5rem',
    padding: '0.375rem 0.625rem',
    fontSize: '1rem',
    lineHeight: 1,
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    maxWidth: 1200,
    width: '100%',
    margin: '0 auto',
    padding: '2rem',
  },
  footer: {
    padding: '1.5rem 2rem',
    textAlign: 'center',
    color: 'var(--color-text-dim)',
    fontSize: '0.875rem',
    borderTop: '1px solid var(--color-border)',
  },
  budgetAlertBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--color-warning-bg)',
    border: '1px solid var(--color-warning-border)',
    color: 'var(--color-warning-text)',
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    marginBottom: '1.5rem',
  },
  budgetAlertText: {
    margin: 0,
    fontSize: '0.875rem',
  },
  budgetAlertDismiss: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-warning-text)',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '0 0.25rem',
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
  loading: {
    textAlign: 'center',
    padding: '3rem 0',
    color: 'var(--color-text-dim)',
  },
  balanceCard: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '1.5rem',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-card)',
    marginBottom: '2rem',
  },
  balanceLabel: {
    color: 'var(--color-text-muted)',
    fontSize: '0.875rem',
    marginBottom: '0.25rem',
  },
  balanceValue: {
    fontSize: '2.5rem',
    fontWeight: 700,
    margin: '0 0 1rem 0',
    fontVariantNumeric: 'tabular-nums',
  },
  balanceRow: {
    display: 'flex',
    gap: '2rem',
  },
  balanceItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  balanceItemLabel: {
    color: 'var(--color-text-muted)',
    fontSize: '0.75rem',
    margin: 0,
  },
  balanceItemValue: {
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: 0,
    fontVariantNumeric: 'tabular-nums',
  },
  section: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '1.5rem',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-card)',
    marginBottom: '2rem',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    margin: 0,
  },
  viewAllButton: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-primary)',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  emptyText: {
    color: 'var(--color-text-dim)',
    textAlign: 'center',
    padding: '2rem 0',
  },
  categoryBars: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  categoryBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  categoryBarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.875rem',
  },
  categoryBarName: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  categoryIcon: {
    fontSize: '1rem',
  },
  categoryBarTotal: {
    color: 'var(--color-text-muted)',
    fontWeight: 500,
  },
  categoryBarTrack: {
    height: '0.5rem',
    borderRadius: '9999px',
    backgroundColor: 'var(--color-surface-hover)',
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: '9999px',
    transition: 'width 0.3s ease',
  },
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
};