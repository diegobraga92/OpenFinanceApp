import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BudgetSummaryItem,
  BudgetSummaryResponse,
  Category,
  CategoryBreakdownResponse,
  ReconciliationUploadResponse,
  Transaction,
  SummaryResponse,
  createBudget,
  createCategory,
  createTransaction,
  deleteBudget,
  deleteTransaction,
  fetchBudgetSummary,
  fetchCategories,
  fetchCategoryBreakdown,
  fetchMonthlyReport,
  fetchSummary,
  fetchTransactions,
  MonthlyReportResponse,
  updateTransaction,
  uploadReconciliation,
} from './src/api';
import { colors } from './src/theme/tokens';
import { DonutChart } from './src/components/DonutChart';
import { TrendChart } from './src/components/TrendChart';
import DateTimePicker from '@react-native-community/datetimepicker';

type Screen = 'dashboard' | 'transactions' | 'budgets' | 'reports' | 'reconciliation' | 'categories';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CATEGORY_ICONS = [
  'briefcase', 'laptop', 'trending-up', 'gift', 'plus-circle',
  'shopping-cart', 'home', 'car', 'zap', 'film', 'heart', 'book',
  'shopping-bag', 'plane', 'repeat', 'shield', 'more-horizontal',
];

const CATEGORY_COLORS = [
  '#22c55e', '#16a34a', '#15803d', '#a3e635', '#86efac',
  '#ef4444', '#dc2626', '#b91c1c', '#f97316', '#eab308',
  '#ec4899', '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4',
  '#14b8a6', '#84cc16', '#6b7280',
];

const DRAWER_WIDTH = 280;

