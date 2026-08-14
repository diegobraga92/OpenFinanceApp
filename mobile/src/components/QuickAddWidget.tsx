import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Transaction, createTransaction } from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { useSnackbar } from './Snackbar';
import { useI18n } from '../i18n';

interface Props {
  /** Which transaction types to offer as quick-add buttons. */
  types: ('income' | 'expense')[];
  /** Transactions used to compute the "spent today" total (only when showTodayTotal). */
  transactions?: Transaction[];
  /** Show a live sum of today's expenses. */
  showTodayTotal?: boolean;
  formatMoney: (value: string | number) => string;
  /** Called after a transaction is created so the parent can reload data. */
  onSaved: () => void;
}

/** Build an ISO date string (YYYY-MM-DD) from a local Date — avoids UTC off-by-one. */
function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function QuickAddWidget({ types, transactions, showTodayTotal, formatMoney, onSaved }: Props) {
  const { show: showSnackbar } = useSnackbar();
  const { t } = useI18n();
  const typeLabel = (type: 'income' | 'expense') => t(type === 'income' ? 'quickAdd.income' : 'quickAdd.expense');
  // Recompute on each render so the widget rolls over correctly past midnight.
  const today = toIsoDate(new Date());
  const [type, setType] = useState<'income' | 'expense'>(types[0] ?? 'expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todaySpent = useMemo(() => {
    if (!showTodayTotal || !transactions) return 0;
    return transactions
      .filter((t) => t.type === 'expense' && t.date === today)
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  }, [showTodayTotal, transactions, today]);

  const handleTypeChange = (next: 'income' | 'expense') => {
    setType(next);
    setError(null);
  };

  const handleSubmit = async () => {
    const value = parseFloat(amount);
    if (!amount || Number.isNaN(value) || value <= 0) {
      setError(t('quickAdd.amountError'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createTransaction({
        description: description.trim() || t('quickAdd.quick', { type: typeLabel(type).toLowerCase() }),
        amount: String(value),
        type,
        category_id: null,
        date: today,
        notes: null,
      });
      setAmount('');
      setDescription('');
      showSnackbar(t('quickAdd.added', { type: typeLabel(type) }));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('quickAdd.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.quickAddCard}>
      <View style={styles.quickAddHeader}>
        <Text style={styles.quickAddTitle}>{t('dashboard.quickAdd')}</Text>
        {showTodayTotal && (
          <View style={styles.quickAddToday}>
            <Text style={styles.quickAddTodayLabel}>{t('dashboard.spentToday')}</Text>
            <Text style={styles.quickAddTodayValue}>{formatMoney(todaySpent)}</Text>
          </View>
        )}
      </View>

      {types.length > 1 && (
        <View style={styles.typeToggle}>
          {types.map((tx) => (
            <TouchableOpacity
              key={tx}
              style={[styles.typeButton, type === tx && styles.typeButtonActive]}
              onPress={() => handleTypeChange(tx)}
              accessibilityRole="button"
              accessibilityLabel={t('quickAdd.quickAria', { type: typeLabel(tx) })}
              accessibilityState={{ selected: type === tx }}
            >
              <Text style={[styles.typeButtonText, type === tx && styles.typeButtonTextActive]}>
                {typeLabel(tx)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.quickAddRow}>
        <TextInput
          style={[styles.input, styles.quickAddAmount]}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={colors.textDim}
          keyboardType="decimal-pad"
          accessibilityLabel={t('quickAdd.amountAria')}
        />
        <TextInput
          style={[styles.input, styles.quickAddDescription]}
          value={description}
          onChangeText={setDescription}
          placeholder={type === 'income' ? t('quickAdd.incomeDescription') : t('quickAdd.expenseDescription')}
          placeholderTextColor={colors.textDim}
          accessibilityLabel={t('quickAdd.descriptionAria')}
        />
      </View>

      {error && <Text style={styles.quickAddError}>{error}</Text>}

      <TouchableOpacity
        style={[
          styles.quickAddButton,
          type === 'income' && styles.quickAddButtonIncome,
          saving && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel={t('quickAdd.addAria', { type: typeLabel(type).toLowerCase() })}
      >
        {saving ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={styles.quickAddButtonText}>+ {typeLabel(type)}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
