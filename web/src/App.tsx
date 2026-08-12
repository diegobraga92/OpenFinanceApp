import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useAuth } from './auth/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import {
  AccountWithBalance,
  Category,
  createTransaction,
  fetchAccountsWithBalance,
  fetchBudgetSummary,
  fetchCategories,
  fetchSummary,
  fetchTransactions,
  fetchTrends,
  SummaryResponse,
  Transaction,
  TrendsResponse,
} from './api';
import { TransactionForm } from './components/TransactionForm';
import { CategoryManager } from './components/CategoryManager';
import { AccountManager } from './components/AccountManager';
import { LedgerManager } from './components/LedgerManager';
import { TransactionTable } from './components/TransactionTable';
import { AuditDashboard } from './components/AuditDashboard';
import { BudgetManager } from './components/BudgetManager';
import { ReceiptScanner } from './components/ReceiptScanner';
import { ReconciliationUpload } from './components/ReconciliationUpload';
import { ReportsDashboard } from './components/ReportsDashboard';
import { InstallmentManager } from './components/InstallmentManager';
import { EmptyState } from './components/EmptyState';
import { useToast } from './components/Toast';
import { useTheme } from './theme/ThemeContext';

type Tab = 'dashboard' | 'transactions' | 'categories' | 'accounts' | 'ledger' | 'budgets' | 'reports' | 'reconciliation' | 'receipts' | 'audit' | 'installments';

