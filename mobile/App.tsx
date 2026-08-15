import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Animated,
  AppState,
  RefreshControl,
  ScrollView,
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
import { I18nProvider, useI18n } from './src/i18n';
import { LanguageToggle } from './src/components/LanguageToggle';
import * as Linking from 'expo-linking';
import {
  updateQuickAddWidget,
  computeSpentToday,
  formatWidgetMoney,
} from './src/widgets';
import type { TranslationKey } from '../shared/i18n';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { CategoriesScreen } from './src/screens/CategoriesScreen';
import { AccountsScreen } from './src/screens/AccountsScreen';
import { NotificationSettingsScreen } from './src/screens/NotificationSettingsScreen';
import { PendingCapturesScreen } from './src/screens/PendingCapturesScreen';
import { ServerScreen } from './src/screens/ServerScreen';
import { ReceiptsScreen } from './src/screens/ReceiptsScreen';
import { AuditScreen } from './src/screens/AuditScreen';
import { LedgerScreen } from './src/screens/LedgerScreen';
import { BudgetsScreen } from './src/screens/BudgetsScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { ReconciliationScreen } from './src/screens/ReconciliationScreen';
import { NotificationCaptureProvider, useNotificationCapture } from './src/notifications/NotificationCaptureProvider';
import { OfflineBanner } from './src/components/OfflineBanner';
import { subscribeSync, syncSilently } from './src/offline/sync-engine';

type Screen = 'dashboard' | 'transactions' | 'accounts' | 'ledger' | 'budgets' | 'reports' | 'reconciliation' | 'categories' | 'notifications' | 'pending' | 'receipts' | 'audit' | 'server';

type DrawerItem = {
  key: Screen;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  labelKey: TranslationKey;
};

const PRIMARY_ITEMS: DrawerItem[] = [
  { key: 'dashboard', icon: 'stats-chart-outline', labelKey: 'nav.dashboard' },
  { key: 'transactions', icon: 'swap-horizontal-outline', labelKey: 'nav.transactions' },
  { key: 'accounts', icon: 'wallet-outline', labelKey: 'nav.accounts' },
  { key: 'budgets', icon: 'pie-chart-outline', labelKey: 'nav.budgets' },
  { key: 'reports', icon: 'trending-up-outline', labelKey: 'nav.reports' },
];

const TOOLS_ITEMS: DrawerItem[] = [
  { key: 'ledger', icon: 'book-outline', labelKey: 'nav.ledger' },
  { key: 'reconciliation', icon: 'sync-outline', labelKey: 'nav.reconciliation' },
  { key: 'categories', icon: 'pricetags-outline', labelKey: 'nav.categories' },
  { key: 'receipts', icon: 'receipt-outline', labelKey: 'nav.receipts' },
  { key: 'audit', icon: 'list-outline', labelKey: 'nav.audit' },
  { key: 'notifications', icon: 'notifications-outline', labelKey: 'nav.notifications' },
  { key: 'pending', icon: 'hourglass-outline', labelKey: 'nav.reviewCaptures' },
  { key: 'server', icon: 'server-outline', labelKey: 'nav.server' },
];

export default function App() {
  return (
    <I18nProvider>
      <SnackbarProvider>
        <NotificationCaptureProvider>
          <AuthGate>
            <BiometricGate>
              <OnboardingGate>
                <AppContent />
              </OnboardingGate>
            </BiometricGate>
          </AuthGate>
        </NotificationCaptureProvider>
      </SnackbarProvider>
    </I18nProvider>
  );
}

/**
 * Wraps the app content in the biometric lock. `restored` is true for a
 * session restored from storage (any launch after the first login), which is
 * when the lock should engage automatically. Right after a fresh password
 * login the app stays unlocked for that session.
 */
function BiometricGate({ children }: { children: ReactNode }) {
  const { restored } = useAuthUser();
  return <BiometricLock lockOnMount={restored}>{children}</BiometricLock>;
}

