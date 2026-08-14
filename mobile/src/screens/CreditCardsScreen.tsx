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
  CardBill,
  CardOverview,
  anticipateInstallments,
  createCardPurchase,
  fetchCardBills,
  fetchCreditCards,
  fetchInstallmentPlan,
  fetchInstallmentPlans,
  payCardBill,
} from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { EmptyState } from '../components/EmptyState';
import { useSnackbar } from '../components/Snackbar';
import { useI18n } from '../i18n';
import { AccountDetailScreen, type AccountLike } from './AccountDetailScreen';

interface Props {
  categories: Category[];
  formatMoney: (value: string | number) => string;
}

interface AnticipatableItem {
  installmentId: string;
  planDescription: string;
  number: number;
  total: number;
  amount: number;
  dueDate: string;
}

export function CreditCardsScreen({ categories, formatMoney }: Props) {
  const { show: showSnackbar } = useSnackbar();
  const { t } = useI18n();
  const [cards, setCards] = useState<CardOverview[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bills, setBills] = useState<CardBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showPurchase, setShowPurchase] = useState(false);
  const [purchaseDesc, setPurchaseDesc] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseCategory, setPurchaseCategory] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const [showPay, setShowPay] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payBillId, setPayBillId] = useState('');

  const [showAnticipate, setShowAnticipate] = useState(false);
  const [anticipatable, setAnticipatable] = useState<AnticipatableItem[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [discountPercent, setDiscountPercent] = useState('');
  const [detailAccount, setDetailAccount] = useState<AccountLike | null>(null);

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const selected = cards.find((c) => c.id === selectedId) ?? null;

  const loadCards = useCallback(async () => {
    try {
      const data = await fetchCreditCards();
      setCards(data);
      setSelectedId((prev) => prev ?? data[0]?.id ?? null);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : t('creditCards.failedLoad'));
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  const loadBills = useCallback(async (cardId: string) => {
    try {
      setBills(await fetchCardBills(cardId));
    } catch {
      setBills([]);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  useEffect(() => {
    if (selectedId) loadBills(selectedId);
  }, [selectedId, loadBills]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadCards();
      if (selectedId) await loadBills(selectedId);
    } finally {
      setRefreshing(false);
    }
  }, [loadCards, loadBills, selectedId]);

  const openAnticipate = async () => {
    if (!selected) return;
    setChecked({});
    setDiscountPercent('');
    try {
      const plans = (await fetchInstallmentPlans()).filter((p) => p.account_id === selected.id);
      const items: AnticipatableItem[] = [];
      for (const plan of plans) {
        const detail = await fetchInstallmentPlan(plan.id);
        for (const inst of detail.installments) {
          if (inst.status === 'paid' || inst.anticipated_at) continue;
          items.push({
            installmentId: inst.id,
            planDescription: detail.plan.description,
            number: inst.installment_number,
            total: detail.plan.installments,
            amount: parseFloat(detail.plan.installment_amount ?? '0'),
            dueDate: inst.due_date,
          });
        }
      }
      setAnticipatable(items);
      setShowAnticipate(true);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : t('creditCards.failedLoadInstallments'));
    }
  };

  const handlePurchase = async () => {
    if (!selected) return;
    const amount = parseFloat(purchaseAmount);
    if (!purchaseDesc.trim()) {
      Alert.alert(t('common.validation'), t('creditCards.validation.desc'));
      return;
    }
    if (!amount || amount <= 0) {
      Alert.alert(t('common.validation'), t('creditCards.validation.amount'));
      return;
    }
    setSaving(true);
    try {
      await createCardPurchase(selected.id, {
        description: purchaseDesc.trim(),
        amount: purchaseAmount,
        category_id: purchaseCategory || undefined,
        date: purchaseDate || undefined,
      });
      setShowPurchase(false);
      setPurchaseDesc('');
      setPurchaseAmount('');
      setPurchaseCategory('');
      await loadCards();
      if (selectedId) await loadBills(selectedId);
      showSnackbar(t('creditCards.recorded'));
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : t('creditCards.failedRecord'));
    } finally {
      setSaving(false);
    }
  };

  const handlePay = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const billId =
        payBillId || selected.current_bill?.id || bills.find((b) => b.status === 'open')?.id;
      if (!billId) {
        showSnackbar(t('creditCards.noOpenBill'));
        setSaving(false);
        return;
      }
      const res = await payCardBill(selected.id, billId, {
        amount: payAmount ? payAmount : undefined,
      });
      setShowPay(false);
      setPayAmount('');
      await loadCards();
      if (selectedId) await loadBills(selectedId);
      showSnackbar(
        t('creditCards.billPaid', { amount: formatMoney(res.amount_paid), remaining: formatMoney(res.remaining) }),
      );
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : t('creditCards.failedPay'));
    } finally {
      setSaving(false);
    }
  };

  const handleAnticipate = async () => {
    if (!selected) return;
    const ids = Object.entries(checked)
      .filter(([, on]) => on)
      .map(([id]) => id);
    if (ids.length === 0) {
      Alert.alert(t('common.validation'), t('creditCards.validation.installment'));
      return;
    }
    setSaving(true);
    try {
      const payload: { installment_ids: string[]; discount_percent?: string } = {
        installment_ids: ids,
      };
      if (discountPercent.trim()) payload.discount_percent = discountPercent.trim();
      const res = await anticipateInstallments(selected.id, payload);
      setShowAnticipate(false);
      setAnticipatable([]);
      await loadCards();
      if (selectedId) await loadBills(selectedId);
      showSnackbar(
        t('creditCards.anticipated', { count: res.installments_anticipated, amount: formatMoney(res.discount_amount) }),
      );
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : t('creditCards.failedAnticipate'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t('creditCards.title')}</Text>
      </View>

      {cards.length === 0 ? (
        <EmptyState
          compact
          icon="💳"
          title={t('creditCards.noTitle')}
          description={t('creditCards.noDesc')}
        />
      ) : (
        <>
          {cards.map((c) => {
            const active = c.id === selectedId;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.creditCard, active && styles.creditCardActive]}
                onPress={() => setSelectedId(c.id)}
              >
                <View style={styles.creditCardTop}>
                  <Text style={styles.creditCardName}>{c.name}</Text>
                  <Text style={c.current_bill?.status === 'paid' ? styles.creditCardBadgePaid : styles.creditCardBadgeOpen}>
                    {c.current_bill ? c.current_bill.status : t('creditCards.noBill')}
                  </Text>
                </View>
                <Text style={styles.creditCardBalance}>
                  {formatMoney(Math.abs(parseFloat(c.balance)))}
                </Text>
                <Text style={styles.creditCardMeta}>
                  {c.current_bill
                    ? `${t('common.due', { date: c.current_bill.due_date })} · ${t('common.bill', { amount: formatMoney(c.current_bill.remaining_amount) })}`
                    : t('common.noPurchasesYet')}
                  {c.credit_limit ? ` · ${t('common.limit', { amount: formatMoney(c.credit_limit) })}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}

          {selected && (
            <View style={styles.sectionCard}>
              <View style={styles.creditCardActions}>
                <TouchableOpacity style={styles.secondaryButton} onPress={openAnticipate}>
                  <Text style={styles.secondaryButtonText}>{t('creditCards.anticipateShort')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowPay(true)}>
                  <Text style={styles.secondaryButtonText}>{t('creditCards.payBill')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() =>
                    setDetailAccount({
                      id: selected.id,
                      name: selected.name,
                      type: 'liability',
                      account_kind: 'card',
                    })
                  }
                >
                  <Text style={styles.secondaryButtonText}>{t('accounts.detail.viewExpenses')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton} onPress={() => setShowPurchase(true)}>
                  <Text style={styles.primaryButtonText}>{t('creditCards.purchase')}</Text>
                </TouchableOpacity>
              </View>

              {selected.current_bill && (
                <View style={styles.creditCardCurrentBill}>
                  <Text style={styles.creditCardCurrentBillLabel}>{t('creditCards.currentBill')}</Text>
                  <Text style={styles.creditCardCurrentBillValue}>
                    {formatMoney(selected.current_bill.remaining_amount)}
                  </Text>
                  <Text style={styles.creditCardCurrentBillMeta}>
                    {t('common.total')} {formatMoney(selected.current_bill.total_amount)} · {t('common.paid')}{' '}
                    {formatMoney(selected.current_bill.paid_amount)} · {t('common.due', { date: selected.current_bill.due_date })}
                  </Text>
                </View>
              )}

              <Text style={styles.sectionTitle}>{t('creditCards.billingCycles')}</Text>
              {bills.length === 0 ? (
                <Text style={styles.emptyText}>{t('creditCards.noCycles')}</Text>
              ) : (
                bills.map((b) => (
                  <View key={b.id} style={styles.creditCardBillRow}>
                    <Text style={styles.creditCardBillRowText}>
                      {t('creditCards.periodRange', { start: b.period_start, end: b.period_end })}
                    </Text>
                    <Text style={styles.creditCardBillRowText}>{t('common.due', { date: b.due_date })}</Text>
                    <Text style={styles.creditCardBillRowText}>{formatMoney(b.total_amount)}</Text>
                    <Text
                      style={b.status === 'paid' ? styles.creditCardBillPaid : styles.creditCardBillOpen}
                    >
                      {b.status === 'paid' ? t('common.paid') : formatMoney(b.remaining_amount)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </>
      )}

      <Modal visible={showPurchase} transparent animationType="fade" onRequestClose={() => setShowPurchase(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('creditCards.purchaseModalTitle')}</Text>
            <Text style={styles.label}>{t('common.description')}</Text>
            <TextInput
              style={styles.input}
              value={purchaseDesc}
              onChangeText={setPurchaseDesc}
              placeholder={t('creditCards.descPlaceholder')}
              placeholderTextColor={colors.textDim}
              autoFocus
            />
            <Text style={styles.label}>{t('transactions.form.amount')}</Text>
            <TextInput
              style={styles.input}
              value={purchaseAmount}
              onChangeText={setPurchaseAmount}
              placeholder="150.00"
              placeholderTextColor={colors.textDim}
              keyboardType="decimal-pad"
            />
            <Text style={styles.label}>{t('common.category')}</Text>
            <View style={styles.pickerWrap}>
              {expenseCategories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.pill, purchaseCategory === c.id && styles.pillActive]}
                  onPress={() => setPurchaseCategory(c.id)}
                >
                  <Text style={[styles.pillText, purchaseCategory === c.id && styles.pillTextActive]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.pill, !purchaseCategory && styles.pillActive]}
                onPress={() => setPurchaseCategory('')}
              >
                <Text style={[styles.pillText, !purchaseCategory && styles.pillTextActive]}>
                  {t('common.miscellaneous')}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>{t('common.date')}</Text>
            <TextInput
              style={styles.input}
              value={purchaseDate}
              onChangeText={setPurchaseDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPurchase(false)} disabled={saving}>
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handlePurchase} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.submitButtonText}>{t('creditCards.record')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPay} transparent animationType="fade" onRequestClose={() => setShowPay(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('creditCards.payModalTitle')}</Text>
            <Text style={styles.label}>{t('creditCards.bill')}</Text>
            <View style={styles.pickerWrap}>
              {bills
                .filter((b) => b.status === 'open')
                .map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.pill, payBillId === b.id && styles.pillActive]}
                    onPress={() => setPayBillId(b.id)}
                  >
                    <Text style={[styles.pillText, payBillId === b.id && styles.pillTextActive]}>
                      {t('common.due', { date: b.due_date })} — {formatMoney(b.remaining_amount)}
                    </Text>
                  </TouchableOpacity>
                ))}
              {selected?.current_bill && (
                <TouchableOpacity
                  style={[styles.pill, !payBillId && styles.pillActive]}
                  onPress={() => setPayBillId('')}
                >
                  <Text style={[styles.pillText, !payBillId && styles.pillTextActive]}>
                    {t('creditCards.currentBill')} — {formatMoney(selected.current_bill.remaining_amount)}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.label}>{t('creditCards.payAmountHint')}</Text>
            <TextInput
              style={styles.input}
              value={payAmount}
              onChangeText={setPayAmount}
              placeholder="250.00"
              placeholderTextColor={colors.textDim}
              keyboardType="decimal-pad"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPay(false)} disabled={saving}>
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handlePay} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.submitButtonText}>{t('creditCards.pay')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      <Modal visible={showAnticipate} transparent animationType="fade" onRequestClose={() => setShowAnticipate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('creditCards.anticipateTitle')}</Text>
            <Text style={styles.label}>
              {t('creditCards.anticipateDesc')}
            </Text>
            {anticipatable.length === 0 ? (
              <Text style={styles.emptyText}>{t('creditCards.noFutureInstallments')}</Text>
            ) : (
              <>
                {anticipatable.map((it) => (
                  <TouchableOpacity
                    key={it.installmentId}
                    style={[styles.pill, checked[it.installmentId] && styles.pillActive]}
                    onPress={() =>
                      setChecked((prev) => ({
                        ...prev,
                        [it.installmentId]: !prev[it.installmentId],
                      }))
                    }
                  >
                    <Text style={[styles.pillText, checked[it.installmentId] && styles.pillTextActive]}>
                      {checked[it.installmentId] ? '☑ ' : '☐ '}{t('creditCards.installmentItem', { number: it.number, total: it.total, description: it.planDescription })} · {formatMoney(it.amount)} · {t('common.due', { date: it.dueDate })}
                    </Text>
                  </TouchableOpacity>
                ))}
                <Text style={styles.label}>{t('creditCards.discountLabel')}</Text>
                <TextInput
                  style={styles.input}
                  value={discountPercent}
                  onChangeText={setDiscountPercent}
                  placeholder="0"
                  placeholderTextColor={colors.textDim}
                  keyboardType="decimal-pad"
                />
              </>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowAnticipate(false)} disabled={saving}>
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={handleAnticipate}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.submitButtonText}>{t('creditCards.anticipateShort')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {detailAccount && (
        <AccountDetailScreen
          account={detailAccount}
          categories={categories}
          onClose={() => setDetailAccount(null)}
        />
      )}
    </ScrollView>
  );
}

