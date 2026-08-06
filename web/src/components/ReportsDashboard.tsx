import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import {
  CategoryBreakdownResponse,
  fetchCategoryBreakdown,
  fetchMonthlyReport,
  fetchTrends,
  MonthlyReportResponse,
  TrendsResponse,
} from '../api';

type ReportTab = 'overview' | 'breakdown' | 'trends';

interface Props {
  formatMoney: (value: string | number) => string;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const CHART_COLORS = [
  '#22c55e', '#ef4444', '#3b82f6', '#eab308', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#14b8a6',
  '#6366f1', '#a3e635',
];

export function ReportsDashboard({ formatMoney }: Props) {
  const [tab, setTab] = useState<ReportTab>('overview');
  const [monthly, setMonthly] = useState<MonthlyReportResponse | null>(null);
  const [breakdown, setBreakdown] = useState<CategoryBreakdownResponse | null>(null);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [trendMonths, setTrendMonths] = useState(6);
  const [rangeLabel, setRangeLabel] = useState('Current month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const now = new Date();
      const endMonth = now.getMonth() + 1;
      const endYear = now.getFullYear();
      // Shift back 5 months to get 6-month window
      let startMonth = endMonth - 5;
      let startYear = endYear;
      if (startMonth <= 0) {
        startYear -= 1;
        startMonth += 12;
      }
      const data = await fetchMonthlyReport(startYear, startMonth, endYear, endMonth);
      setMonthly(data);
      const startLabel = `${MONTH_NAMES[startMonth - 1]}/${String(startYear).slice(2)}`;
      const endLabel = `${MONTH_NAMES[endMonth - 1]}/${String(endYear).slice(2)}`;
      setRangeLabel(`${startLabel} – ${endLabel}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monthly report');
    }
  }, []);

  const loadBreakdown = useCallback(async () => {
    try {
      // Current month period
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const today = now.toISOString().slice(0, 10);
      const data = await fetchCategoryBreakdown(firstDay, today);
      setBreakdown(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load category breakdown');
    }
  }, []);

  const loadTrends = useCallback(async (months: number) => {
    try {
      const data = await fetchTrends(months);
      setTrends(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trends');
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadOverview(), loadBreakdown(), loadTrends(trendMonths)]);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [loadOverview, loadBreakdown, loadTrends, trendMonths]);

  const trendData = (trends?.trends ?? []).map((t) => ({
    ...t,
    displayLabel: `${MONTH_NAMES[t.month - 1]} '${String(t.year).slice(2)}`,
  }));

  const breakdownPieData = (breakdown?.categories ?? []).map((c, i) => ({
    name: c.category_name || 'Uncategorised',
    value: parseFloat(c.total),
    color: c.color || CHART_COLORS[i % CHART_COLORS.length],
  }));