function AppContent() {
  const { show: showSnackbar } = useSnackbar();
  const { user, logout } = useAuthUser();
  const { t, formatMoney } = useI18n();
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
  const { pendingCount } = useNotificationCapture();
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /** Transaction type requested by a home-screen widget deep link (e.g. `pudimfinance://add?type=expense`). */
  const [pendingAddType, setPendingAddType] = useState<'income' | 'expense' | null>(null);

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
      // Uses the silent variant: loadData already refreshes the UI itself, so
      // syncing here must not re-trigger this loader via sync listeners.
      await syncSilently().catch(() => null);
      const [cats, summ, txns, accnts] = await Promise.all([
        fetchCategories(),
        fetchSummary(),
        fetchTransactions({ page_size: 200 }),
        fetchAccountsWithBalance().catch(() => [] as AccountWithBalance[]),
      ]);
      setCategories(cats);
      setSummary(summ);
      setTransactions(txns.items);
      setAccounts(accnts);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.loadData'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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

  // After any externally-triggered sync (OfflineBanner auto-sync on reconnect,
  // manual "tap to sync"), reload the view so pushed/pulled changes appear
  // immediately without requiring a manual refresh.
  useEffect(() => {
    return subscribeSync(() => {
      void loadData();
    });
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

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  // Transaction form helpers (fields live inside AddTransactionForm)
  const resetForm = useCallback(() => {
    setEditing(null);
    setShowAddForm(false);
  }, []);

  // Open the Add Transaction form from a home-screen widget deep link
  // (`pudimfinance://add` or `pudimfinance://add?type=income|expense`).
  const handleWidgetUrl = useCallback(
    (url: string | null) => {
      if (!url) return;
      // NOTE: avoid expo-linking's `parse()` here — it relies on `new URL()`,
      // whose pathname/hostname getters are NOT implemented in RN 0.74's
      // Hermes URL polyfill, so parse() returns the whole URL as `path`.
      // The widget deep links have a fixed format we control, so parse manually.
      const prefix = 'pudimfinance://';
      if (!url.startsWith(prefix)) return;
      const [pathPart, queryString] = url.slice(prefix.length).split('?');
      if (pathPart.replace(/^\/+/, '') !== 'add') return;
      const type = queryString
        ?.split('&')
        .map((pair) => pair.split('='))
        .find(([key]) => key === 'type')?.[1];
      setPendingAddType(type === 'income' ? 'income' : 'expense');
      resetForm();
      setShowAddForm(true);
    },
    [resetForm],
  );

  useEffect(() => {
    Linking.getInitialURL().then(handleWidgetUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleWidgetUrl(url));
    return () => sub.remove();
  }, [handleWidgetUrl]);

  // Keep the home-screen Quick Add widget's "spent today" in sync with the
  // loaded transactions (runs after load, add, edit and delete).
  useEffect(() => {
    const spentToday = computeSpentToday(transactions);
    void updateQuickAddWidget(formatWidgetMoney(spentToday));
  }, [transactions]);

  const handleDelete = (tx: Transaction) => {
    deleteTransaction(tx.id)
      .then(async () => {
        await loadData();
        showSnackbar(t('transactions.deleted', { description: tx.description }), t('transactions.undo'), async () => {
          try {
            await createTransaction({
              description: tx.description,
              amount: tx.amount,
              type: tx.type === 'income' ? 'income' : 'expense',
              category_id: tx.category_id || null,
              date: tx.date,
              notes: tx.notes || null,
            });
            await loadData();
            showSnackbar(t('transactions.restored'));
          } catch (err) {
            showSnackbar(err instanceof Error ? err.message : t('transactions.couldNotRestore'));
          }
        });
      })
      .catch((err) => {
        showSnackbar(err instanceof Error ? err.message : t('transactions.failedToDelete'));
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
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.menuButton} accessibilityLabel={t('nav.ariaOpenMenu')}>
          <Ionicons name="menu" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏦 PudimFinance</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading && !error ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.addButton} onPress={loadData}>
            <Text style={styles.addButtonText}>{t('common.retry')}</Text>
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
          {screen === 'reports' && <ReportsScreen formatMoney={formatMoney} />}
          {screen === 'accounts' && (
            <AccountsScreen
              accounts={accounts}
              categories={categories}
              onChanged={loadData}
            />
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
          {screen === 'pending' && (
            <PendingCapturesScreen categories={categories} formatMoney={formatMoney} />
          )}
          {screen === 'receipts' && <ReceiptsScreen formatMoney={formatMoney} />}
          {screen === 'audit' && <AuditScreen />}
          {screen === 'ledger' && <LedgerScreen formatMoney={formatMoney} />}
          {screen === 'server' && <ServerScreen />}
          {screen === 'reconciliation' && <ReconciliationScreen formatMoney={formatMoney} />}
          {showAddForm && (
            <AddTransactionForm
              key={`${editing?.id ?? 'new'}-${pendingAddType ?? 'default'}`}
              categories={categories}
              accounts={accounts}
              editing={editing}
              initialType={pendingAddType ?? undefined}
              onSaved={async () => {
                setEditing(null);
                setShowAddForm(false);
                setPendingAddType(null);
                setScreen('transactions');
                await loadData();
              }}
              onCancel={() => {
                setEditing(null);
                setShowAddForm(false);
                setPendingAddType(null);
              }}
            />
          )}

          {screen !== 'transactions' && !showAddForm && (
            <TouchableOpacity
              style={styles.fab}
              onPress={() => {
                resetForm();
                setPendingAddType(null);
                setShowAddForm(true);
              }}
              accessibilityLabel={t('transactions.add')}
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
              <TouchableOpacity onPress={() => setDrawerOpen(false)} style={styles.drawerClose} accessibilityLabel={t('nav.ariaCloseMenu')}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.drawerScroll}
              contentContainerStyle={styles.drawerScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {PRIMARY_ITEMS.map((item) => {
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
                      {t(item.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <View style={styles.drawerDivider} />
              <Text style={styles.drawerSectionLabel}>{t('nav.tools')}</Text>
              {TOOLS_ITEMS.map((item) => {
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
                      {t(item.labelKey)}
                    </Text>
                    {item.key === 'pending' && pendingCount > 0 && (
                      <View
                        style={{
                          marginLeft: 'auto',
                          backgroundColor: colors.danger,
                          borderRadius: 10,
                          minWidth: 20,
                          height: 20,
                          paddingHorizontal: 5,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: colors.primaryText, fontSize: 11, fontWeight: '700' }}>
                          {pendingCount > 99 ? '99+' : pendingCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.drawerFooter}>
              <View style={styles.drawerUser}>
                <Text style={styles.drawerUserEmail} numberOfLines={1}>
                  {user?.email}
                </Text>
              </View>
              <View style={styles.drawerLangRow}>
                <Text style={styles.drawerLangLabel}>{t('app.language')}</Text>
                <LanguageToggle />
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
                <Text style={[styles.drawerItemText, { color: colors.danger }]}>{t('nav.signOut')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableOpacity>
      )}
    </View>
  );
}