export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);

  // Add transaction form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Budget states
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummaryResponse | null>(null);
  const [budgetMonth, setBudgetMonth] = useState(new Date().getMonth() + 1);
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear());
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetSummaryItem | null>(null);
  const [budgetCategoryId, setBudgetCategoryId] = useState('');
  const [budgetAmountLimit, setBudgetAmountLimit] = useState('');

  // Reports states
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReportResponse | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownResponse | null>(null);

  // Categories states
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');
  const [newCatIcon, setNewCatIcon] = useState('shopping-cart');
  const [newCatColor, setNewCatColor] = useState('#6366f1');

  // Reconciliation states
  const [reconStatementName, setReconStatementName] = useState('Bank Statement');
  const [reconCsv, setReconCsv] = useState('');
  const [reconResult, setReconResult] = useState<ReconciliationUploadResponse | null>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconError, setReconError] = useState<string | null>(null);

  // Toggle drawer
  useEffect(() => {
    Animated.timing(drawerAnim, {
      toValue: drawerOpen ? 0 : -DRAWER_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [drawerOpen, drawerAnim]);

  const navigate = (s: Screen) => {
    setScreen(s);
    setDrawerOpen(false);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, summ, txns] = await Promise.all([
        fetchCategories(),
        fetchSummary(),
        fetchTransactions({ page_size: 50 }),
      ]);
      setCategories(cats);
      setSummary(summ);
      setTransactions(txns.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBudgets = useCallback(async () => {
    try {
      const data = await fetchBudgetSummary(budgetYear, budgetMonth);
      setBudgetSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budgets');
    }
  }, [budgetYear, budgetMonth]);

  const loadReports = useCallback(async () => {
    try {
      const now = new Date();
      const endMonth = now.getMonth() + 1;
      const endYear = now.getFullYear();
      let startMonth = endMonth - 5;
      let startYear = endYear;
      if (startMonth <= 0) {
        startYear -= 1;
        startMonth += 12;
      }
      const [monthly, breakdown] = await Promise.all([
        fetchMonthlyReport(startYear, startMonth, endYear, endMonth),
        fetchCategoryBreakdown(
          new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
          now.toISOString().slice(0, 10),
        ),
      ]);
      setMonthlyReport(monthly);
      setCategoryBreakdown(breakdown);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (screen === 'budgets') loadBudgets();
    if (screen === 'reports') loadReports();
  }, [screen, loadBudgets, loadReports]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
      if (screen === 'budgets') await loadBudgets();
      if (screen === 'reports') await loadReports();
    } finally {
      setRefreshing(false);
    }
  }, [screen, loadData, loadBudgets, loadReports]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.textMuted}
      colors={[colors.primary]}
      progressBackgroundColor={colors.surface}
    />
  );

  const formatMoney = (value: string | number) => {
    const n = typeof value === 'string' ? parseFloat(value) : value;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  /** Format an ISO date (YYYY-MM-DD) as DD/MM/YYYY for display. */
  const formatDateDisplay = (iso: string) => {
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  };

  /** Build an ISO date string from a local Date (avoids UTC off-by-one). */
  const toIsoDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  // Transaction form helpers
  const resetForm = () => {
    setDescription('');
    setAmount('');
    setType('expense');
    setCategoryId('');
    setDate(new Date().toISOString().slice(0, 10));
    setEditing(null);
    setShowAddForm(false);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Validation', 'Description is required');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Validation', 'Amount must be greater than zero');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        description: description.trim(),
        amount,
        type,
        category_id: categoryId || null,
        date,
        notes: null,
      };
      if (editing) {
        await updateTransaction(editing.id, payload);
      } else {
        await createTransaction(payload);
      }
      resetForm();
      setScreen('transactions');
      await loadData();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Transaction', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTransaction(id);
            await loadData();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete');
          }
        },
      },
    ]);
  };

  const handleEdit = (t: Transaction) => {
    setEditing(t);
    setDescription(t.description);
    setAmount(String(t.amount));
    setType(t.type === 'income' ? 'income' : 'expense');
    setCategoryId(t.category_id || '');
    setDate(t.date);
    setShowAddForm(true);
  };

  // Budget helpers
  const prevBudgetMonth = () => {
    if (budgetMonth === 1) {
      setBudgetMonth(12);
      setBudgetYear(budgetYear - 1);
    } else {
      setBudgetMonth(budgetMonth - 1);
    }
  };

  const nextBudgetMonth = () => {
    if (budgetMonth === 12) {
      setBudgetMonth(1);
      setBudgetYear(budgetYear + 1);
    } else {
      setBudgetMonth(budgetMonth + 1);
    }
  };

  const openBudgetCreate = () => {
    setEditingBudget(null);
    setBudgetCategoryId('');
    setBudgetAmountLimit('');
    setShowBudgetForm(true);
  };

  const openBudgetEdit = (item: BudgetSummaryItem) => {
    setEditingBudget(item);
    setBudgetCategoryId(item.budget.category_id);
    setBudgetAmountLimit(String(item.budget.amount_limit));
    setShowBudgetForm(true);
  };

  const handleBudgetSubmit = async () => {
    if (!budgetCategoryId) {
      Alert.alert('Validation', 'Select a category');
      return;
    }
    if (!budgetAmountLimit || parseFloat(budgetAmountLimit) <= 0) {
      Alert.alert('Validation', 'Amount limit must be greater than zero');
      return;
    }

    setSaving(true);
    try {
      await createBudget({
        category_id: budgetCategoryId,
        month: budgetMonth,
        year: budgetYear,
        amount_limit: budgetAmountLimit,
      });
      setShowBudgetForm(false);
      await loadBudgets();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  const handleBudgetDelete = (id: string) => {
    Alert.alert('Delete Budget', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBudget(id);
            await loadBudgets();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete budget');
          }
        },
      },
    ]);
  };

  // Reconciliation helper
  const handleReconSubmit = async () => {
    setReconError(null);
    setReconResult(null);
    if (!reconCsv.trim()) {
      setReconError('CSV data is required');
      return;
    }
    setReconLoading(true);
    try {
      // Minimal client-side CSV parse
      const rows = reconCsv
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#'))
        .map((line) => {
          const parts = line.split(',');
          return {
            date: (parts[0] || '').trim(),
            description: (parts[1] || '').trim(),
            amount: (parts[2] || '').trim(),
          };
        })
        .filter((r) => r.date && r.description && r.amount);

      if (rows.length === 0) {
        setReconError('CSV is empty or malformed. Expected date,description,amount');
        return;
      }

      const res = await uploadReconciliation({
        statement_name: reconStatementName.trim() || 'Bank Statement',
        lines: rows,
      });
      setReconResult(res);
    } catch (err) {
      setReconError(err instanceof Error ? err.message : 'Failed to upload reconciliation');
    } finally {
      setReconLoading(false);
    }
  };

  // Category helpers
  const handleCategorySubmit = async () => {
    if (!newCatName.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    setSaving(true);
    try {
      await createCategory({
        name: newCatName.trim(),
        type: newCatType,
        icon: newCatIcon,
        color: newCatColor,
      });
      setShowCategoryForm(false);
      setNewCatName('');
      setNewCatType('expense');
      setNewCatIcon('shopping-cart');
      setNewCatColor('#6366f1');
      await loadData();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  // Render helpers
  const renderTransactionRow = (t: Transaction) => {
    const cat = t.category_id ? categoryById.get(t.category_id) : undefined;
    const isIncome = t.type === 'income';
    return (
      <View key={t.id} style={styles.transactionRow}>
        <View style={styles.transactionLeft}>
          {cat && (
            <View style={[styles.categoryIconCircle, { backgroundColor: cat.color || colors.surfaceHover }]}>
              <Text style={styles.categoryIconText}>{cat.icon || '•'}</Text>
            </View>
          )}
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionDescription}>{t.description}</Text>
            <Text style={styles.transactionMeta}>
              {cat?.name || 'Uncategorised'} • {t.date}
            </Text>
          </View>
        </View>
        <View>
          <Text style={[styles.transactionAmount, { color: isIncome ? colors.primary : colors.danger }]}>
            {isIncome ? '+' : '-'}{formatMoney(t.amount)}
          </Text>
        </View>
        <View style={styles.transactionActions}>
          <TouchableOpacity onPress={() => handleEdit(t)} style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(t.id)} style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>Del</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderDashboard = () => (
    <ScrollView style={styles.content} refreshControl={refreshControl}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text style={[styles.balanceValue, { color: parseFloat(summary?.balance || '0') < 0 ? colors.danger : colors.primary }]}>
          {formatMoney(summary?.balance || '0')}
        </Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>Income</Text>
            <Text style={[styles.balanceItemValue, { color: colors.primary }]}>
              {formatMoney(summary?.income_total || '0')}
            </Text>
          </View>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>Expenses</Text>
            <Text style={[styles.balanceItemValue, { color: colors.danger }]}>
              {formatMoney(summary?.expense_total || '0')}
            </Text>
          </View>
        </View>
      </View>

      {summary && summary.by_category.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Breakdown</Text>
          {summary.by_category.slice(0, 5).map((cat) => (
            <View key={cat.category_id || 'none'} style={styles.categoryRow}>
              <View style={styles.categoryLabelRow}>
                <Text style={styles.categoryName}>
                  {cat.icon ? `${cat.icon} ` : ''}{cat.category_name || 'Uncategorised'}
                </Text>
                <Text style={styles.categoryTotal}>{formatMoney(cat.total)}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, (parseFloat(cat.total) / Math.max(parseFloat(summary.income_total), parseFloat(summary.expense_total), 1)) * 100)}%`,
                    backgroundColor: cat.color || '#6366f1',
                  },
                ]} />
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {transactions.length === 0 ? (
          <View style={styles.dashboardEmpty}>
            <Text style={styles.dashboardEmptyIcon}>💸</Text>
            <Text style={styles.dashboardEmptyTitle}>No transactions yet</Text>
            <Text style={styles.dashboardEmptyDesc}>
              Add your first income or expense to start tracking your money.
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                resetForm();
                setShowAddForm(true);
              }}
            >
              <Text style={styles.addButtonText}>+ Add Transaction</Text>
            </TouchableOpacity>
          </View>
        ) : (
          transactions.slice(0, 5).map((t) => renderTransactionRow(t))
        )}
      </View>
    </ScrollView>
  );

  const renderTransactions = () => (
    <View style={styles.content}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Transactions</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setShowAddForm(true);
          }}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      {transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No transactions yet.</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              resetForm();
              setShowAddForm(true);
            }}
          >
            <Text style={styles.addButtonText}>Add your first one</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderTransactionRow(item)}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={refreshControl}
        />
      )}
    </View>
  );

  const renderBudgets = () => (
    <ScrollView style={styles.content} refreshControl={refreshControl}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Budgets</Text>
        <TouchableOpacity style={styles.addButton} onPress={openBudgetCreate}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity style={styles.navButton} onPress={prevBudgetMonth}>
          <Text style={styles.navButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTHS[budgetMonth - 1]} {budgetYear}</Text>
        <TouchableOpacity style={styles.navButton} onPress={nextBudgetMonth}>
          <Text style={styles.navButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      {!budgetSummary ? (
        <Text style={styles.emptyText}>Loading budgets…</Text>
      ) : budgetSummary.items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No budgets for {MONTHS[budgetMonth - 1]} {budgetYear}.</Text>
          <Text style={styles.emptySubtext}>Tap "+ Add" to set your first spending limit.</Text>
        </View>
      ) : (
        <>
          <View style={styles.overviewCards}>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewLabel}>Budgeted</Text>
              <Text style={styles.overviewValue}>{formatMoney(budgetSummary.total_budgeted)}</Text>
            </View>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewLabel}>Spent</Text>
              <Text style={[styles.overviewValue, { color: colors.danger }]}>
                {formatMoney(budgetSummary.total_spent)}
              </Text>
            </View>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewLabel}>Remaining</Text>
              <Text style={[
                styles.overviewValue,
                {
                  color: parseFloat(budgetSummary.total_budgeted) - parseFloat(budgetSummary.total_spent) >= 0
                    ? colors.primary
                    : colors.danger,
                },
              ]}>
                {formatMoney(parseFloat(budgetSummary.total_budgeted) - parseFloat(budgetSummary.total_spent))}
              </Text>
            </View>
          </View>

          {budgetSummary.items.map((item) => {
            const pct = parseFloat(item.percentage);
            const color = pct >= 100 ? colors.danger : pct >= 80 ? colors.warning : colors.primary;
            return (
              <View key={item.budget.id} style={styles.budgetCard}>
                <View style={styles.budgetHeader}>
                  <View style={styles.budgetCategoryRow}>
                    <View style={[styles.categoryIconCircle, { backgroundColor: item.budget.color || colors.surfaceHover }]}>
                      <Text style={styles.categoryIconText}>{item.budget.icon || '•'}</Text>
                    </View>
                    <Text style={styles.budgetCategoryName}>{item.budget.category_name}</Text>
                    {pct >= 80 && (
                      <View style={[styles.warningBadge, { backgroundColor: pct >= 100 ? colors.dangerBg : colors.warningBg }]}>
                        <Text style={{ color: pct >= 100 ? colors.danger : colors.warningText, fontSize: 10, fontWeight: '600' }}>
                          {pct >= 100 ? 'OVER' : 'WARN'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.budgetItemActions}>
                    <TouchableOpacity onPress={() => openBudgetEdit(item)} style={styles.editButton}>
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleBudgetDelete(item.budget.id)} style={styles.deleteButton}>
                      <Text style={styles.deleteButtonText}>Del</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, pct)}%`, backgroundColor: color }]} />
                </View>

                <View style={styles.budgetMetaRow}>
                  <Text style={styles.budgetMetaText}>
                    {formatMoney(item.actual_spent)} of {formatMoney(item.budget.amount_limit)}
                  </Text>
                  <Text style={[styles.budgetPctText, { color }]}>{Math.round(pct)}%</Text>
                </View>

                <View>
                  {parseFloat(item.remaining) >= 0 ? (
                    <Text style={styles.remainingText}>{formatMoney(item.remaining)} remaining</Text>
                  ) : (
                    <Text style={styles.overText}>
                      {formatMoney(Math.abs(parseFloat(item.remaining)))} over budget
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );

  const renderReports = () => {
    const totalIncome = (monthlyReport?.months ?? []).reduce((s, m) => s + parseFloat(m.income_total), 0);
    const totalExpense = (monthlyReport?.months ?? []).reduce((s, m) => s + parseFloat(m.expense_total), 0);
    const net = totalIncome - totalExpense;
    const chartWidth = Dimensions.get('window').width - 64;

    const donutData = (categoryBreakdown?.categories ?? [])
      .slice(0, 6)
      .map((c) => ({
        label: c.category_name || 'Uncategorised',
        value: parseFloat(c.total),
        color: c.color || '#6366f1',
      }));
    const totalSpent = donutData.reduce((s, d) => s + d.value, 0);

    const trendData = (monthlyReport?.months ?? []).map((m) => ({
      label: `${SHORT_MONTHS[m.month - 1]}/${String(m.year).slice(2)}`,
      income: parseFloat(m.income_total),
      expense: parseFloat(m.expense_total),
    }));

    const maxBreakdown = Math.max(
      1,
      ...(categoryBreakdown?.categories ?? []).slice(0, 8).map((c) => parseFloat(c.percentage)),
    );

    return (
      <ScrollView style={styles.content} refreshControl={refreshControl}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Reports</Text>
        </View>

        <View style={styles.overviewCards}>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewLabel}>Income</Text>
            <Text style={[styles.overviewValue, { color: colors.primary }]}>{formatMoney(totalIncome)}</Text>
          </View>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewLabel}>Expenses</Text>
            <Text style={[styles.overviewValue, { color: colors.danger }]}>{formatMoney(totalExpense)}</Text>
          </View>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewLabel}>Net</Text>
            <Text style={[styles.overviewValue, { color: net >= 0 ? colors.primary : colors.danger }]}>{formatMoney(net)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Spending (This Month)</Text>
          {(categoryBreakdown?.categories ?? []).length === 0 ? (
            <Text style={styles.emptyText}>No expenses this month.</Text>
          ) : (
            <>
              <View style={styles.chartArea}>
                <DonutChart
                  data={donutData}
                  centerValue={formatMoney(totalSpent)}
                  centerLabel="Spent"
                />
              </View>
              <View style={styles.donutLegend}>
                {donutData.map((d) => (
                  <View key={d.label} style={styles.legendRow}>
                    <View style={[styles.legendSwatch, { backgroundColor: d.color }]} />
                    <Text style={styles.legendLabel} numberOfLines={1}>
                      {d.label}
                    </Text>
                    <Text style={styles.legendValue}>
                      {totalSpent > 0 ? `${Math.round((d.value / totalSpent) * 100)}%` : '0%'}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
          {(categoryBreakdown?.categories ?? []).length > 0 && (
            (categoryBreakdown?.categories ?? []).slice(0, 8).map((c) => (
              <View key={c.category_id || 'none'} style={styles.categoryRow}>
                <View style={styles.categoryLabelRow}>
                  <Text style={styles.categoryName}>
                    {c.icon ? `${c.icon} ` : ''}{c.category_name || 'Uncategorised'}
                  </Text>
                  <Text style={styles.categoryTotal}>
                    {formatMoney(c.total)} ({Math.round(parseFloat(c.percentage))}%)
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[
                    styles.progressFill,
                    {
                      width: `${(parseFloat(c.percentage) / maxBreakdown) * 100}%`,
                      backgroundColor: c.color || '#6366f1',
                    },
                  ]} />
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Income vs Expenses</Text>
          {(monthlyReport?.months ?? []).length === 0 ? (
            <Text style={styles.emptyText}>No monthly data yet.</Text>
          ) : (
            <>
              <View style={styles.chartArea}>
                <TrendChart data={trendData} width={chartWidth} formatValue={formatMoney} />
              </View>
              {(monthlyReport?.months ?? []).map((m) => {
                const income = parseFloat(m.income_total);
                const expense = parseFloat(m.expense_total);
                return (
                  <View key={`${m.year}-${m.month}`} style={styles.trendRow}>
                    <Text style={styles.trendLabel}>
                      {SHORT_MONTHS[m.month - 1]} {String(m.year).slice(2)}
                    </Text>
                    <View style={styles.trendValues}>
                      <Text style={styles.trendIncomeText}>+{formatMoney(income)}</Text>
                      <Text style={styles.trendExpenseText}>-{formatMoney(expense)}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderReconciliation = () => (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Reconciliation</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Upload Bank Statement CSV</Text>
        <Text style={styles.reconHint}>Format: date,description,amount</Text>

        <Text style={styles.label}>Statement Name</Text>
        <TextInput
          style={styles.input}
          value={reconStatementName}
          onChangeText={setReconStatementName}
          placeholder="e.g. Nubank August 2026"
          placeholderTextColor={colors.textDim}
        />

        <Text style={styles.label}>CSV Data</Text>
        <TextInput
          style={styles.reconCsvInput}
          value={reconCsv}
          onChangeText={setReconCsv}
          placeholder={"2026-08-01,Supermarket,150.00\n2026-08-02,Salary,2500.00"}
          placeholderTextColor={colors.textDim}
          multiline
          numberOfLines={6}
          autoCapitalize="none"
        />

        {reconError && (
          <View style={styles.reconErrorBox}>
            <Text style={styles.reconErrorText}>{reconError}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, reconLoading && styles.submitButtonDisabled]}
          onPress={handleReconSubmit}
          disabled={reconLoading}
        >
          {reconLoading ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.submitButtonText}>Upload & Reconcile</Text>
          )}
        </TouchableOpacity>
      </View>

      {reconResult && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Results</Text>
          <View style={styles.reconSummaryRow}>
            <View style={styles.reconSummaryItem}>
              <Text style={styles.reconSummaryLabel}>Total</Text>
              <Text style={styles.reconSummaryValue}>{reconResult.total_rows}</Text>
            </View>
            <View style={styles.reconSummaryItem}>
              <Text style={[styles.reconSummaryLabel, { color: colors.primary }]}>Matched</Text>
              <Text style={[styles.reconSummaryValue, { color: colors.primary }]}>{reconResult.matched_rows}</Text>
            </View>
            <View style={styles.reconSummaryItem}>
              <Text style={[styles.reconSummaryLabel, { color: colors.danger }]}>Unmatched</Text>
              <Text style={[styles.reconSummaryValue, { color: colors.danger }]}>{reconResult.unmatched_rows}</Text>
            </View>
          </View>

          {(reconResult.items ?? []).map((item) => (
            <View key={item.id} style={styles.reconRow}>
              <View style={styles.reconRowLeft}>
                <Text style={styles.reconDate}>{item.statement_date}</Text>
                <Text style={styles.reconDescription}>{item.statement_description}</Text>
              </View>
              <View style={styles.reconRowRight}>
                <Text style={styles.reconAmount}>{formatMoney(item.statement_amount)}</Text>
                <View
                  style={[
                    styles.reconStatusBadge,
                    {
                      backgroundColor: item.match_status === 'matched' ? colors.primaryHover : colors.dangerBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.reconStatusText,
                      { color: item.match_status === 'matched' ? colors.primary : colors.danger },
                    ]}
                  >
                    {item.match_status}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderCategories = () => (
    <ScrollView style={styles.content}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Categories</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setNewCatName('');
            setNewCatType('expense');
            setNewCatIcon('shopping-cart');
            setNewCatColor('#6366f1');
            setShowCategoryForm(true);
          }}
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.groupTitle}>Expense Categories</Text>
      <View style={styles.categoryGrid}>
        {expenseCategories.map((c) => (
          <View key={c.id} style={styles.categoryCard}>
            <View style={[styles.categoryIconCircle, { backgroundColor: c.color || colors.surfaceHover }]}>
              <Text style={styles.categoryIconText}>{c.icon || '•'}</Text>
            </View>
            <Text style={styles.categoryCardName}>{c.name}</Text>
          </View>
        ))}
        {expenseCategories.length === 0 && <Text style={styles.emptyText}>No expense categories.</Text>}
      </View>

      <Text style={styles.groupTitle}>Income Categories</Text>
      <View style={styles.categoryGrid}>
        {incomeCategories.map((c) => (
          <View key={c.id} style={styles.categoryCard}>
            <View style={[styles.categoryIconCircle, { backgroundColor: c.color || colors.surfaceHover }]}>
              <Text style={styles.categoryIconText}>{c.icon || '•'}</Text>
            </View>
            <Text style={styles.categoryCardName}>{c.name}</Text>
          </View>
        ))}
        {incomeCategories.length === 0 && <Text style={styles.emptyText}>No income categories.</Text>}
      </View>

      <Modal
        visible={showCategoryForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Category</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder="e.g. Pets"
              placeholderTextColor={colors.textDim}
            />

            <Text style={styles.label}>Type</Text>
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[styles.typeButton, newCatType === 'expense' && styles.typeButtonActive]}
                onPress={() => {
                  setNewCatType('expense');
                  setNewCatIcon('shopping-cart');
                }}
              >
                <Text style={[styles.typeButtonText, newCatType === 'expense' && styles.typeButtonTextActive]}>
                  Expense
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, newCatType === 'income' && styles.typeButtonActive]}
                onPress={() => {
                  setNewCatType('income');
                  setNewCatIcon('briefcase');
                }}
              >
                <Text style={[styles.typeButtonText, newCatType === 'income' && styles.typeButtonTextActive]}>
                  Income
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Icon</Text>
            <View style={styles.iconGrid}>
              {CATEGORY_ICONS.map((ic) => (
                <TouchableOpacity
                  key={ic}
                  style={[styles.iconButton, newCatIcon === ic && styles.iconButtonActive]}
                  onPress={() => setNewCatIcon(ic)}
                >
                  <Text style={styles.iconButtonText}>{ic}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Color</Text>
            <View style={styles.colorGrid}>
              {CATEGORY_COLORS.map((col) => (
                <TouchableOpacity
                  key={col}
                  style={[
                    styles.colorButton,
                    { backgroundColor: col },
                    newCatColor === col && styles.colorButtonActive,
                  ]}
                  onPress={() => setNewCatColor(col)}
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCategoryForm(false)}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={handleCategorySubmit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <Text style={styles.submitButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );

  const renderAddForm = () => (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>{editing ? 'Edit Transaction' : 'Add Transaction'}</Text>

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Lunch at Restaurante X"
          placeholderTextColor={colors.textDim}
        />

        <Text style={styles.label}>Amount (R$)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={colors.textDim}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Date</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
          accessibilityLabel="Pick transaction date"
          accessibilityRole="button"
        >
          <Text style={styles.dateButtonText}>📅 {formatDateDisplay(date)}</Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' && showDatePicker && (
          <Modal
            transparent
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerModal}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.datePickerCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Select Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.datePickerDone}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={new Date(`${date}T12:00:00`)}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(event, selected) => {
                    if (event.type === 'set' && selected) {
                      setDate(toIsoDate(selected));
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        )}

        {Platform.OS === 'android' && showDatePicker && (
          <DateTimePicker
            value={new Date(`${date}T12:00:00`)}
            mode="date"
            display="default"
            maximumDate={new Date()}
            onChange={(event, selected) => {
              setShowDatePicker(false);
              if (event.type === 'set' && selected) {
                setDate(toIsoDate(selected));
              }
            }}
          />
        )}

        <Text style={styles.label}>Type</Text>
        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[styles.typeButton, type === 'expense' && styles.typeButtonActive]}
            onPress={() => {
              setType('expense');
              const cat = categories.find((c) => c.id === categoryId);
              if (cat && cat.type !== 'expense') setCategoryId('');
            }}
          >
            <Text style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextActive]}>
              Expense
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, type === 'income' && styles.typeButtonActive]}
            onPress={() => {
              setType('income');
              const cat = categories.find((c) => c.id === categoryId);
              if (cat && cat.type !== 'income') setCategoryId('');
            }}
          >
            <Text style={[styles.typeButtonText, type === 'income' && styles.typeButtonTextActive]}>
              Income
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Category</Text>
        {categories.filter((c) => c.type === type).length === 0 ? (
          <Text style={styles.emptyText}>No {type} categories. Create one in the Categories screen!</Text>
        ) : (
          <View style={styles.categoryGrid}>
            <TouchableOpacity
              style={[styles.categoryChip, !categoryId && styles.categoryChipActive]}
              onPress={() => setCategoryId('')}
            >
              <Text style={[styles.categoryChipText, !categoryId && styles.categoryChipTextActive]}>
                None
              </Text>
            </TouchableOpacity>
            {categories.filter((c) => c.type === type).map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.categoryChip, categoryId === c.id && styles.categoryChipActive]}
                onPress={() => setCategoryId(c.id)}
              >
                <Text style={[styles.categoryChipText, categoryId === c.id && styles.categoryChipTextActive]}>
                  {c.icon ? `${c.icon} ` : ''}{c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, saving && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.submitButtonText}>
              {editing ? 'Save Changes' : 'Add Transaction'}
            </Text>
          )}
        </TouchableOpacity>

        {editing && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={resetForm}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.menuButton}>
          <Text style={styles.menuButtonText}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏦 PudimFinance</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading && !error ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.addButton} onPress={loadData}>
            <Text style={styles.addButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {screen === 'dashboard' && renderDashboard()}
          {screen === 'transactions' && renderTransactions()}
          {screen === 'budgets' && renderBudgets()}
          {screen === 'reports' && renderReports()}
          {screen === 'categories' && renderCategories()}
          {screen === 'reconciliation' && renderReconciliation()}
          {showAddForm && renderAddForm()}

          {screen !== 'transactions' && !showAddForm && (
            <TouchableOpacity
              style={styles.fab}
              onPress={() => {
                resetForm();
                setShowAddForm(true);
              }}
            >
              <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
          )}

          {/* Category creation modal */}
          {showCategoryForm && (
            <Modal
              visible={showCategoryForm}
              transparent
              animationType="slide"
              onRequestClose={() => setShowCategoryForm(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>New Category</Text>

                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={newCatName}
                    onChangeText={setNewCatName}
                    placeholder="e.g. Pets"
                    placeholderTextColor={colors.textDim}
                  />

                  <Text style={styles.label}>Type</Text>
                  <View style={styles.typeToggle}>
                    <TouchableOpacity
                      style={[styles.typeButton, newCatType === 'expense' && styles.typeButtonActive]}
                      onPress={() => { setNewCatType('expense'); setNewCatIcon('shopping-cart'); }}
                    >
                      <Text style={[styles.typeButtonText, newCatType === 'expense' && styles.typeButtonTextActive]}>
                        Expense
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.typeButton, newCatType === 'income' && styles.typeButtonActive]}
                      onPress={() => { setNewCatType('income'); setNewCatIcon('briefcase'); }}
                    >
                      <Text style={[styles.typeButtonText, newCatType === 'income' && styles.typeButtonTextActive]}>
                        Income
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>Icon</Text>
                  <View style={styles.iconGrid}>
                    {CATEGORY_ICONS.map((ic) => (
                      <TouchableOpacity
                        key={ic}
                        style={[styles.iconButton, newCatIcon === ic && styles.iconButtonActive]}
                        onPress={() => setNewCatIcon(ic)}
                      >
                        <Text style={styles.iconButtonText}>{ic}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>Color</Text>
                  <View style={styles.colorGrid}>
                    {CATEGORY_COLORS.map((col) => (
                      <TouchableOpacity
                        key={col}
                        style={[styles.colorButton, { backgroundColor: col }, newCatColor === col && styles.colorButtonActive]}
                        onPress={() => setNewCatColor(col)}
                      />
                    ))}
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCategoryForm(false)} disabled={saving}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                      onPress={handleCategorySubmit}
                      disabled={saving}
                    >
                      {saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.submitButtonText}>Create</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}

          {/* Budget form modal */}
          {showBudgetForm && (
            <Modal
              visible={showBudgetForm}
              transparent
              animationType="slide"
              onRequestClose={() => setShowBudgetForm(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>
                    {editingBudget ? `Edit ${editingBudget.budget.category_name} Budget` : 'Add Budget'}
                  </Text>

                  <Text style={styles.label}>Category</Text>
                  {expenseCategories.length === 0 ? (
                    <Text style={styles.emptyText}>No expense categories. Create one first.</Text>
                  ) : editingBudget ? (
                    <View style={styles.readOnlyField}>
                      <Text style={styles.readOnlyText}>
                        {editingBudget.budget.category_name}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.categoryGrid}>
                      {expenseCategories.map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.categoryChip, budgetCategoryId === c.id && styles.categoryChipActive]}
                          onPress={() => setBudgetCategoryId(c.id)}
                        >
                          <Text style={[styles.categoryChipText, budgetCategoryId === c.id && styles.categoryChipTextActive]}>
                            {c.icon ? `${c.icon} ` : ''}{c.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.label}>Monthly Limit (R$)</Text>
                  <TextInput
                    style={styles.input}
                    value={budgetAmountLimit}
                    onChangeText={setBudgetAmountLimit}
                    placeholder="500.00"
                    placeholderTextColor={colors.textDim}
                    keyboardType="decimal-pad"
                  />

                  <Text style={styles.monthPreview}>
                    Applies to: {MONTHS[budgetMonth - 1]} {budgetYear}
                  </Text>

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setShowBudgetForm(false)}
                      disabled={saving}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                      onPress={handleBudgetSubmit}
                      disabled={saving || expenseCategories.length === 0}
                    >
                      {saving ? (
                        <ActivityIndicator color={colors.primaryText} />
                      ) : (
                        <Text style={styles.submitButtonText}>
                          {editingBudget ? 'Save' : 'Create'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}
        </>
      )}

      {/* Drawer overlay */}
      {drawerOpen && (
        <TouchableOpacity
          style={styles.drawerOverlay}
          activeOpacity={1}
          onPress={() => setDrawerOpen(false)}
        >
          <Animated.View
            style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>🏦 PudimFinance</Text>
              <TouchableOpacity onPress={() => setDrawerOpen(false)} style={styles.drawerClose}>
                <Text style={styles.drawerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.drawerItem, screen === 'dashboard' && styles.drawerItemActive]}
              onPress={() => navigate('dashboard')}
            >
              <Text style={[styles.drawerItemText, screen === 'dashboard' && styles.drawerItemTextActive]}>
                📊 Dashboard
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.drawerItem, screen === 'transactions' && styles.drawerItemActive]}
              onPress={() => navigate('transactions')}
            >
              <Text style={[styles.drawerItemText, screen === 'transactions' && styles.drawerItemTextActive]}>
                💸 Transactions
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.drawerItem, screen === 'budgets' && styles.drawerItemActive]}
              onPress={() => navigate('budgets')}
            >
              <Text style={[styles.drawerItemText, screen === 'budgets' && styles.drawerItemTextActive]}>
                💰 Budgets
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.drawerItem, screen === 'reports' && styles.drawerItemActive]}
              onPress={() => navigate('reports')}
            >
              <Text style={[styles.drawerItemText, screen === 'reports' && styles.drawerItemTextActive]}>
                📈 Reports
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.drawerItem, screen === 'reconciliation' && styles.drawerItemActive]}
              onPress={() => navigate('reconciliation')}
            >
              <Text style={[styles.drawerItemText, screen === 'reconciliation' && styles.drawerItemTextActive]}>
                🔄 Reconciliation
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.drawerItem, screen === 'categories' && styles.drawerItemActive]}
              onPress={() => navigate('categories')}
            >
              <Text style={[styles.drawerItemText, screen === 'categories' && styles.drawerItemTextActive]}>
                🏷️ Categories
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHover,
  },
  menuButton: {
    padding: 4,
  },
  menuButtonText: {
    color: colors.text,
    fontSize: 22,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 30,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: colors.dangerText,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    marginBottom: 16,
  },
  balanceLabel: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    gap: 32,
  },
  balanceItem: {
    flexDirection: 'column',
  },
  balanceItemLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  balanceItemValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyText: {
    color: colors.textDim,
    textAlign: 'center',
    padding: 16,
  },
  emptySubtext: {
    color: colors.textDim,
    fontSize: 13,
    textAlign: 'center',
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dashboardEmpty: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  dashboardEmptyIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  dashboardEmptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  dashboardEmptyDesc: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    marginTop: 8,
  },
  categoryRow: {
    marginBottom: 12,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  categoryName: {
    color: colors.text,
    fontSize: 14,
  },
  categoryTotal: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceHover,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.bg,
    fontWeight: '600',
    fontSize: 14,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  transactionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconText: {
    fontSize: 16,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  transactionMeta: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  transactionActions: {
    flexDirection: 'row',
    gap: 4,
  },
  editButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
  },
  editButtonText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 12,
  },
  separator: {
    height: 1,
    backgroundColor: colors.surface,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    marginTop: 8,
  },
  formTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    borderRadius: 8,
    padding: 12,
    color: colors.text,
    fontSize: 16,
  },
  dateButton: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  dateButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  datePickerModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHover,
  },
  datePickerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  datePickerCancel: {
    color: colors.textMuted,
    fontSize: 15,
  },
  datePickerDone: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  typeToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: colors.surfaceHover,
    borderColor: colors.borderStrong,
  },
  typeButtonText: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: colors.text,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    backgroundColor: colors.bg,
  },
  categoryChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryHover,
  },
  categoryChipText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  categoryChipTextActive: {
    color: colors.text,
  },
  submitButton: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    color: colors.bg,
    fontSize: 28,
    fontWeight: '600',
  },
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.surfaceHover,
    paddingTop: 48,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHover,
  },
  drawerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  drawerClose: {
    padding: 4,
  },
  drawerCloseText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  drawerItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  drawerItemActive: {
    backgroundColor: colors.surfaceHover,
  },
  drawerItemText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  drawerItemTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  navButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    borderRadius: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    color: colors.textMuted,
    fontSize: 18,
  },
  monthLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    minWidth: 140,
    textAlign: 'center',
  },
  overviewCards: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
  },
  overviewLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  overviewValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  budgetCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    marginBottom: 12,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  budgetCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  budgetCategoryName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  warningBadge: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  budgetItemActions: {
    flexDirection: 'row',
    gap: 4,
  },
  budgetMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  budgetMetaText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  budgetPctText: {
    fontSize: 13,
    fontWeight: '600',
  },
  remainingText: {
    color: colors.primary,
    fontSize: 13,
  },
  overText: {
    color: colors.danger,
    fontSize: 13,
  },
  groupTitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    width: 100,
  },
  categoryCardName: {
    color: colors.text,
    fontSize: 13,
    textAlign: 'center',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  trendLabel: {
    color: colors.textMuted,
    fontSize: 12,
    width: 44,
  },
  trendValues: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    flex: 1,
  },
  trendIncomeText: {
    color: colors.primary,
    fontSize: 11,
  },
  trendExpenseText: {
    color: colors.danger,
    fontSize: 11,
  },
  chartArea: {
    alignItems: 'center',
    marginBottom: 16,
  },
  donutLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 0,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    color: colors.textMuted,
    fontSize: 12,
    flexShrink: 1,
    maxWidth: 140,
  },
  legendValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  readOnlyField: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    borderRadius: 8,
    padding: 12,
  },
  readOnlyText: {
    color: colors.text,
    fontSize: 16,
  },
  reconHint: {
    color: colors.textDim,
    fontSize: 13,
    marginBottom: 4,
  },
  reconCsvInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    borderRadius: 8,
    padding: 12,
    color: colors.text,
    fontSize: 13,
    fontFamily: 'monospace',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  reconErrorBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  reconErrorText: {
    color: colors.dangerText,
    fontSize: 13,
  },
  reconSummaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  reconSummaryItem: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  reconSummaryLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  reconSummaryValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  reconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
    gap: 8,
  },
  reconRowLeft: {
    flex: 1,
  },
  reconDate: {
    color: colors.textDim,
    fontSize: 11,
  },
  reconDescription: {
    color: colors.text,
    fontSize: 13,
    marginTop: 2,
  },
  reconRowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  reconAmount: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  reconStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  reconStatusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  iconButton: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  iconButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryHover,
  },
  iconButtonText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  colorButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorButtonActive: {
    borderColor: colors.text,
  },
  monthPreview: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
});