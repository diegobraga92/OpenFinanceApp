import React, { useState } from 'react';
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
import { Category, createCategory } from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../theme/constants';
import { EmptyState } from '../components/EmptyState';

interface Props {
  expenseCategories: Category[];
  incomeCategories: Category[];
  onCreated: () => Promise<void>;
}

export function CategoriesScreen({ expenseCategories, incomeCategories, onCreated }: Props) {
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');
  const [newCatIcon, setNewCatIcon] = useState('shopping-cart');
  const [newCatColor, setNewCatColor] = useState('#6366f1');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const openForm = (type: 'income' | 'expense') => {
    setNewCatName('');
    setNewCatType(type);
    setNewCatIcon(type === 'expense' ? 'shopping-cart' : 'briefcase');
    setNewCatColor('#6366f1');
    setShowCategoryForm(true);
  };

  const handleCategorySubmit = async () => {
    if (!newCatName.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    setSaving(true);
    try {
      await createCategory({
        name: newCatName.trim(),
        type: newCatType,
        icon: newCatIcon,
        color: newCatColor,
      });
      setShowCategoryForm(false);
      setNewCatName('');
      setNewCatType('expense');
      setNewCatIcon('shopping-cart');
      setNewCatColor('#6366f1');
      await onCreated();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  const renderCard = (c: Category) => (
    <View key={c.id} style={styles.categoryCard}>
      <View style={[styles.categoryIconCircle, { backgroundColor: c.color || colors.surfaceHover }]}>
        <Text style={styles.categoryIconText}>{c.icon || '•'}</Text>
      </View>
      <Text style={styles.categoryCardName}>{c.name}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.content}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Categories</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => openForm('expense')}>
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.groupTitle}>Expense Categories</Text>
      <View style={styles.categoryGrid}>
        {expenseCategories.map(renderCard)}
        {expenseCategories.length === 0 && (
          <EmptyState
            compact
            icon="🛒"
            title="No expense categories"
            description="Create your first spending category to organize expenses."
            actionLabel="+ New Category"
            onAction={() => openForm('expense')}
          />
        )}
      </View>

      <Text style={styles.groupTitle}>Income Categories</Text>
      <View style={styles.categoryGrid}>
        {incomeCategories.map(renderCard)}
        {incomeCategories.length === 0 && (
          <EmptyState
            compact
            icon="💰"
            title="No income categories"
            description="Create one to track your earnings."
            actionLabel="+ New Category"
            onAction={() => openForm('income')}
          />
        )}
      </View>
      <Modal
        visible={showCategoryForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Category</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder="e.g. Pets"
              placeholderTextColor={colors.textDim}
            />

            <Text style={styles.label}>Type</Text>
            <View style={styles.typeToggle}>
              <TouchableOpacity
                style={[styles.typeButton, newCatType === 'expense' && styles.typeButtonActive]}
                onPress={() => {
                  setNewCatType('expense');
                  setNewCatIcon('shopping-cart');
                }}
              >
                <Text style={[styles.typeButtonText, newCatType === 'expense' && styles.typeButtonTextActive]}>
                  Expense
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, newCatType === 'income' && styles.typeButtonActive]}
                onPress={() => {
                  setNewCatType('income');
                  setNewCatIcon('briefcase');
                }}
              >
                <Text style={[styles.typeButtonText, newCatType === 'income' && styles.typeButtonTextActive]}>
                  Income
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Icon</Text>
            <View style={styles.iconGrid}>
              {CATEGORY_ICONS.map((ic) => (
                <TouchableOpacity
                  key={ic}
                  style={[styles.iconButton, newCatIcon === ic && styles.iconButtonActive]}
                  onPress={() => setNewCatIcon(ic)}
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
                    newCatColor === col && styles.colorButtonActive,
                  ]}
                  onPress={() => setNewCatColor(col)}
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCategoryForm(false)}
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
                  <Text style={styles.submitButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
