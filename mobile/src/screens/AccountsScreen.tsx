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
import { useI18n } from '../i18n';
import type { TranslationKey } from '../../../shared/i18n';

interface Props {
  accounts: AccountWithBalance[];
  onChanged: () => Promise<void>;
}

type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

const ACCOUNT_GROUPS: {
  key: AccountType;
  labelKey: TranslationKey;
  blurbKey: TranslationKey;
  icon: string;
}[] = [
  { key: 'asset', labelKey: 'accounts.type.asset', blurbKey: 'accounts.type.assetBlurb', icon: '💰' },
  { key: 'liability', labelKey: 'accounts.type.liability', blurbKey: 'accounts.type.liabilityBlurb', icon: '💳' },
  { key: 'equity', labelKey: 'accounts.type.equity', blurbKey: 'accounts.type.equityBlurb', icon: '🏛️' },
  { key: 'income', labelKey: 'accounts.type.income', blurbKey: 'accounts.type.incomeBlurb', icon: '📥' },
  { key: 'expense', labelKey: 'accounts.type.expense', blurbKey: 'accounts.type.expenseBlurb', icon: '📤' },
];

interface FormState {
  name: string;
  type: AccountType;
  closing_day: string;
  due_day: string;
  credit_limit: string;
}

const EMPTY_FORM: FormState = { name: '', type: 'asset', closing_day: '', due_day: '', credit_limit: '' };

export function AccountsScreen({ accounts, onChanged }: Props) {
  const { t, formatMoney } = useI18n();
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
      Alert.alert(t('common.validation'), t('accounts.validation.name'));
      return;
    }
    const isCard = form.type === 'liability';
    const closingDay = form.closing_day.trim() ? Number(form.closing_day.trim()) : null;
    const dueDay = form.due_day.trim() ? Number(form.due_day.trim()) : null;
    const creditLimit = form.credit_limit.trim() ? form.credit_limit.trim() : null;
    if (isCard && (closingDay === null || dueDay === null)) {
      Alert.alert(t('common.validation'), t('accounts.validation.cardDays'));
      return;
    }
    if (closingDay !== null && (closingDay < 1 || closingDay > 31)) {
      Alert.alert(t('common.validation'), t('accounts.validation.closingDay'));
      return;
    }
    if (dueDay !== null && (dueDay < 1 || dueDay > 31)) {
      Alert.alert(t('common.validation'), t('accounts.validation.dueDay'));
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
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('accounts.failedSave'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (a: AccountWithBalance) => {
    Alert.alert(
      t('accounts.deleteTitle', { name: a.name }),
      t('accounts.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount(a.id);
              await onChanged();
            } catch (err) {
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : t('accounts.failedDelete'),
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
        accessibilityLabel={`${a.name}. ${t('accounts.form.longPress')}`}
      >
        <View style={[styles.accountIconCircle, isDebt && styles.accountIconDebt]}>
          <Text style={styles.accountIconText}>{isDebt ? '💳' : '🏦'}</Text>
        </View>
        <View style={styles.accountRowInfo}>
          <Text style={styles.accountRowName}>{a.name}</Text>
          <Text style={styles.accountRowMeta}>
            {t(a.transaction_count === 1 ? 'accounts.form.countEntries_one' : 'accounts.form.countEntries_other', { count: a.transaction_count })}
          </Text>
        </View>
        <Text style={isDebt ? styles.accountBalanceDebt : styles.accountBalance}>
          {formatMoney(a.balance)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t('accounts.title')}</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => openCreate('asset')}>
          <Text style={styles.addButtonText}>{t('accounts.new')}</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.accountSearch}
        value={query}
        onChangeText={setQuery}
        placeholder={t('accounts.search')}
        placeholderTextColor={colors.textDim}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {accounts.length === 0 ? (
        <EmptyState
          compact
          icon="🏦"
          title={t('accounts.noTitle')}
          description={t('accounts.noDesc')}
          actionLabel={t('accounts.new')}
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
                  <Text style={styles.accountGroupTitle}>{t(group.labelKey)}</Text>
                  <Text style={styles.accountGroupBlurb}>{t(group.blurbKey)}</Text>
                </View>
                <Text style={styles.accountGroupBadge}>{items.length}</Text>
              </View>
              {items.length > 0 ? (
                <View style={styles.accountList}>
                  {items.map(renderAccountRow)}
                </View>
              ) : (
                <Text style={styles.accountGroupEmpty}>{t('accounts.form.noGroup', { label: t(group.labelKey).toLowerCase() })}</Text>
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
            <Text style={styles.modalTitle}>{editingId ? t('accounts.form.edit') : t('accounts.form.new')}</Text>

            <Text style={styles.label}>{t('accounts.form.name')}</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(name) => setForm((f) => ({ ...f, name }))}
              placeholder={t('accounts.form.namePlaceholder')}
              placeholderTextColor={colors.textDim}
              autoFocus
            />

            <Text style={styles.label}>{t('accounts.form.type')}</Text>
            <View style={styles.accountTypeGrid}>
              {ACCOUNT_GROUPS.map((groupType) => (
                <TouchableOpacity
                  key={groupType.key}
                  style={[
                    styles.accountTypeButton,
                    form.type === groupType.key && styles.accountTypeButtonActive,
                  ]}
                  onPress={() => setForm((f) => ({ ...f, type: groupType.key }))}
                >
                  <Text
                    style={[
                      styles.accountTypeButtonText,
                      form.type === groupType.key && styles.accountTypeButtonTextActive,
                    ]}
                  >
                    {groupType.icon} {t(groupType.labelKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {form.type === 'liability' && (
              <View style={styles.accountCardFields}>
                <Text style={styles.accountCardFieldsHint}>
                  {t('accounts.form.cardHint')}
                </Text>
                <View style={styles.accountCardFieldsRow}>
                  <View style={styles.accountCardField}>
                    <Text style={styles.label}>{t('accounts.form.closingDay')}</Text>
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
                    <Text style={styles.label}>{t('accounts.form.dueDay')}</Text>
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
                <Text style={styles.label}>{t('accounts.form.creditLimit')}</Text>
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
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
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
                    {editingId ? t('common.save') : t('common.create')}
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