  const breakdownBarData = (breakdown?.categories ?? []).slice(0, 10).map((c, i) => ({
    name: c.category_name || 'Uncategorised',
    total: parseFloat(c.total),
    percentage: parseFloat(c.percentage),
    color: c.color || CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Reports & Insights</h2>
          <p style={styles.pageSubtitle}>{rangeLabel}</p>
        </div>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          <p>{error}</p>
          <button
            onClick={() => {
              setError(null);
              setTab(tab);
              if (tab === 'overview') loadOverview();
              else if (tab === 'breakdown') loadBreakdown();
              else loadTrends(trendMonths);
            }}
            style={styles.retryButton}
          >
            Retry
          </button>
        </div>
      )}

      <div style={styles.subNav}>
        {(['overview', 'breakdown', 'trends'] as ReportTab[]).map((t) => (
          <button
            key={t}
            style={{ ...styles.subNavButton, ...(tab === t ? styles.subNavButtonActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t === 'overview' ? 'Monthly Overview' : t === 'breakdown' ? 'Category Breakdown' : 'Trends'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={styles.loading}>
          <p>Loading reports…</p>
        </div>
      ) : (
        <>
          {tab === 'overview' && monthly && (
            <div>
              <div style={styles.overviewCards}>
                <div style={styles.overviewCard}>
                  <p style={styles.overviewLabel}>Total Income</p>
                  <p style={{ ...styles.overviewValue, color: '#22c55e' }}>
                    {formatMoney(monthly.months.reduce((sum, m) => sum + parseFloat(m.income_total), 0))}
                  </p>
                </div>
                <div style={styles.overviewCard}>
                  <p style={styles.overviewLabel}>Total Expenses</p>
                  <p style={{ ...styles.overviewValue, color: '#ef4444' }}>
                    {formatMoney(monthly.months.reduce((sum, m) => sum + parseFloat(m.expense_total), 0))}
                  </p>
                </div>
                <div style={styles.overviewCard}>
                  <p style={styles.overviewLabel}>Net</p>
                  <p style={{
                    ...styles.overviewValue,
                    color: monthly.months.reduce((sum, m) => sum + parseFloat(m.balance), 0) >= 0 ? '#22c55e' : '#ef4444',
                  }}>
                    {formatMoney(monthly.months.reduce((sum, m) => sum + parseFloat(m.balance), 0))}
                  </p>
                </div>
              </div>

              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Income vs Expenses by Month</h3>
                <div style={styles.chartContainer}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthly.months.map((m) => ({
                      ...m,
                      label: `${MONTH_NAMES[m.month - 1]} '${String(m.year).slice(2)}`,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                        labelStyle={{ color: '#e2e8f0' }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="income_total"
                        name="Income"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="expense_total"
                        name="Expenses"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="balance"
                        name="Balance"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="5 5"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Monthly Table</h3>
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Month</th>
                        <th style={styles.th} align="right">Income</th>
                        <th style={styles.th} align="right">Expenses</th>
                        <th style={styles.th} align="right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthly.months.map((m) => (
                        <tr key={`${m.year}-${m.month}`} style={styles.tr}>
                          <td style={styles.td}>
                            {MONTH_NAMES[m.month - 1]} {m.year}
                          </td>
                          <td style={{ ...styles.td, ...styles.numCell, color: '#22c55e' }}>
                            {formatMoney(m.income_total)}
                          </td>
                          <td style={{ ...styles.td, ...styles.numCell, color: '#ef4444' }}>
                            {formatMoney(m.expense_total)}
                          </td>
                          <td style={{ ...styles.td, ...styles.numCell, color: parseFloat(m.balance) >= 0 ? '#e2e8f0' : '#ef4444' }}>
                            {formatMoney(m.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'breakdown' && (
            <div>
              {breakdown && breakdown.categories.length === 0 ? (
                <div style={styles.emptyCard}>
                  <p style={styles.emptyText}>No expenses in this period yet.</p>
                </div>
              ) : (
                <>
                  <div style={styles.breakdownGrid}>
                    <div style={styles.section}>
                      <h3 style={styles.sectionTitle}>Spending by Category</h3>
                      <div style={styles.pieContainer}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={breakdownPieData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={110}
                              label={(entry: { name?: string; percent?: number }) =>
                                `${entry.name}: ${Math.round((entry.percent || 0) * 100)}%`
                              }
                            >
                              {breakdownPieData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                              labelStyle={{ color: '#e2e8f0' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div style={styles.section}>
                      <h3 style={styles.sectionTitle}>Top Categories (Bar)</h3>
                      <div style={styles.barList}>
                        {breakdownBarData.map((item) => (
                          <div key={item.name} style={styles.barRow}>
                            <div style={styles.barHeader}>
                              <span style={styles.barName}>{item.name}</span>
                              <span style={styles.barMeta}>
                                {formatMoney(item.total)}{' '}
                                <span style={styles.barPct}>({Math.round(item.percentage)}%)</span>
                              </span>
                            </div>
                            <div style={styles.barTrack}>
                              <div style={{ ...styles.barFill, width: `${Math.min(100, item.percentage)}%`, backgroundColor: item.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Detailed Breakdown</h3>
                    <div style={styles.tableWrapper}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Category</th>
                            <th style={styles.th} align="right">Transactions</th>
                            <th style={styles.th} align="right">Total</th>
                            <th style={styles.th} align="right">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(breakdown?.categories ?? []).map((c) => (
                            <tr key={c.category_id || 'none'} style={styles.tr}>
                              <td style={styles.td}>
                                {c.icon && <span style={styles.icon}>{c.icon} </span>}
                                {c.category_name || 'Uncategorised'}
                              </td>
                              <td style={{ ...styles.td, ...styles.numCell }}>{c.transaction_count}</td>
                              <td style={{ ...styles.td, ...styles.numCell }}>{formatMoney(c.total)}</td>
                              <td style={{ ...styles.td, ...styles.numCell }}>{Math.round(parseFloat(c.percentage))}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'trends' && (
            <div>
              <div style={styles.trendControls}>
                {[6, 12].map((m) => (
                  <button
                    key={m}
                    style={{ ...styles.trendButton, ...(trendMonths === m ? styles.trendButtonActive : {}) }}
                    onClick={() => setTrendMonths(m)}
                  >
                    Last {m} months
                  </button>
                ))}
              </div>

              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Monthly Trends</h3>
                <div style={styles.chartContainer}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="displayLabel" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }}
                        labelStyle={{ color: '#e2e8f0' }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="income_total"
                        name="Income"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="expense_total"
                        name="Expenses"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="net"
                        name="Net"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="5 5"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Trend Data</h3>
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Month</th>
                        <th style={styles.th} align="right">Income</th>
                        <th style={styles.th} align="right">Expenses</th>
                        <th style={styles.th} align="right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(trends?.trends ?? []).map((t) => (
                        <tr key={`${t.year}-${t.month}`} style={styles.tr}>
                          <td style={styles.td}>{MONTH_NAMES[t.month - 1]} {t.year}</td>
                          <td style={{ ...styles.td, ...styles.numCell, color: '#22c55e' }}>
                            {formatMoney(t.income_total)}
                          </td>
                          <td style={{ ...styles.td, ...styles.numCell, color: '#ef4444' }}>
                            {formatMoney(t.expense_total)}
                          </td>
                          <td style={{ ...styles.td, ...styles.numCell, color: parseFloat(t.net) >= 0 ? '#e2e8f0' : '#ef4444' }}>
                            {formatMoney(t.net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '1rem',
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
  subNav: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.5rem',
  },
  subNavButton: {
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    border: '1px solid #334155',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  subNavButtonActive: {
    backgroundColor: '#334155',
    color: '#e2e8f0',
  },
  loading: {
    textAlign: 'center',
    padding: '3rem 0',
    color: '#64748b',
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
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: '1rem',
    padding: '1.5rem',
    border: '1px solid #334155',
    marginBottom: '2rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    margin: '0 0 1rem 0',
  },
  chartContainer: {
    width: '100%',
    height: 300,
  },
  pieContainer: {
    width: '100%',
    height: 280,
  },
  breakdownGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  barList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  barRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  barHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.875rem',
  },
  barName: {
    color: '#e2e8f0',
  },
  barMeta: {
    color: '#94a3b8',
    fontSize: '0.8125rem',
  },
  barPct: {
    color: '#64748b',
  },
  barTrack: {
    height: '0.5rem',
    borderRadius: '9999px',
    backgroundColor: '#334155',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '9999px',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.625rem 0.75rem',
    color: '#94a3b8',
    fontWeight: 500,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #334155',
  },
  tr: {
    borderBottom: '1px solid #1e293b',
  },
  td: {
    padding: '0.625rem 0.75rem',
    color: '#e2e8f0',
  },
  numCell: {
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  icon: {
    fontSize: '0.875rem',
  },
  emptyCard: {
    backgroundColor: '#1e293b',
    borderRadius: '1rem',
    padding: '2rem',
    textAlign: 'center',
    border: '1px dashed #334155',
  },
  emptyText: {
    color: '#64748b',
  },
  trendControls: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.5rem',
  },
  trendButton: {
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    border: '1px solid #334155',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  trendButtonActive: {
    backgroundColor: '#334155',
    color: '#e2e8f0',
  },
};
