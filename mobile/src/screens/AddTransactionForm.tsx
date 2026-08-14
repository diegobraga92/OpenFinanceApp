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
import { Category, Transaction, createTransaction, updateTransaction } from '../api';
import { findPreviousTransaction } from '../offline/autocomplete';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';

interface Props {
  categories: Category[];
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

export function AddTransactionForm({ categories, editing, onSaved, onCancel }: Props) {
  const [description, setDescription] = useState(editing?.description ?? '');
  const [amount, setAmount] = useState(editing?.amount ?? '');
  const [type, setType] = useState<'income' | 'expense'>(
    editing?.type === 'income' ? 'income' : 'expense',
  );
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? '');
  const [date, setDate] = useState(editing?.date ?? new Date().toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Hint text shown when description auto-completes amount/category from history. */
  const [autoFilledHint, setAutoFilledHint] = useState<string | null>(null);
  /** Latches off once the user manually edits amount/type/category. */
  const autoFillDisabled = useRef(false);

  const categoriesForType = categories.filter((c) => c.type === type);

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
        `↩ Filled from previous: R$ ${prev.amount} · ${
          cat ? `${cat.icon ? `${cat.icon} ` : ''}${cat.name}` : 'No category'
        }`,
      );
    } else if (!prev) {
      // No longer matches history — drop the hint (auto-filled values stay
      // unless the user edits them manually).
      setAutoFilledHint(null);
    }
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
      await onSaved();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>{editing ? 'Edit Transaction' : 'Add Transaction'}</Text>

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={handleDescriptionChange}
          placeholder="e.g. Lunch at Restaurante X"
          placeholderTextColor={colors.textDim}
        />
        {autoFilledHint && <Text style={styles.autoFillHint}>{autoFilledHint}</Text>}

        <Text style={styles.label}>Amount (R$)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            autoFillDisabled.current = true;
            setAutoFilledHint(null);
          }}
          placeholder="0.00"
          placeholderTextColor={colors.textDim}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Date</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
          accessibilityLabel="Pick transaction date"
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
                    <Text style={styles.datePickerCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Select Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.datePickerDone}>Done</Text>
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
        <Text style={styles.label}>Type</Text>
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
              Expense
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
              Income
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Category</Text>
        {categoriesForType.length === 0 ? (
          <Text style={styles.emptyText}>No {type} categories. Create one in the Categories screen!</Text>
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
                None
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
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.submitButtonText}>
              {editing ? 'Save Changes' : 'Add Transaction'}
            </Text>
          )}
        </TouchableOpacity>

        {editing && (
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}
