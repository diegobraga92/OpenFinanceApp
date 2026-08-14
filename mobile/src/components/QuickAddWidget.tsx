import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Transaction, createTransaction } from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { useSnackbar } from './Snackbar';

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

const TYPE_LABELS: Record<'income' | 'expense', string> = {
  income: 'Income',
  expense: 'Expense',
};

/** Build an ISO date string (YYYY-MM-DD) from a local Date — avoids UTC off-by-one. */
function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function QuickAddWidget({ types, transactions, showTodayTotal, formatMoney, onSaved }: Props) {
  const { show: showSnackbar } = useSnackbar();
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
      setError('Amount must be greater than zero');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createTransaction({
        description: description.trim() || `Quick ${TYPE_LABELS[type].toLowerCase()}`,
        amount: String(value),
        type,
        category_id: null,
        date: today,
        notes: null,
      });
      setAmount('');
      setDescription('');
      showSnackbar(`${TYPE_LABELS[type]} added`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add transaction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.quickAddCard}>
      <View style={styles.quickAddHeader}>
        <Text style={styles.quickAddTitle}>Quick Add</Text>
        {showTodayTotal && (
          <View style={styles.quickAddToday}>
            <Text style={styles.quickAddTodayLabel}>Spent today</Text>
            <Text style={styles.quickAddTodayValue}>{formatMoney(todaySpent)}</Text>
          </View>
        )}
      </View>

      {types.length > 1 && (
        <View style={styles.typeToggle}>
          {types.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeButton, type === t && styles.typeButtonActive]}
              onPress={() => handleTypeChange(t)}
              accessibilityRole="button"
              accessibilityLabel={`${TYPE_LABELS[t]} quick add`}
              accessibilityState={{ selected: type === t }}
            >
              <Text style={[styles.typeButtonText, type === t && styles.typeButtonTextActive]}>
                {TYPE_LABELS[t]}
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
          accessibilityLabel="Amount"
        />
        <TextInput
          style={[styles.input, styles.quickAddDescription]}
          value={description}
          onChangeText={setDescription}
          placeholder={type === 'income' ? 'Income description…' : 'Expense description…'}
          placeholderTextColor={colors.textDim}
          accessibilityLabel="Description"
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
        accessibilityLabel={`Add ${TYPE_LABELS[type].toLowerCase()}`}
      >
        {saving ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={styles.quickAddButtonText}>+ {TYPE_LABELS[type]}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
