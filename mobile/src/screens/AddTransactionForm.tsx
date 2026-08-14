import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Category, Transaction, AccountWithBalance, createTransaction, updateTransaction } from '../api';
import { findPreviousTransaction } from '../offline/autocomplete';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { useI18n } from '../i18n';
import { categoryIcon } from '../../../shared/category-icons';

interface Props {
  categories: Category[];
  accounts: AccountWithBalance[];
  editing: Transaction | null;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}

/** Format an ISO date (YYYY-MM-DD) as DD/MM/YYYY for display. */
function formatDateDisplay(iso: string) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Build an ISO date string from a local Date (avoids UTC off-by-one). */
function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function AddTransactionForm({ categories, accounts, editing, onSaved, onCancel }: Props) {
  const { t } = useI18n();
  const [description, setDescription] = useState(editing?.description ?? '');
  const [amount, setAmount] = useState(editing?.amount ?? '');
  const [type, setType] = useState<'income' | 'expense'>(
    editing?.type === 'income' ? 'income' : 'expense',
  );
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? '');
  const [accountId, setAccountId] = useState(editing?.account_id ?? '');
  const [installments, setInstallments] = useState('1');
  const [date, setDate] = useState(editing?.date ?? new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Hint text shown when description auto-completes amount/category from history. */
  const [autoFilledHint, setAutoFilledHint] = useState<string | null>(null);
  /** Latches off once the user manually edits amount/type/category. */
  const autoFillDisabled = useRef(false);

  const categoriesForType = categories.filter((c) => c.type === type);
  const paymentAccounts = accounts.filter(
    (a) => a.account_kind === 'bank' || a.account_kind === 'cash' || a.account_kind === 'card',
  );

  /**
   * Auto-complete from a previously-added transaction: when the typed
   * description matches history and the amount/category are still untouched,
   * fill amount + type + category together (they form a consistent tuple).
   */
  const handleDescriptionChange = (text: string) => {
    setDescription(text);
    if (editing || autoFillDisabled.current) return;

    const prev = findPreviousTransaction(text);
    if (prev && amount === '' && categoryId === '') {
      const cat = categories.find((c) => c.id === prev.category_id);
      setAmount(prev.amount);
      setType(prev.type);
      setCategoryId(prev.category_id ?? '');
      setAutoFilledHint(
        t('transactions.form.filledPrevious', {
          amount: `R$ ${prev.amount}`,
          category: cat ? `${cat.icon ? `${categoryIcon(cat.icon)} ` : ''}${cat.name}` : t('transactions.form.noCategory'),
        }),
      );
    } else if (!prev) {
      // No longer matches history — drop the hint (auto-filled values stay
      // unless the user edits them manually).
      setAutoFilledHint(null);
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert(t('common.validation'), t('transactions.form.validationDesc'));
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert(t('common.validation'), t('transactions.form.validationAmount'));
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
        account_id: accountId || null,
        installments: parseInt(installments, 10) > 1 ? parseInt(installments, 10) : undefined,
      };
      if (editing) {
        await updateTransaction(editing.id, payload);
      } else {
        await createTransaction(payload);
      }
      await onSaved();
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('transactions.form.failedSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>{editing ? t('transactions.form.edit') : t('transactions.form.add')}</Text>

        <Text style={styles.label}>{t('common.description')}</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={handleDescriptionChange}
          placeholder={t('transactions.form.descriptionPlaceholder')}
          placeholderTextColor={colors.textDim}
        />
        {autoFilledHint && <Text style={styles.autoFillHint}>{autoFilledHint}</Text>}

        <Text style={styles.label}>{t('transactions.form.amount')}</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            autoFillDisabled.current = true;
            setAutoFilledHint(null);
          }}
          placeholder={t('transactions.form.amountPlaceholder')}
          placeholderTextColor={colors.textDim}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>{t('common.date')}</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
          accessibilityLabel={t('transactions.form.openDate')}
          accessibilityRole="button"
        >
          <Text style={styles.dateButtonText}>📅 {formatDateDisplay(date)}</Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' && showDatePicker && (
          <Modal transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerModal}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.datePickerCancel}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <Text style={styles.datePickerTitle}>{t('common.date')}</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.datePickerDone}>{t('common.done')}</Text>
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
        <Text style={styles.label}>{t('common.type')}</Text>
        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[styles.typeButton, type === 'expense' && styles.typeButtonActive]}
            onPress={() => {
              setType('expense');
              autoFillDisabled.current = true;
              setAutoFilledHint(null);
              const cat = categories.find((c) => c.id === categoryId);
              if (cat && cat.type !== 'expense') setCategoryId('');
            }}
          >
            <Text style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextActive]}>
              {t('common.expense')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, type === 'income' && styles.typeButtonActive]}
            onPress={() => {
              setType('income');
              autoFillDisabled.current = true;
              setAutoFilledHint(null);
              const cat = categories.find((c) => c.id === categoryId);
              if (cat && cat.type !== 'income') setCategoryId('');
            }}
          >
            <Text style={[styles.typeButtonText, type === 'income' && styles.typeButtonTextActive]}>
              {t('common.income')}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>{t('common.category')}</Text>
        {categoriesForType.length === 0 ? (
          <Text style={styles.emptyText}>{t('transactions.form.noCategories', { type: t(type === 'expense' ? 'common.expense' : 'common.income') })}</Text>
        ) : (
          <View style={styles.categoryGrid}>
            <TouchableOpacity
              style={[styles.categoryChip, !categoryId && styles.categoryChipActive]}
              onPress={() => {
                setCategoryId('');
                autoFillDisabled.current = true;
                setAutoFilledHint(null);
              }}
            >
              <Text style={[styles.categoryChipText, !categoryId && styles.categoryChipTextActive]}>
                {t('common.none')}
              </Text>
            </TouchableOpacity>
            {categoriesForType.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.categoryChip, categoryId === c.id && styles.categoryChipActive]}
                onPress={() => {
                  setCategoryId(c.id);
                  autoFillDisabled.current = true;
                  setAutoFilledHint(null);
                }}
              >
                <Text style={[styles.categoryChipText, categoryId === c.id && styles.categoryChipTextActive]}>
                  {c.icon ? `${categoryIcon(c.icon)} ` : ''}{c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>{t('transactions.form.account')}</Text>
        {paymentAccounts.length === 0 ? (
          <Text style={styles.emptyText}>{t('transactions.form.accountPlaceholder')}</Text>
        ) : (
          <View style={styles.categoryGrid}>
            <TouchableOpacity
              style={[styles.categoryChip, !accountId && styles.categoryChipActive]}
              onPress={() => {
                setAccountId('');
                autoFillDisabled.current = true;
              }}
            >
              <Text style={[styles.categoryChipText, !accountId && styles.categoryChipTextActive]}>
                {t('transactions.form.defaultAccount')}
              </Text>
            </TouchableOpacity>
            {paymentAccounts.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[styles.categoryChip, accountId === a.id && styles.categoryChipActive]}
                onPress={() => {
                  setAccountId(a.id);
                  autoFillDisabled.current = true;
                }}
              >
                <Text style={[styles.categoryChipText, accountId === a.id && styles.categoryChipTextActive]}>
                  {a.type === 'liability' ? '💳 ' : '🏦 '}{a.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>{t('transactions.form.installments')}</Text>
        <TextInput
          style={styles.input}
          value={installments}
          onChangeText={(v) => {
            setInstallments(v.replace(/[^0-9]/g, ''));
            autoFillDisabled.current = true;
          }}
          keyboardType="number-pad"
          placeholder="1"
          placeholderTextColor={colors.textDim}
        />
        {parseInt(installments, 10) > 1 && amount ? (
          <Text style={styles.autoFillHint}>
            {t('transactions.form.perInstallment', {
              installments,
              amount: `R$ ${(parseFloat(amount) / parseInt(installments, 10)).toFixed(2)}`,
            })}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.submitButton, saving && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.submitButtonText}>
              {editing ? t('transactions.form.saveChanges') : t('transactions.form.add')}
            </Text>
          )}
        </TouchableOpacity>

        {editing && (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}
