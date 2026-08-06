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
import { BudgetManager } from './components/BudgetManager';
import { ReconciliationUpload } from './components/ReconciliationUpload';
import { ReportsDashboard } from './components/ReportsDashboard';

type Tab = 'dashboard' | 'transactions' | 'categories' | 'budgets' | 'reports' | 'reconciliation';

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
      const over = items.find((i) => parseFloat(i.percentage) >= 80);
      if (over) {
        const pct = Math.round(parseFloat(over.percentage));
        setBudgetAlert(
          `⚠️ You've spent ${pct}% of your ${over.budget.category_name} budget this month`
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

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <h1 style={styles.logo} onClick={() => setTab('dashboard')} role="button" tabIndex={0}>
            🏦 PudimFinance
          </h1>
          <nav style={styles.nav}>
            <button
              style={{ ...styles.navButton, ...(tab === 'dashboard' ? styles.navButtonActive : {}) }}
              onClick={() => setTab('dashboard')}
            >
              Dashboard
            </button>
            <button
              style={{ ...styles.navButton, ...(tab === 'transactions' ? styles.navButtonActive : {}) }}
              onClick={() => setTab('transactions')}
            >
              Transactions
            </button>
            <button
              style={{ ...styles.navButton, ...(tab === 'budgets' ? styles.navButtonActive : {}) }}
              onClick={() => setTab('budgets')}
            >
              Budgets
            </button>
            <button
              style={{ ...styles.navButton, ...(tab === 'reports' ? styles.navButtonActive : {}) }}
              onClick={() => setTab('reports')}
            >
              Reports
            </button>
            <button
              style={{ ...styles.navButton, ...(tab === 'reconciliation' ? styles.navButtonActive : {}) }}
              onClick={() => setTab('reconciliation')}
            >
              Reconciliation
            </button>
            <button
              style={{ ...styles.navButton, ...(tab === 'categories' ? styles.navButtonActive : {}) }}
              onClick={() => setTab('categories')}
            >
              Categories
            </button>
          </nav>
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
          <div style={styles.loading}>
            <p>Loading…</p>
          </div>
        ) : tab === 'dashboard' ? (
          <div>
            <div style={styles.balanceCard}>
              <p style={styles.balanceLabel}>Current Balance</p>
              <h2 style={{
                ...styles.balanceValue,
                color: parseFloat(summary?.balance ?? '0') < 0 ? '#ef4444' : '#22c55e',
              }}>
                {formatMoney(summary?.balance ?? '0')}
              </h2>
              <div style={styles.balanceRow}>
                <div style={styles.balanceItem}>
                  <p style={styles.balanceItemLabel}>Income</p>
                  <p style={{ ...styles.balanceItemValue, color: '#22c55e' }}>
                    {formatMoney(summary?.income_total ?? '0')}
                  </p>
                </div>
                <div style={styles.balanceItem}>
                  <p style={styles.balanceItemLabel}>Expenses</p>
                  <p style={{ ...styles.balanceItemValue, color: '#ef4444' }}>
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
                <p style={styles.emptyText}>No transactions yet.</p>
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
              <p style={styles.emptyText}>No transactions yet. Add your first one!</p>
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
        <p>PudimFinance • Layer 2: Budgets, Reports & Insights</p>
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
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
  },
  header: {
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
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
    gap: '0.5rem',
  },
  navButton: {
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    border: '1px solid transparent',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  navButtonActive: {
    backgroundColor: '#334155',
    color: '#e2e8f0',
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
    color: '#64748b',
    fontSize: '0.875rem',
    borderTop: '1px solid #1e293b',
  },
  budgetAlertBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#451a03',
    border: '1px solid #b45309',
    color: '#fbbf24',
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
    color: '#fbbf24',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '0 0.25rem',
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
  loading: {
    textAlign: 'center',
    padding: '3rem 0',
    color: '#64748b',
  },
  balanceCard: {
    backgroundColor: '#1e293b',
    borderRadius: '1rem',
    padding: '1.5rem',
    border: '1px solid #334155',
    marginBottom: '2rem',
  },
  balanceLabel: {
    color: '#94a3b8',
    fontSize: '0.875rem',
    marginBottom: '0.25rem',
  },
  balanceValue: {
    fontSize: '2.5rem',
    fontWeight: 700,
    margin: '0 0 1rem 0',
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
    color: '#94a3b8',
    fontSize: '0.75rem',
    margin: 0,
  },
  balanceItemValue: {
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: 0,
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: '1rem',
    padding: '1.5rem',
    border: '1px solid #334155',
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
    color: '#22c55e',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  emptyText: {
    color: '#64748b',
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
    color: '#94a3b8',
    fontWeight: 500,
  },
  categoryBarTrack: {
    height: '0.5rem',
    borderRadius: '9999px',
    backgroundColor: '#334155',
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
    backgroundColor: '#22c55e',
    color: '#0f172a',
    border: 'none',
    padding: '0.625rem 1.25rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};