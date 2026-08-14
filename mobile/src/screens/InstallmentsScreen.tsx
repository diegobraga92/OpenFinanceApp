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
import { useI18n } from '../i18n';

interface Props {
  categories: Category[];
  formatMoney: (value: string | number) => string;
}

export function InstallmentsScreen({ categories, formatMoney }: Props) {
  const { show: showSnackbar } = useSnackbar();
  const { t } = useI18n();
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
      showSnackbar(err instanceof Error ? err.message : t('installments.failedLoad'));
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
      showSnackbar(err instanceof Error ? err.message : t('installments.failedLoadDetail'));
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
      Alert.alert(t('common.validation'), t('installments.validation.desc'));
      return;
    }
    if (!total || total <= 0) {
      Alert.alert(t('common.validation'), t('installments.validation.total'));
      return;
    }
    if (count < 2 || count > 60) {
      Alert.alert(t('common.validation'), t('installments.validation.count'));
      return;
    }
    if (!startDate) {
      Alert.alert(t('common.validation'), t('installments.validation.date'));
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
      showSnackbar(t('installments.created'));
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : t('installments.failedCreate'));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async (id: string) => {
    try {
      const res = await generateInstallments(id);
      showSnackbar(t('installments.generated', { count: res.generated }));
      await loadPlans();
      if (detail && detail.plan.id === id) setDetail(await fetchInstallmentPlan(id));
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : t('installments.failedGenerate'));
    }
  };

  const handlePay = async (planId: string, number: number) => {
    try {
      await payInstallment(planId, number);
      showSnackbar(t('installments.markedPaid', { number }));
      setDetail(await fetchInstallmentPlan(planId));
      await loadPlans();
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : t('installments.failedPay'));
    }
  };

  const handleDelete = (plan: InstallmentPlan) => {
    Alert.alert(t('installments.deleteTitle'), t('installments.deleteMessage', { description: plan.description }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteInstallmentPlan(plan.id);
            setDetail(null);
            await loadPlans();
            showSnackbar(t('installments.deleted'));
          } catch (err) {
            showSnackbar(err instanceof Error ? err.message : t('installments.failedDelete'));
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
        <Text style={styles.pageTitle}>{t('installments.titleShort')}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Text style={styles.addButtonText}>{t('installments.newPlan')}</Text>
        </TouchableOpacity>
      </View>

      {!loading && plans.length === 0 && (
        <EmptyState
          icon="📅"
          title={t('installments.noTitle')}
          description={t('installments.noDesc')}
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
                    {plan.category_name || t('installments.uncategorised')} · {t('installments.paidCount', { paid: plan.progress.paid_count, total: plan.installments })}
                  </Text>
                </View>
              </View>
              <View style={styles.planAmounts}>
                <Text style={styles.planTotal}>{formatMoney(plan.total_amount)}</Text>
                <Text style={styles.planRemaining}>{t('installments.perMonth', { amount: formatMoney(plan.installment_amount) })}</Text>
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
                  <Text style={styles.planActionButtonText}>{t('installments.generate')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.planActionButton} onPress={() => openDetail(plan.id)}>
                <Text style={styles.planActionButtonText}>{t('installments.view')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.planActionButton, styles.planDeleteButton]} onPress={() => handleDelete(plan)}>
                <Text style={styles.planDeleteText}>{t('common.delete')}</Text>
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
                {formatMoney(detail.plan.installment_amount)} × {detail.plan.installments} · {t('installments.detailTotal', { amount: formatMoney(detail.plan.total_amount) })} · {detail.plan.progress.paid_count} {t('common.paid')}
              </Text>
              {detail.installments.map((inst) => (
                <View key={inst.id} style={styles.installmentRow}>
                  <Text style={styles.installmentNumber}>#{inst.installment_number}</Text>
                  <Text style={styles.installmentDue}>{inst.due_date}</Text>
                  <Text style={styles.installmentStatus}>
                    {inst.status === 'paid' ? t('installments.statusPaid') : inst.status === 'generated' ? t('installments.statusGenerated') : t('installments.statusPending')}
                  </Text>
                  {inst.status !== 'paid' && (
                    <TouchableOpacity
                      style={styles.payButton}
                      onPress={() => handlePay(detail.plan.id, inst.installment_number)}
                    >
                      <Text style={styles.payButtonText}>{t('creditCards.pay')}</Text>
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
              <Text style={styles.modalTitle}>{t('installments.form.title')}</Text>

              <Text style={styles.label}>{t('installments.form.description')}</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder={t('installments.form.descriptionPlaceholder')}
                placeholderTextColor={colors.textDim}
              />

              <Text style={styles.label}>{t('installments.form.total')}</Text>
              <TextInput
                style={styles.input}
                value={totalAmount}
                onChangeText={setTotalAmount}
                placeholder="1200.00"
                placeholderTextColor={colors.textDim}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>{t('installments.form.count')}</Text>
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
                  {t('installments.form.perMonth', { amount: formatMoney((parseFloat(totalAmount) / parseInt(installmentCount, 10)).toFixed(2)) })}
                </Text>
              )}

              <Text style={styles.label}>{t('installments.form.categoryOptional')}</Text>
              <View style={styles.categoryGrid}>
                <TouchableOpacity
                  style={[styles.categoryChip, categoryId === '' && styles.categoryChipActive]}
                  onPress={() => setCategoryId('')}
                >
                  <Text style={[styles.categoryChipText, categoryId === '' && styles.categoryChipTextActive]}>{t('common.none')}</Text>
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

              <Text style={styles.label}>{t('installments.form.firstDate')} (YYYY-MM-DD)</Text>
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
                  <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
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
