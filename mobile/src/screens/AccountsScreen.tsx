import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AccountWithBalance, createAccount, deleteAccount, updateAccount } from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { EmptyState } from '../components/EmptyState';

interface Props {
  accounts: AccountWithBalance[];
  onChanged: () => Promise<void>;
}

type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

const ACCOUNT_GROUPS: {
  key: AccountType;
  label: string;
  icon: string;
  blurb: string;
}[] = [
  { key: 'asset', label: 'Assets', icon: '💰', blurb: 'Cash, bank accounts and savings' },
  { key: 'liability', label: 'Liabilities & Credit Cards', icon: '💳', blurb: 'Credit cards, loans and debts' },
  { key: 'equity', label: 'Equity', icon: '🏛️', blurb: 'Net worth and capital' },
  { key: 'income', label: 'Income', icon: '📥', blurb: 'Salary and earnings sources' },
  { key: 'expense', label: 'Expense', icon: '📤', blurb: 'Spending categories' },
];

interface FormState {
  name: string;
  type: AccountType;
  closing_day: string;
  due_day: string;
  credit_limit: string;
}

const EMPTY_FORM: FormState = { name: '', type: 'asset', closing_day: '', due_day: '', credit_limit: '' };

function formatBalance(balance: string): string {
  const n = Math.abs(parseFloat(balance));
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function AccountsScreen({ accounts, onChanged }: Props) {
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const openCreate = (type: AccountType) => {
    setEditingId(null);
    setForm({ name: '', type, closing_day: '', due_day: '', credit_limit: '' });
    setShowForm(true);
  };

  const openEdit = (a: AccountWithBalance) => {
    setEditingId(a.id);
    setForm({
      name: a.name,
      type: a.type as AccountType,
      closing_day: a.closing_day != null ? String(a.closing_day) : '',
      due_day: a.due_day != null ? String(a.due_day) : '',
      credit_limit: a.credit_limit != null ? String(a.credit_limit) : '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    const isCard = form.type === 'liability';
    const closingDay = form.closing_day.trim() ? Number(form.closing_day.trim()) : null;
    const dueDay = form.due_day.trim() ? Number(form.due_day.trim()) : null;
    const creditLimit = form.credit_limit.trim() ? form.credit_limit.trim() : null;
    if (isCard && (closingDay === null || dueDay === null)) {
      Alert.alert('Validation', 'Credit cards need a closing day and a due day');
      return;
    }
    if (closingDay !== null && (closingDay < 1 || closingDay > 31)) {
      Alert.alert('Validation', 'Closing day must be between 1 and 31');
      return;
    }
    if (dueDay !== null && (dueDay < 1 || dueDay > 31)) {
      Alert.alert('Validation', 'Due day must be between 1 and 31');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        closing_day: isCard ? closingDay : undefined,
        due_day: isCard ? dueDay : undefined,
        credit_limit: isCard && creditLimit ? creditLimit : undefined,
      };
      if (editingId) {
        await updateAccount(editingId, payload);
      } else {
        await createAccount(payload);
      }
      setShowForm(false);
      await onChanged();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (a: AccountWithBalance) => {
    Alert.alert(
      `Delete "${a.name}"?`,
      'This will permanently remove the account. It can only be deleted if no ledger entries or sub-accounts reference it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount(a.id);
              await onChanged();
            } catch (err) {
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : 'Failed to delete account',
              );
            }
          },
        },
      ],
    );
  };

  const showActions = (a: AccountWithBalance) => {
    Alert.alert(a.name, undefined, [
      { text: 'Edit', onPress: () => openEdit(a) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(a) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) => a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q),
    );
  }, [query, accounts]);

  const renderAccountRow = (a: AccountWithBalance) => {
    const isDebt = a.type === 'liability';
    return (
      <TouchableOpacity
        key={a.id}
        style={styles.accountRow}
        onPress={() => showActions(a)}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={`${a.name}. Long press for actions.`}
      >
        <View style={[styles.accountIconCircle, isDebt && styles.accountIconDebt]}>
          <Text style={styles.accountIconText}>{isDebt ? '💳' : '🏦'}</Text>
        </View>
        <View style={styles.accountRowInfo}>
          <Text style={styles.accountRowName}>{a.name}</Text>
          <Text style={styles.accountRowMeta}>
            {a.transaction_count} ledger entr{a.transaction_count === 1 ? 'y' : 'ies'}
          </Text>
        </View>
        <Text style={isDebt ? styles.accountBalanceDebt : styles.accountBalance}>
          {formatBalance(a.balance)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Accounts</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => openCreate('asset')}>
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.accountSearch}
        value={query}
        onChangeText={setQuery}
        placeholder="Search accounts…"
        placeholderTextColor={colors.textDim}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {accounts.length === 0 ? (
        <EmptyState
          compact
          icon="🏦"
          title="No accounts yet"
          description="Create your first account — a checking account, credit card or savings — to start tracking balances."
          actionLabel="+ New Account"
          onAction={() => openCreate('asset')}
        />
      ) : (
        ACCOUNT_GROUPS.map((group) => {
          const items = visible.filter((a) => a.type === group.key);
          return (
            <View key={group.key} style={styles.accountGroup}>
              <View style={styles.accountGroupHeader}>
                <Text style={styles.accountGroupIcon}>{group.icon}</Text>
                <View style={styles.accountGroupHeaderText}>
                  <Text style={styles.accountGroupTitle}>{group.label}</Text>
                  <Text style={styles.accountGroupBlurb}>{group.blurb}</Text>
                </View>
                <Text style={styles.accountGroupBadge}>{items.length}</Text>
              </View>
              {items.length > 0 ? (
                <View style={styles.accountList}>
                  {items.map(renderAccountRow)}
                </View>
              ) : (
                <Text style={styles.accountGroupEmpty}>No {group.label.toLowerCase()} yet.</Text>
              )}
            </View>
          );
        })
      )}


      <Modal
        visible={showForm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Account' : 'New Account'}</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(name) => setForm((f) => ({ ...f, name }))}
              placeholder="e.g. Nubank Credit Card"
              placeholderTextColor={colors.textDim}
              autoFocus
            />

            <Text style={styles.label}>Type</Text>
            <View style={styles.accountTypeGrid}>
              {ACCOUNT_GROUPS.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    styles.accountTypeButton,
                    form.type === t.key && styles.accountTypeButtonActive,
                  ]}
                  onPress={() => setForm((f) => ({ ...f, type: t.key }))}
                >
                  <Text
                    style={[
                      styles.accountTypeButtonText,
                      form.type === t.key && styles.accountTypeButtonTextActive,
                    ]}
                  >
                    {t.icon} {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {form.type === 'liability' && (
              <View style={styles.accountCardFields}>
                <Text style={styles.accountCardFieldsHint}>
                  Credit card: set its monthly billing cycle so purchases land on
                  the right bill and the payment deadline is shown.
                </Text>
                <View style={styles.accountCardFieldsRow}>
                  <View style={styles.accountCardField}>
                    <Text style={styles.label}>Closing day (fatura fecha)</Text>
                    <TextInput
                      style={styles.input}
                      value={form.closing_day}
                      onChangeText={(closing_day) =>
                        setForm((f) => ({ ...f, closing_day }))
                      }
                      placeholder="5"
                      placeholderTextColor={colors.textDim}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  <View style={styles.accountCardField}>
                    <Text style={styles.label}>Due day (vencimento)</Text>
                    <TextInput
                      style={styles.input}
                      value={form.due_day}
                      onChangeText={(due_day) => setForm((f) => ({ ...f, due_day }))}
                      placeholder="15"
                      placeholderTextColor={colors.textDim}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                </View>
                <Text style={styles.label}>Credit limit (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={form.credit_limit}
                  onChangeText={(credit_limit) => setForm((f) => ({ ...f, credit_limit }))}
                  placeholder="5000.00"
                  placeholderTextColor={colors.textDim}
                  keyboardType="decimal-pad"
                />
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowForm(false)}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingId ? 'Save' : 'Create'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

