import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Animated,
  AppState,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AccountWithBalance,
  Category,
  Transaction,
  SummaryResponse,
  createTransaction,
  deleteTransaction,
  fetchAccountsWithBalance,
  fetchCategories,
  fetchSummary,
  fetchTransactions,
} from './src/api';
import { colors } from './src/theme/tokens';
import { AddTransactionForm } from './src/screens/AddTransactionForm';
import { styles, DRAWER_WIDTH } from './src/theme/styles';
import { SnackbarProvider, useSnackbar } from './src/components/Snackbar';
import { BiometricLock } from './src/components/BiometricLock';
import { OnboardingGate } from './src/screens/OnboardingScreen';
import { AuthGate, useAuthUser } from './src/auth/AuthGate';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { CategoriesScreen } from './src/screens/CategoriesScreen';
import { AccountsScreen } from './src/screens/AccountsScreen';
import { NotificationSettingsScreen } from './src/screens/NotificationSettingsScreen';
import { ServerScreen } from './src/screens/ServerScreen';
import { ReceiptsScreen } from './src/screens/ReceiptsScreen';
import { AuditScreen } from './src/screens/AuditScreen';
import { LedgerScreen } from './src/screens/LedgerScreen';
import { BudgetsScreen } from './src/screens/BudgetsScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { ReconciliationScreen } from './src/screens/ReconciliationScreen';
import { InstallmentsScreen } from './src/screens/InstallmentsScreen';
import { CreditCardsScreen } from './src/screens/CreditCardsScreen';
import { NotificationCaptureProvider } from './src/notifications/NotificationCaptureProvider';
import { OfflineBanner } from './src/components/OfflineBanner';
import { syncAll } from './src/offline/sync-engine';

type Screen = 'dashboard' | 'transactions' | 'accounts' | 'credit-cards' | 'ledger' | 'budgets' | 'installments' | 'reports' | 'reconciliation' | 'categories' | 'notifications' | 'receipts' | 'audit' | 'server';

const DRAWER_ITEMS: {
  key: Screen;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
}[] = [
  { key: 'dashboard', icon: 'stats-chart-outline', label: 'Dashboard' },
  { key: 'transactions', icon: 'swap-horizontal-outline', label: 'Transactions' },
  { key: 'accounts', icon: 'wallet-outline', label: 'Accounts' },
  { key: 'credit-cards', icon: 'card-outline', label: 'Credit Cards' },
  { key: 'ledger', icon: 'book-outline', label: 'Ledger' },
  { key: 'budgets', icon: 'pie-chart-outline', label: 'Budgets' },
  { key: 'installments', icon: 'calendar-outline', label: 'Installments' },
  { key: 'reports', icon: 'trending-up-outline', label: 'Reports' },
  { key: 'reconciliation', icon: 'sync-outline', label: 'Reconciliation' },
  { key: 'categories', icon: 'pricetags-outline', label: 'Categories' },
  { key: 'receipts', icon: 'receipt-outline', label: 'Receipts' },
  { key: 'audit', icon: 'list-outline', label: 'Audit Log' },
  { key: 'notifications', icon: 'notifications-outline', label: 'Notification Capture' },
  { key: 'server', icon: 'server-outline', label: 'Server' },
];

export default function App() {
  return (
    <SnackbarProvider>
      <NotificationCaptureProvider>
        <AuthGate>
          <BiometricLock>
            <OnboardingGate>
              <AppContent />
            </OnboardingGate>
          </BiometricLock>
        </AuthGate>
      </NotificationCaptureProvider>
    </SnackbarProvider>
  );
}

