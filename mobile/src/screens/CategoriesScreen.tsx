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
import { Category, createCategory, deleteCategory, updateCategory } from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../theme/constants';
import { EmptyState } from '../components/EmptyState';

interface Props {
  expenseCategories: Category[];
  incomeCategories: Category[];
  onCreated: () => Promise<void>;
}

type Tab = 'expense' | 'income';

interface FormState {
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
}

const DEFAULT_EXPENSE_ICON = 'shopping-cart';
const DEFAULT_INCOME_ICON = 'briefcase';
const DEFAULT_COLOR = '#6366f1';

function emptyForm(type: 'income' | 'expense'): FormState {
  return {
    name: '',
    type,
    icon: type === 'expense' ? DEFAULT_EXPENSE_ICON : DEFAULT_INCOME_ICON,
    color: DEFAULT_COLOR,
  };
}

function formFromCategory(c: Category): FormState {
  return {
    name: c.name,
    type: c.type as 'income' | 'expense',
    icon: c.icon || (c.type === 'expense' ? DEFAULT_EXPENSE_ICON : DEFAULT_INCOME_ICON),
    color: c.color || DEFAULT_COLOR,
  };
}

export function CategoriesScreen({ expenseCategories, incomeCategories, onCreated }: Props) {
  const [tab, setTab] = useState<Tab>('expense');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm('expense'));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const openCreate = (type: Tab) => {
    setEditingId(null);
    setForm(emptyForm(type));
    setShowForm(true);
  };

  const openEdit = (c: Category) => {
    setEditingId(c.id);
    setForm(formFromCategory(c));
    setShowForm(true);
  };

  const handleCategorySubmit = async () => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        icon: form.icon,
        color: form.color,
      };
      if (editingId) {
        await updateCategory(editingId, payload);
      } else {
        await createCategory(payload);
      }
      setShowForm(false);
      await onCreated();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (c: Category) => {
    Alert.alert(
      `Delete "${c.name}"?`,
      'This will permanently remove the category. It can only be deleted if no transactions use it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(c.id);
              await onCreated();
            } catch (err) {
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : 'Failed to delete category',
              );
            }
          },
        },
      ],
    );
  };

  const showActions = (c: Category) => {
    Alert.alert(c.name, undefined, [
      { text: 'Edit', onPress: () => openEdit(c) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(c) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const visible = useMemo(() => {
    const source = tab === 'expense' ? expenseCategories : incomeCategories;
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.icon || '').toLowerCase().includes(q),
    );
  }, [tab, query, expenseCategories, incomeCategories]);


  const renderCard = (c: Category) => {
    const source = tab === 'expense' ? expenseCategories : incomeCategories;
    const childCount = source.filter((x) => x.parent_id === c.id).length;
    return (
      <TouchableOpacity
        key={c.id}
        style={styles.categoryListRow}
        onPress={() => showActions(c)}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={`${c.name}. Long press for actions.`}
      >
        <View style={[styles.categoryIconCircle, { backgroundColor: c.color || colors.surfaceHover }]}>
          <Text style={styles.categoryIconText}>{c.icon || '•'}</Text>
        </View>
        <View style={styles.categoryRowInfo}>
          <Text style={styles.categoryListTitle}>{c.name}</Text>
          <Text style={styles.categoryCardSub}>
            {c.parent_id
              ? 'Subcategory'
              : childCount > 0
                ? `${childCount} subcategor${childCount === 1 ? 'y' : 'ies'}`
                : 'Top-level'}
          </Text>
        </View>
        <Text style={styles.categoryMore}>⋯</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Categories</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => openCreate(tab)}>
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.categorySearch}
        value={query}
        onChangeText={setQuery}
        placeholder="Search categories…"
        placeholderTextColor={colors.textDim}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.categoryTabs}>
        <TouchableOpacity
          style={[styles.categoryTab, tab === 'expense' && styles.categoryTabActive]}
          onPress={() => setTab('expense')}
        >
          <Text style={[styles.categoryTabText, tab === 'expense' && styles.categoryTabTextActive]}>
            Expenses ({expenseCategories.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.categoryTab, tab === 'income' && styles.categoryTabActive]}
          onPress={() => setTab('income')}
        >
          <Text style={[styles.categoryTabText, tab === 'income' && styles.categoryTabTextActive]}>
            Income ({incomeCategories.length})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.categoryList}>
        {visible.map(renderCard)}
        {visible.length === 0 && (
          <EmptyState
            compact
            icon={tab === 'expense' ? '🛒' : '💰'}
            title={query ? 'No matching categories' : `No ${tab} categories yet`}
            description={
              query
                ? `Nothing matched "${query}". Try a different search term.`
                : `Tap below to create your first ${tab} category.`
            }
            actionLabel="+ New Category"
            onAction={() => openCreate(tab)}
          />
        )}
      </View>


      <Modal
        visible={showForm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Category' : 'New Category'}</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(name) => setForm((f) => ({ ...f, name }))}
              placeholder="e.g. Pets"
              placeholderTextColor={colors.textDim}
              autoFocus
            />

            <Text style={styles.label}>Type</Text>
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[styles.typeButton, form.type === 'expense' && styles.typeButtonActive]}
                onPress={() =>
                  setForm((f) => ({ ...f, type: 'expense', icon: DEFAULT_EXPENSE_ICON }))
                }
              >
                <Text
                  style={[styles.typeButtonText, form.type === 'expense' && styles.typeButtonTextActive]}
                >
                  Expense
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, form.type === 'income' && styles.typeButtonActive]}
                onPress={() =>
                  setForm((f) => ({ ...f, type: 'income', icon: DEFAULT_INCOME_ICON }))
                }
              >
                <Text
                  style={[styles.typeButtonText, form.type === 'income' && styles.typeButtonTextActive]}
                >
                  Income
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Icon</Text>
            <View style={styles.iconGrid}>
              {CATEGORY_ICONS.map((ic) => (
                <TouchableOpacity
                  key={ic}
                  style={[styles.iconButton, form.icon === ic && styles.iconButtonActive]}
                  onPress={() => setForm((f) => ({ ...f, icon: ic }))}
                >
                  <Text style={styles.iconButtonText}>{ic}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Color</Text>
            <View style={styles.colorGrid}>
              {CATEGORY_COLORS.map((col) => (
                <TouchableOpacity
                  key={col}
                  style={[
                    styles.colorButton,
                    { backgroundColor: col },
                    form.color === col && styles.colorButtonActive,
                  ]}
                  onPress={() => setForm((f) => ({ ...f, color: col }))}
                />
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
                onPress={handleCategorySubmit}
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
