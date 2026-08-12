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
import {
  Category,
  InstallmentPlan,
  InstallmentPlanDetail,
  createInstallmentPlan,
  deleteInstallmentPlan,
  fetchInstallmentPlan,
  fetchInstallmentPlans,
  generateInstallments,
  payInstallment,
} from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { EmptyState } from '../components/EmptyState';
import { useSnackbar } from '../components/Snackbar';

interface Props {
  categories: Category[];
  formatMoney: (value: string | number) => string;
}

export function InstallmentsScreen({ categories, formatMoney }: Props) {
  const { show: showSnackbar } = useSnackbar();
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [installmentCount, setInstallmentCount] = useState('3');
  const [categoryId, setCategoryId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<InstallmentPlanDetail | null>(null);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const loadPlans = useCallback(async () => {
    try {
      const data = await fetchInstallmentPlans();
      setPlans(data);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to load installment plans');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadPlans();
    } finally {
      setRefreshing(false);
    }
  }, [loadPlans]);

  const openDetail = async (id: string) => {
    try {
      const d = await fetchInstallmentPlan(id);
      setDetail(d);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to load plan detail');
    }
  };

  const resetForm = () => {
    setDescription('');
    setTotalAmount('');
    setInstallmentCount('3');
    setCategoryId('');
    setStartDate(new Date().toISOString().slice(0, 10));
  };

  const handleCreate = async () => {
    const total = parseFloat(totalAmount);
    const count = parseInt(installmentCount, 10);
    if (!description.trim()) {
      Alert.alert('Validation', 'Description is required');
      return;
    }
    if (!total || total <= 0) {
      Alert.alert('Validation', 'Total amount must be greater than zero');
      return;
    }
    if (count < 2 || count > 60) {
      Alert.alert('Validation', 'Installments must be between 2 and 60');
      return;
    }
    if (!startDate) {
      Alert.alert('Validation', 'Start date is required');
      return;
    }

    setSaving(true);
    try {
      await createInstallmentPlan({
        description: description.trim(),
        total_amount: totalAmount,
        installments: count,
        category_id: categoryId || undefined,
        start_date: startDate,
      });
      setShowForm(false);
      resetForm();
      await loadPlans();
      showSnackbar('Installment plan created');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to create installment plan');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async (id: string) => {
    try {
      const res = await generateInstallments(id);
      showSnackbar(`Generated ${res.generated} installment transaction(s)`);
      await loadPlans();
      if (detail && detail.plan.id === id) setDetail(await fetchInstallmentPlan(id));
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to generate installments');
    }
  };

  const handlePay = async (planId: string, number: number) => {
    try {
      await payInstallment(planId, number);
      showSnackbar(`Installment ${number} marked as paid`);
      setDetail(await fetchInstallmentPlan(planId));
      await loadPlans();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to pay installment');
    }
  };

  const handleDelete = (plan: InstallmentPlan) => {
    Alert.alert('Delete installment plan?', `This will delete "${plan.description}" and unlink generated transactions.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteInstallmentPlan(plan.id);
            setDetail(null);
            await loadPlans();
            showSnackbar('Installment plan deleted');
          } catch (err) {
            showSnackbar(err instanceof Error ? err.message : 'Failed to delete installment plan');
          }
        },
      },
    ]);
  };

  const paidPct = (plan: InstallmentPlan) =>
    plan.installments > 0 ? Math.round((plan.progress.paid_count / plan.installments) * 100) : 0;
  return (
    <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Installments</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Text style={styles.addButtonText}>+ New Plan</Text>
        </TouchableOpacity>
      </View>

      {!loading && plans.length === 0 && (
        <EmptyState
          icon="📅"
          title="No installment plans"
          description="Split a purchase into N monthly payments."
        />
      )}

      {plans.map((plan) => {
        const pct = paidPct(plan);
        const overDue = plan.progress.pending_count > 0 && plan.start_date <= new Date().toISOString().slice(0, 10);
        return (
          <View key={plan.id} style={styles.planCard}>
            <View style={styles.planHeader}>
              <View style={styles.planCategory}>
                <View style={[styles.categoryIconCircle, { backgroundColor: plan.category_color || colors.surfaceHover }]}>
                  <Text style={styles.categoryIconEmoji}>{plan.category_icon || '📦'}</Text>
                </View>
                <View style={styles.planTitleBlock}>
                  <Text style={styles.planTitle}>{plan.description}</Text>
                  <Text style={styles.planSubtitle}>
                    {plan.category_name || 'Uncategorized'} · {plan.progress.paid_count}/{plan.installments} paid
                  </Text>
                </View>
              </View>
              <View style={styles.planAmounts}>
                <Text style={styles.planTotal}>{formatMoney(plan.total_amount)}</Text>
                <Text style={styles.planRemaining}>{formatMoney(plan.installment_amount)}/mo</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${pct}%`,
                    backgroundColor: pct >= 100 ? colors.primary : colors.warning,
                  },
                ]}
              />
            </View>
            <View style={styles.planActions}>
              {overDue && plan.progress.pending_count > 0 && (
                <TouchableOpacity style={styles.planActionButton} onPress={() => handleGenerate(plan.id)}>
                  <Text style={styles.planActionButtonText}>Generate</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.planActionButton} onPress={() => openDetail(plan.id)}>
                <Text style={styles.planActionButtonText}>View</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.planActionButton, styles.planDeleteButton]} onPress={() => handleDelete(plan)}>
                <Text style={styles.planDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}


      {detail && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setDetail(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalTitleRow}>
                <Text style={styles.modalTitle}>{detail.plan.description}</Text>
                <TouchableOpacity onPress={() => setDetail(null)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.planDetailMeta}>
                {formatMoney(detail.plan.installment_amount)} × {detail.plan.installments} · Total {formatMoney(detail.plan.total_amount)} · {detail.plan.progress.paid_count} paid
              </Text>
              {detail.installments.map((inst) => (
                <View key={inst.id} style={styles.installmentRow}>
                  <Text style={styles.installmentNumber}>#{inst.installment_number}</Text>
                  <Text style={styles.installmentDue}>{inst.due_date}</Text>
                  <Text style={styles.installmentStatus}>
                    {inst.status === 'paid' ? '✅ Paid' : inst.status === 'generated' ? '🟡 Gen' : '⚪ Pending'}
                  </Text>
                  {inst.status !== 'paid' && (
                    <TouchableOpacity
                      style={styles.payButton}
                      onPress={() => handlePay(detail.plan.id, inst.installment_number)}
                    >
                      <Text style={styles.payButtonText}>Pay</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        </Modal>
      )}



      {showForm && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>New Installment Plan</Text>

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="TV 55&quot; Samsung"
                placeholderTextColor={colors.textDim}
              />

              <Text style={styles.label}>Total amount (R$)</Text>
              <TextInput
                style={styles.input}
                value={totalAmount}
                onChangeText={setTotalAmount}
                placeholder="1200.00"
                placeholderTextColor={colors.textDim}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Installments (2-60)</Text>
              <TextInput
                style={styles.input}
                value={installmentCount}
                onChangeText={setInstallmentCount}
                placeholder="3"
                placeholderTextColor={colors.textDim}
                keyboardType="number-pad"
              />

              {totalAmount && installmentCount && parseInt(installmentCount, 10) > 0 && (
                <Text style={styles.monthPreview}>
                  ≈ {formatMoney((parseFloat(totalAmount) / parseInt(installmentCount, 10)).toFixed(2))} per month
                </Text>
              )}

              <Text style={styles.label}>Category (optional)</Text>
              <View style={styles.categoryGrid}>
                <TouchableOpacity
                  style={[styles.categoryChip, categoryId === '' && styles.categoryChipActive]}
                  onPress={() => setCategoryId('')}
                >
                  <Text style={[styles.categoryChipText, categoryId === '' && styles.categoryChipTextActive]}>None</Text>
                </TouchableOpacity>
                {expenseCategories.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.categoryChip, categoryId === c.id && styles.categoryChipActive]}
                    onPress={() => setCategoryId(c.id)}
                  >
                    <Text style={[styles.categoryChipText, categoryId === c.id && styles.categoryChipTextActive]}>
                      {c.icon ? `${c.icon} ` : ''}{c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>First installment date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-08-01"
                placeholderTextColor={colors.textDim}
                autoCapitalize="none"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowForm(false)} disabled={saving}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                  onPress={handleCreate}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.submitButtonText}>Create</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}
