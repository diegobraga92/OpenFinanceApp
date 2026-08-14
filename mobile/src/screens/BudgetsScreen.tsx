import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BudgetAlertListResponse, BudgetSummaryItem, BudgetSummaryResponse, Category, acknowledgeBudgetAlert, createBudget, deleteBudget, fetchBudgetAlerts, fetchBudgetSummary } from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { useI18n } from '../i18n';
import { EmptyState } from '../components/EmptyState';
import { useSnackbar } from '../components/Snackbar';

interface Props {
  categories: Category[];
  formatMoney: (value: string | number) => string;
}

export function BudgetsScreen({ categories, formatMoney }: Props) {
  const { show: showSnackbar } = useSnackbar();
  const { t, monthNames } = useI18n();
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummaryResponse | null>(null);
  const [alerts, setAlerts] = useState<BudgetAlertListResponse | null>(null);
  const [budgetMonth, setBudgetMonth] = useState(new Date().getMonth() + 1);
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear());
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetSummaryItem | null>(null);
  const [budgetCategoryId, setBudgetCategoryId] = useState('');
  const [budgetAmountLimit, setBudgetAmountLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const loadBudgets = useCallback(async () => {
    try {
      const summ = await fetchBudgetSummary(budgetYear, budgetMonth);
      setBudgetSummary(summ);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : t('budgets.failedLoad'));
    }
    try {
      const alertData = await fetchBudgetAlerts({ acknowledged: false });
      setAlerts(alertData);
    } catch {
      // Alerts are non-critical — don't block the screen if they fail.
    }
  }, [budgetYear, budgetMonth, showSnackbar]);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadBudgets();
    } finally {
      setRefreshing(false);
    }
  }, [loadBudgets]);

  const prevBudgetMonth = () => {
    if (budgetMonth === 1) {
      setBudgetMonth(12);
      setBudgetYear(budgetYear - 1);
    } else {
      setBudgetMonth(budgetMonth - 1);
    }
  };

  const nextBudgetMonth = () => {
    if (budgetMonth === 12) {
      setBudgetMonth(1);
      setBudgetYear(budgetYear + 1);
    } else {
      setBudgetMonth(budgetMonth + 1);
    }
  };

  const openBudgetCreate = () => {
    setEditingBudget(null);
    setBudgetCategoryId('');
    setBudgetAmountLimit('');
    setShowBudgetForm(true);
  };

  const openBudgetEdit = (item: BudgetSummaryItem) => {
    setEditingBudget(item);
    setBudgetCategoryId(item.budget.category_id);
    setBudgetAmountLimit(String(item.budget.amount_limit));
    setShowBudgetForm(true);
  };

  const handleBudgetSubmit = async () => {
    if (!budgetCategoryId) {
      Alert.alert(t('common.validation'), t('budgets.validation.category'));
      return;
    }
    if (!budgetAmountLimit || parseFloat(budgetAmountLimit) <= 0) {
      Alert.alert(t('common.validation'), t('budgets.validation.amount'));
      return;
    }

    setSaving(true);
    try {
      await createBudget({
        category_id: budgetCategoryId,
        month: budgetMonth,
        year: budgetYear,
        amount_limit: budgetAmountLimit,
      });
      setShowBudgetForm(false);
      await loadBudgets();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : t('budgets.failedSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleBudgetDelete = (id: string) => {
    Alert.alert(t('budgets.deleteTitle'), t('budgets.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBudget(id);
            await loadBudgets();
          } catch (err) {
            showSnackbar(err instanceof Error ? err.message : t('budgets.failedDelete'));
          }
        },
      },
    ]);
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeBudgetAlert(id);
      const alertData = await fetchBudgetAlerts({ acknowledged: false });
      setAlerts(alertData);
      showSnackbar(t('budgets.alertAcknowledged'));
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : t('budgets.failedAck'));
    }
  };

  return (
    <ScrollView
      style={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.textMuted}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surface}
        />
      }
    >
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t('budgets.title')}</Text>
        <TouchableOpacity style={styles.addButton} onPress={openBudgetCreate}>
          <Text style={styles.addButtonText}>{t('budgets.add')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity style={styles.navButton} onPress={prevBudgetMonth}>
          <Text style={styles.navButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthNames[budgetMonth - 1]} {budgetYear}</Text>
        <TouchableOpacity style={styles.navButton} onPress={nextBudgetMonth}>
          <Text style={styles.navButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      {alerts && alerts.items.length > 0 && (
        <View style={styles.alertSection}>
          <Text style={styles.alertTitle}>
            {t('budgets.alertsTitle')} {alerts.unacknowledged_count > 0 && `(${alerts.unacknowledged_count})`}
          </Text>
          {alerts.items.map((alert) => {
            const pct = Math.round(
              parseFloat(alert.actual_spent) / Math.max(parseFloat(alert.amount_limit), 0.01) * 100,
            );
            const overLimit = pct >= 100;
            return (
              <View key={alert.id} style={styles.alertCard}>
                <View style={styles.alertInfo}>
                  <Text style={styles.alertCategory}>
                    {alert.category_icon ? `${alert.category_icon} ` : ''}{alert.category_name}
                  </Text>
                  <Text style={[styles.alertText, { color: overLimit ? colors.danger : colors.warningText }]}>
                    {t('budgets.spentOf', { spent: formatMoney(alert.actual_spent), limit: formatMoney(alert.amount_limit), pct })}
                    {overLimit ? t('common.overBudget') : t('common.nearLimit')}
                  </Text>
                </View>
                <TouchableOpacity style={styles.ackButton} onPress={() => handleAcknowledge(alert.id)}>
                  <Text style={styles.ackButtonText}>{t('budgets.acknowledge')}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {!budgetSummary ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading budgets…</Text>
        </View>
      ) : budgetSummary.items.length === 0 ? (
        <View style={styles.emptyCard}>
          <EmptyState
            icon="🎯"
            title={t('budgets.noTitle', { month: monthNames[budgetMonth - 1], year: budgetYear })}
            description={t('budgets.noDesc')}
            actionLabel={t('budgets.add')}
            onAction={openBudgetCreate}
          />
        </View>
      ) : (
        <>
          <View style={styles.overviewCards}>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewLabel}>{t('budgets.totalBudgeted')}</Text>
              <Text style={styles.overviewValue}>{formatMoney(budgetSummary.total_budgeted)}</Text>
            </View>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewLabel}>{t('budgets.totalSpent')}</Text>
              <Text style={[styles.overviewValue, { color: colors.expense }]}>
                {formatMoney(budgetSummary.total_spent)}
              </Text>
            </View>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewLabel}>{t('budgets.remaining')}</Text>
              <Text style={[
                styles.overviewValue,
                {
                  color: parseFloat(budgetSummary.total_budgeted) - parseFloat(budgetSummary.total_spent) >= 0
                    ? colors.income
                    : colors.expense,
                },
              ]}>
                {formatMoney(parseFloat(budgetSummary.total_budgeted) - parseFloat(budgetSummary.total_spent))}
              </Text>
            </View>
          </View>

          {budgetSummary.items.map((item) => {
            const pct = parseFloat(item.percentage);
            const color = pct >= 100 ? colors.danger : pct >= 80 ? colors.warning : colors.primary;
            return (
              <View key={item.budget.id} style={styles.budgetCard}>
                <View style={styles.budgetHeader}>
                  <View style={styles.budgetCategoryRow}>
                    <View style={[styles.categoryIconCircle, { backgroundColor: item.budget.color || colors.surfaceHover }]}>
                      <Text style={styles.categoryIconText}>{item.budget.icon || '•'}</Text>
                    </View>
                    <Text style={styles.budgetCategoryName}>{item.budget.category_name}</Text>
                    {pct >= 80 && (
                      <View style={[styles.warningBadge, { backgroundColor: pct >= 100 ? colors.dangerBg : colors.warningBg }]}>
                        <Text style={{ color: pct >= 100 ? colors.danger : colors.warningText, fontSize: 10, fontWeight: '600' }}>
                          {pct >= 100 ? t('budgets.over') : t('budgets.warning')}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.budgetItemActions}>
                    <TouchableOpacity onPress={() => openBudgetEdit(item)} style={styles.editButton}>
                      <Text style={styles.editButtonText}>{t('common.edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleBudgetDelete(item.budget.id)} style={styles.deleteButton}>
                      <Text style={styles.deleteButtonText}>{t('common.delete')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, pct)}%`, backgroundColor: color }]} />
                </View>

                <View style={styles.budgetMetaRow}>
                  <Text style={styles.budgetMetaText}>
                    {formatMoney(item.actual_spent)} of {formatMoney(item.budget.amount_limit)}
                  </Text>
                  <Text style={[styles.budgetPctText, { color }]}>{Math.round(pct)}%</Text>
                </View>

                <View>
                  {parseFloat(item.remaining) >= 0 ? (
                    <Text style={styles.remainingText}>{t('budgets.remainingAmount', { amount: formatMoney(item.remaining) })}</Text>
                  ) : (
                    <Text style={styles.overText}>
                      {t('budgets.overAmount', { amount: formatMoney(Math.abs(parseFloat(item.remaining))) })}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </>
      )}
      {showBudgetForm && (
        <Modal
          visible={showBudgetForm}
          transparent
          animationType="slide"
          onRequestClose={() => setShowBudgetForm(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingBudget ? t('budgets.form.edit', { name: editingBudget.budget.category_name }) : t('budgets.form.add')}
              </Text>

              <Text style={styles.label}>Category</Text>
              {expenseCategories.length === 0 ? (
                <Text style={styles.emptyText}>{t('budgets.form.noCategories')}</Text>
              ) : editingBudget ? (
                <View style={styles.readOnlyField}>
                  <Text style={styles.readOnlyText}>
                    {editingBudget.budget.category_name}
                  </Text>
                </View>
              ) : (
                <View style={styles.categoryGrid}>
                  {expenseCategories.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.categoryChip, budgetCategoryId === c.id && styles.categoryChipActive]}
                      onPress={() => setBudgetCategoryId(c.id)}
                    >
                      <Text style={[styles.categoryChipText, budgetCategoryId === c.id && styles.categoryChipTextActive]}>
                        {c.icon ? `${c.icon} ` : ''}{c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.label}>{t('budgets.form.monthlyLimit')}</Text>
              <TextInput
                style={styles.input}
                value={budgetAmountLimit}
                onChangeText={setBudgetAmountLimit}
                placeholder="500.00"
                placeholderTextColor={colors.textDim}
                keyboardType="decimal-pad"
              />

              <Text style={styles.monthPreview}>
                {t('common.appliesTo', { month: monthNames[budgetMonth - 1], year: budgetYear })}
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowBudgetForm(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                  onPress={handleBudgetSubmit}
                  disabled={saving || expenseCategories.length === 0}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.primaryText} />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {editingBudget ? t('common.save') : t('common.create')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}