const TABS: Tab[] = [
  'dashboard',
  'transactions',
  'accounts',
  'ledger',
  'budgets',
  'installments',
  'reports',
  'reconciliation',
  'receipts',
  'audit',
  'categories',
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const NAV_ITEMS: [Tab, string][] = [
  ['dashboard', 'Dashboard'],
  ['transactions', 'Transactions'],
  ['accounts', 'Accounts'],
  ['ledger', 'Ledger'],
  ['budgets', 'Budgets'],
  ['installments', 'Installments'],
  ['reports', 'Reports'],
  ['reconciliation', 'Reconciliation'],
  ['receipts', 'Receipts'],
  ['audit', 'Audit'],
  ['categories', 'Categories'],
];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [budgetAlert, setBudgetAlert] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const { toggle: toggleTheme, mode: themeMode } = useTheme();
  const { push: pushToast } = useToast();

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

  const loadAccounts = useCallback(async () => {
    try {
      const data = await fetchAccountsWithBalance();
      setAccounts(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
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
      const [cats, summ, txns, trnds, accnts] = await Promise.all([
        loadCategories(),
        fetchSummary(),
        loadTransactions(),
        fetchTrends(6).catch(() => null),
        fetchAccountsWithBalance().catch(() => [] as AccountWithBalance[]),
      ]);
      setCategories(cats);
      setSummary(summ);
      setTransactions(txns);
      setTrends(trnds);
      setAccounts(accnts);
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

  // Restore tab from URL hash (supports refresh + shareable links).
  useEffect(() => {
    const fromHash = window.location.hash.replace(/^#/, '') as Tab;
    if ((TABS as string[]).includes(fromHash)) setTab(fromHash);
  }, []);

  // Keep the URL hash in sync with the active tab.
  useEffect(() => {
    window.history.replaceState(null, '', `#${tab}`);
  }, [tab]);

  const exportTransactionsCsv = () => {
    if (transactions.length === 0) return;
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const rows = [
      ['Date', 'Type', 'Description', 'Category', 'Amount', 'Notes'],
      ...transactions.map((t) => [
        t.date,
        t.type,
        `"${t.description.replace(/"/g, '""')}"`,
        t.category_id && categoryById.get(t.category_id)
          ? `"${categoryById.get(t.category_id)!.name.replace(/"/g, '""')}"`
          : 'Uncategorised',
        t.amount,
        t.notes ? `"${t.notes.replace(/"/g, '""')}"` : '',
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    pushToast({ message: `Exported ${transactions.length} transactions` });
  };

  const handleTransactionCreated = async () => {
    setShowForm(false);
    setEditingTransaction(null);
    await loadData();
    pushToast({ message: 'Transaction saved' });
  };

  const handleTransactionDeleted = async (deleted: Transaction) => {
    await loadData();
    pushToast({
      message: `Transaction "${deleted.description}" deleted`,
      actionLabel: 'Undo',
      onAction: async () => {
        try {
          await createTransaction({
            description: deleted.description,
            amount: deleted.amount,
            type: deleted.type === 'income' ? 'income' : 'expense',
            category_id: deleted.category_id || null,
            date: deleted.date,
            notes: deleted.notes || null,
          });
          pushToast({ message: 'Transaction restored' });
          await loadData();
        } catch (err) {
          pushToast({ message: err instanceof Error ? err.message : 'Could not restore transaction' });
        }
      },
    });
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTransaction(null);
  };

  // Local search over the currently loaded transactions (description + category).
  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return transactions;
    const catById = new Map(categories.map((c) => [c.id, c]));
    return transactions.filter((t) => {
      if (t.description.toLowerCase().includes(q)) return true;
      const cat = t.category_id ? catById.get(t.category_id) : undefined;
      return (cat?.name.toLowerCase().includes(q) ?? false) || (cat?.icon?.toLowerCase().includes(q) ?? false);
    });
  }, [transactions, searchQuery, categories]);

  // --- Dashboard trend analytics (sparkline + month-over-month deltas) ---
  const sortedTrends = useMemo(() => {
    if (!trends?.trends || trends.trends.length < 2) return null;
    return [...trends.trends].sort((a, b) => a.year - b.year || a.month - b.month);
  }, [trends]);

  const sparkPoints = useMemo(() => {
    if (!sortedTrends) return null;
    let running = 0;
    return sortedTrends.map((t) => {
      running += parseFloat(t.net);
      return running;
    });
  }, [sortedTrends]);

  const monthDeltas = useMemo(() => {
    if (!sortedTrends) return null;
    const prev = sortedTrends[sortedTrends.length - 2];
    const curr = sortedTrends[sortedTrends.length - 1];
    const prevIncome = parseFloat(prev.income_total);
    const prevExpense = parseFloat(prev.expense_total);
    return {
      income: prevIncome > 0 ? (parseFloat(curr.income_total) - prevIncome) / prevIncome : 0,
      expense: prevExpense > 0 ? (parseFloat(curr.expense_total) - prevExpense) / prevExpense : 0,
    };
  }, [sortedTrends]);

  const renderDelta = (delta: number | undefined, inverse = false) => {
    if (delta === undefined || !isFinite(delta) || delta === 0) {
      return <span style={styles.deltaNeutral}>—</span>;
    }
    const positive = inverse ? delta < 0 : delta > 0;
    return (
      <span style={positive ? styles.deltaUp : styles.deltaDown}>
        {delta > 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))}%
      </span>
    );
  };

  const formatMoney = (value: string | number) => {
    const n = typeof value === 'string' ? parseFloat(value) : value;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Auth session: user + token come from AuthContext; the API layer attaches
  // the Bearer token automatically and refreshes it on expiry.
  const { user, token: authToken, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div aria-label="Loading" aria-busy="true" style={styles.loadingScreen}>
          <div className="skeleton" style={{ height: 180, marginBottom: '2rem' }} />
          <div className="skeleton" style={{ height: 220 }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={styles.container}>
        <LoginScreen />
      </div>
    );
  }

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
            {navOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
          <nav
            style={styles.nav}
            className={navOpen ? 'app-nav app-nav-open' : 'app-nav'}
            aria-label="Main navigation"
          >
            {NAV_ITEMS.map(([key, label], i) => (
              <span key={key} style={styles.navItem}>
                {i === 4 && <span className="nav-divider" style={styles.navDivider} aria-hidden="true" />}
                <button
                  style={{ ...styles.navButton, ...(tab === key ? styles.navButtonActive : {}) }}
                  aria-current={tab === key ? 'page' : undefined}
                  onClick={() => { setTab(key); setNavOpen(false); }}
                >
                  {label}
                </button>
              </span>
            ))}
          </nav>
          <div style={styles.headerActions}>
            {user && (
              <button
                type="button"
                style={styles.logoutButton}
                onClick={logout}
                title={`Signed in as ${user.email} — click to sign out`}
              >
                <span style={styles.logoutEmail}>{user.email}</span>
                <span aria-hidden="true">⏻</span>
              </button>
            )}
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
            <div className="section" style={styles.balanceCard}>
              <div style={styles.balanceHeader}>
                <div>
                  <p style={styles.balanceLabel}>Current Balance</p>
                  <p style={styles.balanceMonth}>
                    {MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()}
                  </p>
                </div>
                {sparkPoints && sparkPoints.length > 1 && (
                  <svg
                    width="110"
                    height="44"
                    viewBox="0 0 110 44"
                    role="img"
                    aria-label="Balance trend over the last 6 months"
                    style={styles.sparkline}
                  >
                    <polyline
                      points={(() => {
                        const min = Math.min(...sparkPoints);
                        const max = Math.max(...sparkPoints);
                        const range = max - min || 1;
                        return sparkPoints
                          .map((v, i) => {
                            const x = 2 + (i / (sparkPoints.length - 1)) * 106;
                            const y = 2 + (1 - (v - min) / range) * 40;
                            return `${x},${y}`;
                          })
                          .join(' ');
                      })()}
                      fill="none"
                      stroke={sparkPoints[sparkPoints.length - 1] >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </div>
              <h2 style={{
                ...styles.balanceValue,
                color: parseFloat(summary?.balance ?? '0') < 0 ? 'var(--color-expense)' : 'var(--color-income)',
              }}>
                {formatMoney(summary?.balance ?? '0')}
              </h2>
              <div style={styles.balanceRow}>
                <div style={styles.balanceItem}>
                  <p style={styles.balanceItemLabel}>
                    Income {monthDeltas && renderDelta(monthDeltas.income)}
                  </p>
                  <p style={{ ...styles.balanceItemValue, color: 'var(--color-income)' }}>
                    {formatMoney(summary?.income_total ?? '0')}
                  </p>
                </div>
                <div style={styles.balanceItem}>
                  <p style={styles.balanceItemLabel}>
                    Expenses {monthDeltas && renderDelta(monthDeltas.expense, true)}
                  </p>
                  <p style={{ ...styles.balanceItemValue, color: 'var(--color-expense)' }}>
                    {formatMoney(summary?.expense_total ?? '0')}
                  </p>
                </div>
              </div>
            </div>

            {summary && summary.by_category.length > 0 && (
              <div className="section" style={styles.section}>
                <h3 style={styles.sectionTitle}>Category Breakdown</h3>
                <div style={styles.categoryBars}>
                  {summary.by_category.slice(0, 8).map((cat) => (
                    <div key={cat.category_id || 'none'} style={styles.categoryBar}>
                      <div style={styles.categoryBarHeader}>
                        <span style={styles.categoryBarName}>
                          {cat.icon && <span style={styles.categoryIcon}>{cat.icon}</span>}
                          {cat.category_name || 'Uncategorised'}
                        </span>
                        <span style={styles.categoryBarTotal}>
                          {formatMoney(cat.total)}
                          <span style={styles.categoryBarPct}>
                            {' '}
                            {Math.round(
                              (parseFloat(cat.total) / Math.max(parseFloat(summary.income_total), parseFloat(summary.expense_total), 1)) * 100,
                            )}%
                          </span>
                        </span>
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

            <div className="section" style={styles.section}>
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
                  onDelete={(t) => handleTransactionDeleted(t)}
                />
              )}
            </div>
          </div>
        ) : tab === 'budgets' ? (
          <BudgetManager categories={categories} formatMoney={formatMoney} />
        ) : tab === 'installments' ? (
          <InstallmentManager categories={categories} formatMoney={formatMoney} />
        ) : tab === 'reports' ? (
          <ReportsDashboard formatMoney={formatMoney} />
        ) : tab === 'reconciliation' ? (
          <ReconciliationUpload formatMoney={formatMoney} />
        ) : tab === 'receipts' ? (
          <ReceiptScanner formatMoney={formatMoney} />
        ) : tab === 'audit' ? (
          <AuditDashboard token={authToken} />
        ) : tab === 'accounts' ? (
          <AccountManager
            accounts={accounts}
            onAccountsChanged={loadAccounts}
          />
        ) : tab === 'ledger' ? (
          <LedgerManager formatMoney={formatMoney} />
        ) : tab === 'transactions' ? (
          <div>
            <div style={styles.pageHeader}>
              <h2 style={styles.pageTitle}>Transactions</h2>
              <div style={styles.pageActions}>
                <div style={styles.searchWrap}>
                  <input
                    type="search"
                    style={styles.searchInput}
                    placeholder="Search transactions…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search transactions"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      style={styles.searchClear}
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={exportTransactionsCsv}
                  disabled={transactions.length === 0}
                  title={transactions.length === 0 ? 'No transactions to export' : 'Download CSV'}
                >
                  ⬇ Export CSV
                </button>
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
              <div className="section" style={styles.section}>
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
            ) : filteredTransactions.length === 0 ? (
              <div className="section" style={styles.section}>
                <EmptyState
                  icon="🔍"
                  title="No matches"
                  description={`No transactions match "${searchQuery}". Try a different search.`}
                  actionLabel="Clear search"
                  onAction={() => setSearchQuery('')}
                />
              </div>
            ) : (
              <TransactionTable
                transactions={filteredTransactions}
                categories={categories}
                formatMoney={formatMoney}
                onEdit={(t) => {
                  setEditingTransaction(t);
                  setShowForm(true);
                }}
                onDelete={(t) => handleTransactionDeleted(t)}
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
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  navDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'var(--color-border)',
    margin: '0.375rem 0.375rem',
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
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  logoutButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'transparent',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)',
    borderRadius: '0.5rem',
    padding: '0.375rem 0.625rem',
    fontSize: '0.8125rem',
    cursor: 'pointer',
    maxWidth: 220,
  },
  logoutEmail: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
  loadingScreen: {
    padding: '2rem',
  },
  balanceCard: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '1.5rem',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-card)',
    marginBottom: '2rem',
  },
  balanceHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  balanceLabel: {
    color: 'var(--color-text-muted)',
    fontSize: '0.875rem',
    marginBottom: '0.25rem',
  },
  balanceMonth: {
    color: 'var(--color-text-dim)',
    fontSize: '0.75rem',
    margin: 0,
  },
  sparkline: {
    opacity: 0.85,
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
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  deltaUp: {
    color: 'var(--color-income)',
    fontSize: '0.6875rem',
    fontWeight: 600,
  },
  deltaDown: {
    color: 'var(--color-expense)',
    fontSize: '0.6875rem',
    fontWeight: 600,
  },
  deltaNeutral: {
    color: 'var(--color-text-dim)',
    fontSize: '0.6875rem',
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
  categoryBarPct: {
    color: 'var(--color-text-dim)',
    fontWeight: 400,
    fontSize: '0.75rem',
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
  pageActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  searchWrap: {
    position: 'relative',
    flex: 1,
    minWidth: 220,
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
    lineHeight: 1,
  },
  pageTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
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