function AppContent() {
  const { show: showSnackbar } = useSnackbar();
  const { user, logout } = useAuthUser();
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
      // Try to sync first so the local mirror + server agree before rendering.
      await syncAll().catch(() => null);
      const [cats, summ, txns, accnts] = await Promise.all([
        fetchCategories(),
        fetchSummary(),
        fetchTransactions({ page_size: 50 }),
        fetchAccountsWithBalance().catch(() => [] as AccountWithBalance[]),
      ]);
      setCategories(cats);
      setSummary(summ);
      setTransactions(txns.items);
      setAccounts(accnts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync whenever the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void loadData();
      }
    });
    return () => sub.remove();
  }, [loadData]);

  // Fade screen content in on every navigation.
  useEffect(() => {
    screenOpacity.setValue(0);
    Animated.timing(screenOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [screen, screenOpacity]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

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

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  // Transaction form helpers (fields live inside AddTransactionForm)
  const resetForm = () => {
    setEditing(null);
    setShowAddForm(false);
  };

  const handleDelete = (t: Transaction) => {
    deleteTransaction(t.id)
      .then(async () => {
        await loadData();
        showSnackbar(`Transaction "${t.description}" deleted`, 'Undo', async () => {
          try {
            await createTransaction({
              description: t.description,
              amount: t.amount,
              type: t.type === 'income' ? 'income' : 'expense',
              category_id: t.category_id || null,
              date: t.date,
              notes: t.notes || null,
            });
            await loadData();
            showSnackbar('Transaction restored');
          } catch (err) {
            showSnackbar(err instanceof Error ? err.message : 'Could not restore transaction');
          }
        });
      })
      .catch((err) => {
        showSnackbar(err instanceof Error ? err.message : 'Failed to delete');
      });
  };

  const handleEdit = (t: Transaction) => {
    setEditing(t);
    setShowAddForm(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.menuButton} accessibilityLabel="Open menu">
          <Ionicons name="menu" size={24} color={colors.text} />
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
        <Animated.View style={[styles.screenContainer, { opacity: screenOpacity }]}>
          <OfflineBanner />
          {screen === 'dashboard' && (
            <DashboardScreen
              summary={summary}
              categories={categories}
              transactions={transactions}
              formatMoney={formatMoney}
              refreshControl={refreshControl}
              onAddTransaction={() => {
                resetForm();
                setShowAddForm(true);
              }}
              onQuickSaved={loadData}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
          {screen === 'transactions' && (
            <TransactionsScreen
              transactions={transactions}
              categories={categories}
              formatMoney={formatMoney}
              refreshControl={refreshControl}
              onAdd={() => {
                resetForm();
                setShowAddForm(true);
              }}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
          {screen === 'budgets' && (
            <BudgetsScreen categories={categories} formatMoney={formatMoney} />
          )}
          {screen === 'installments' && (
            <InstallmentsScreen categories={categories} formatMoney={formatMoney} />
          )}
          {screen === 'credit-cards' && (
            <CreditCardsScreen categories={categories} formatMoney={formatMoney} />
          )}
          {screen === 'reports' && <ReportsScreen formatMoney={formatMoney} />}
          {screen === 'accounts' && (
            <AccountsScreen accounts={accounts} onChanged={loadData} />
          )}
          {screen === 'categories' && (
            <CategoriesScreen
              expenseCategories={expenseCategories}
              incomeCategories={incomeCategories}
              onCreated={loadData}
            />
          )}
          {screen === 'notifications' && (
            <NotificationSettingsScreen categories={categories} />
          )}
          {screen === 'receipts' && <ReceiptsScreen formatMoney={formatMoney} />}
          {screen === 'audit' && <AuditScreen />}
          {screen === 'ledger' && <LedgerScreen formatMoney={formatMoney} />}
          {screen === 'server' && <ServerScreen />}
          {screen === 'reconciliation' && <ReconciliationScreen formatMoney={formatMoney} />}
          {showAddForm && (
            <AddTransactionForm
              key={editing?.id ?? 'new'}
              categories={categories}
              editing={editing}
              onSaved={async () => {
                setEditing(null);
                setShowAddForm(false);
                setScreen('transactions');
                await loadData();
              }}
              onCancel={() => {
                setEditing(null);
                setShowAddForm(false);
              }}
            />
          )}

          {screen !== 'transactions' && !showAddForm && (
            <TouchableOpacity
              style={styles.fab}
              onPress={() => {
                resetForm();
                setShowAddForm(true);
              }}
              accessibilityLabel="Add transaction"
              accessibilityRole="button"
            >
              <Ionicons name="add" size={28} color={colors.primaryText} />
            </TouchableOpacity>
          )}

        </Animated.View>
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
              <TouchableOpacity onPress={() => setDrawerOpen(false)} style={styles.drawerClose} accessibilityLabel="Close menu">
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {DRAWER_ITEMS.map((item) => {
              const active = screen === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.drawerItem, active && styles.drawerItemActive]}
                  onPress={() => navigate(item.key)}
                >
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={active ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.drawerItemText, active && styles.drawerItemTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <View style={styles.drawerFooter}>
              <View style={styles.drawerUser}>
                <Text style={styles.drawerUserEmail} numberOfLines={1}>
                  {user?.email}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  setDrawerOpen(false);
                  logout();
                }}
                accessibilityRole="button"
              >
                <Ionicons name="log-out-outline" size={18} color={colors.danger} />
                <Text style={[styles.drawerItemText, { color: colors.danger }]}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableOpacity>
      )}
    </View>
  );
}
