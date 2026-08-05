import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Category,
  Transaction,
  SummaryResponse,
  fetchCategories,
  fetchSummary,
  fetchTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from './src/api';

type Tab = 'dashboard' | 'transactions' | 'add';

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);

  // Add form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

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

  const formatMoney = (value: string | number) => {
    const n = typeof value === 'string' ? parseFloat(value) : value;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const filteredCategories = categories.filter((c) => c.type === type);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setType('expense');
    setCategoryId('');
    setDate(new Date().toISOString().slice(0, 10));
    setEditing(null);
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
      setTab('transactions');
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
    setTab('add');
  };

  const renderDashboard = () => (
    <ScrollView style={styles.content}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text style={[
          styles.balanceValue,
          { color: parseFloat(summary?.balance || '0') < 0 ? '#ef4444' : '#22c55e' },
        ]}>
          {formatMoney(summary?.balance || '0')}
        </Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>Income</Text>
            <Text style={[styles.balanceItemValue, { color: '#22c55e' }]}>
              {formatMoney(summary?.income_total || '0')}
            </Text>
          </View>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>Expenses</Text>
            <Text style={[styles.balanceItemValue, { color: '#ef4444' }]}>
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
          <Text style={styles.emptyText}>No transactions yet.</Text>
        ) : (
          transactions.slice(0, 5).map((t) => renderTransactionRow(t))
        )}
      </View>
    </ScrollView>
  );

  const renderTransactionRow = (t: Transaction) => {
    const cat = t.category_id ? categoryById.get(t.category_id) : undefined;
    const isIncome = t.type === 'income';
    return (
      <View key={t.id} style={styles.transactionRow}>
        <View style={styles.transactionLeft}>
          {cat && (
            <View style={[styles.categoryIconCircle, { backgroundColor: cat.color || '#334155' }]}>
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
          <Text style={[
            styles.transactionAmount,
            { color: isIncome ? '#22c55e' : '#ef4444' },
          ]}>
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

  const renderTransactions = () => (
    <View style={styles.content}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Transactions</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setTab('add');
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
              setTab('add');
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
        />
      )}
    </View>
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
          placeholderTextColor="#64748b"
        />

        <Text style={styles.label}>Amount (R$)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor="#64748b"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
        />

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
        {filteredCategories.length === 0 ? (
          <Text style={styles.emptyText}>No {type} categories. Create one on the web app first!</Text>
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
            {filteredCategories.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.categoryChip,
                  categoryId === c.id && styles.categoryChipActive,
                ]}
                onPress={() => setCategoryId(c.id)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    categoryId === c.id && styles.categoryChipTextActive,
                  ]}
                >
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
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.submitButtonText}>
              {editing ? 'Save Changes' : 'Add Transaction'}
            </Text>
          )}
        </TouchableOpacity>

        {editing && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              resetForm();
              setTab('transactions');
            }}
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

      {loading && !error ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
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
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🏦 PudimFinance</Text>
          </View>

          {tab === 'dashboard' && renderDashboard()}
          {tab === 'transactions' && renderTransactions()}
          {tab === 'add' && renderAddForm()}

          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, tab === 'dashboard' && styles.tabActive]}
              onPress={() => setTab('dashboard')}
            >
              <Text style={[styles.tabText, tab === 'dashboard' && styles.tabTextActive]}>
                📊 Dashboard
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'transactions' && styles.tabActive]}
              onPress={() => setTab('transactions')}
            >
              <Text style={[styles.tabText, tab === 'transactions' && styles.tabTextActive]}>
                💸 Transactions
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'add' && styles.tabActive]}
              onPress={() => {
                if (!editing) resetForm();
                setTab('add');
              }}
            >
              <Text style={[styles.tabText, tab === 'add' && styles.tabTextActive]}>
                ➕ Add
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    color: '#e2e8f0',
    fontSize: 20,
    fontWeight: '700',
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
    color: '#94a3b8',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  balanceCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  balanceLabel: {
    color: '#94a3b8',
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
    color: '#94a3b8',
    fontSize: 12,
  },
  balanceItemValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
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
    color: '#e2e8f0',
    fontSize: 14,
  },
  categoryTotal: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#334155',
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
    color: '#e2e8f0',
    fontSize: 22,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#0f172a',
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
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '500',
  },
  transactionMeta: {
    color: '#64748b',
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
    borderColor: '#334155',
  },
  editButtonText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#991b1b',
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#1e293b',
  },
  formCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  formTitle: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
    color: '#e2e8f0',
    fontSize: 16,
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
    borderColor: '#334155',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#334155',
    borderColor: '#475569',
  },
  typeButtonText: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#e2e8f0',
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
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  categoryChipActive: {
    borderColor: '#22c55e',
    backgroundColor: '#14532d',
  },
  categoryChipText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  categoryChipTextActive: {
    color: '#e2e8f0',
  },
  submitButton: {
    backgroundColor: '#22c55e',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#0f172a',
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
    color: '#94a3b8',
    fontSize: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabActive: {
    backgroundColor: '#334155',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
});