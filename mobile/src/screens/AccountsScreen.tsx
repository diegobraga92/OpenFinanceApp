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
}

const EMPTY_FORM: FormState = { name: '', type: 'asset' };

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
    setForm({ name: '', type });
    setShowForm(true);
  };

  const openEdit = (a: AccountWithBalance) => {
    setEditingId(a.id);
    setForm({ name: a.name, type: a.type as AccountType });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), type: form.type };
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

