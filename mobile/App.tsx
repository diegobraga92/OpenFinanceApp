import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Category,
  Transaction,
  SummaryResponse,
  createTransaction,
  deleteTransaction,
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
import { DashboardScreen } from './src/screens/DashboardScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { CategoriesScreen } from './src/screens/CategoriesScreen';
import { BudgetsScreen } from './src/screens/BudgetsScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { ReconciliationScreen } from './src/screens/ReconciliationScreen';

type Screen = 'dashboard' | 'transactions' | 'budgets' | 'reports' | 'reconciliation' | 'categories';

export default function App() {
  return (
    <SnackbarProvider>
      <BiometricLock>
        <OnboardingGate>
          <AppContent />
        </OnboardingGate>
      </BiometricLock>
    </SnackbarProvider>
  );
}

function AppContent() {
  const { show: showSnackbar } = useSnackbar();
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  const [categories, setCategories] = useState<Category[]>([]);
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

  useEffect(() => {
    loadData();
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
        <Animated.View style={[styles.screenContainer, { opacity: screenOpacity }]}>
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
          {screen === 'categories' && (
            <CategoriesScreen
              expenseCategories={expenseCategories}
              incomeCategories={incomeCategories}
              onCreated={loadData}
            />
          )}
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
            >
              <Text style={styles.fabText}>+</Text>
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
