import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Category } from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { useI18n } from '../i18n';
import { EmptyState } from '../components/EmptyState';
import { categoryIcon } from '../../../shared/category-icons';
import { useNotificationCapture } from '../notifications/NotificationCaptureProvider';
import type { PendingCapture } from '../notifications/capture';

interface Props {
  categories: Category[];
  formatMoney: (value: string | number) => string;
}

/**
 * Reviews captured-but-unconfirmed transactions (ask mode). Each entry can be
 * imported as-is, edited, or skipped; the inbox itself is durable (survives
 * restarts) and grouped by the source app.
 */
export function PendingCapturesScreen({ categories, formatMoney }: Props) {
  const { t } = useI18n();
  const { pendingItems, approve, approveAll, skip } = useNotificationCapture();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PendingCapture | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Group by source app label, preserving capture order within each group.
  const grouped = useMemo(() => {
    const map = new Map<string, PendingCapture[]>();
    for (const item of pendingItems) {
      const list = map.get(item.sourceLabel) ?? [];
      list.push(item);
      map.set(item.sourceLabel, list);
    }
    return Array.from(map.entries());
  }, [pendingItems]);

  const openEdit = (item: PendingCapture) => {
    setEditing(item);
    setEditDescription(item.description);
    setEditAmount(item.amount);
    setEditCategoryId(item.categoryId);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const amount = editAmount.replace(',', '.').trim();
    if (!amount || !(parseFloat(amount) > 0)) return;
    try {
      await approve(editing.id, {
        description: editDescription.trim() || editing.description,
        amount,
        categoryId: editCategoryId,
      });
      setEditing(null);
    } catch {
      // approve() already surfaced the error via snackbar.
    }
  };

  const handleApprove = async (id: string) => {
    setBusyId(id);
    try {
      await approve(id);
    } catch {
      // approve() already surfaced the error via snackbar.
    } finally {
      setBusyId(null);
    }
  };

  if (pendingItems.length === 0) {
    return (
      <ScrollView style={styles.content}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>{t('notifications.reviewTitle')}</Text>
        </View>
        <EmptyState
          icon="📥"
          title={t('notifications.reviewEmpty')}
          description={t('notifications.reviewEmptyDesc')}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.content}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t('notifications.reviewTitle')}</Text>
        {pendingItems.length > 1 && (
          <TouchableOpacity style={styles.addButton} onPress={approveAll}>
            <Text style={styles.addButtonText}>{t('notifications.approveAll')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {grouped.map(([label, items]) => (
        <View key={label} style={styles.section}>
          <Text style={styles.sectionTitle}>{t('notifications.fromApp', { app: label })}</Text>
          {items.map((item) => {
            const cat = item.categoryId ? categoryById.get(item.categoryId) : undefined;
            const isIncome = item.type === 'income';
            return (
              <View key={item.id} style={styles.receiptRow}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.transactionDescription} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <Text style={styles.receiptRowDate}>
                    {item.date} · {cat ? `${categoryIcon(cat.icon ?? '')} ${cat.name}` : t('common.uncategorised')}
                  </Text>
                </View>
                <Text style={{ color: isIncome ? colors.income : colors.expense, fontWeight: '600' }}>
                  {formatMoney(item.amount)}
                </Text>
                <View style={styles.receiptActions}>
                  <TouchableOpacity
                    style={styles.receiptActionButton}
                    onPress={() => openEdit(item)}
                    disabled={busyId === item.id}
                  >
                    <Text style={styles.receiptActionText}>{t('notifications.edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.receiptActionButton}
                    onPress={() => skip(item.id)}
                    disabled={busyId === item.id}
                  >
                    <Text style={styles.receiptActionText}>{t('notifications.skip')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.receiptActionButton}
                    onPress={() => handleApprove(item.id)}
                    disabled={busyId === item.id}
                  >
                    {busyId === item.id ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <Text style={[styles.receiptActionText, { color: colors.primary, fontWeight: '700' }]}>
                        {t('notifications.approve')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      ))}

      {editing && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setEditing(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('notifications.captureTitle')}</Text>

              <Text style={styles.label}>{t('common.description')}</Text>
              <TextInput
                style={styles.input}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder={t('notifications.descriptionPlaceholder')}
                placeholderTextColor={colors.textDim}
              />

              <Text style={styles.label}>{t('common.amount')}</Text>
              <TextInput
                style={styles.input}
                value={editAmount}
                onChangeText={setEditAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textDim}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>{t('common.category')}</Text>
              <View style={styles.categoryGrid}>
                <TouchableOpacity
                  style={[styles.categoryChip, editCategoryId === null && styles.categoryChipActive]}
                  onPress={() => setEditCategoryId(null)}
                >
                  <Text style={[styles.categoryChipText, editCategoryId === null && styles.categoryChipTextActive]}>
                    {t('common.none')}
                  </Text>
                </TouchableOpacity>
                {categories
                  .filter((c) => c.type === editing.type)
                  .map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.categoryChip, editCategoryId === c.id && styles.categoryChipActive]}
                      onPress={() => setEditCategoryId(c.id)}
                    >
                      <Text style={[styles.categoryChipText, editCategoryId === c.id && styles.categoryChipTextActive]}>
                        {c.icon ? `${categoryIcon(c.icon)} ` : ''}{c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setEditing(null)}>
                  <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitButton} onPress={saveEdit}>
                  <Text style={styles.submitButtonText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}
