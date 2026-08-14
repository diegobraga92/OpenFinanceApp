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

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const selected = cards.find((c) => c.id === selectedId) ?? null;

  const loadCards = useCallback(async () => {
    try {
      const data = await fetchCreditCards();
      setCards(data);
      setSelectedId((prev) => prev ?? data[0]?.id ?? null);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to load credit cards');
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
      showSnackbar(err instanceof Error ? err.message : 'Failed to load installments');
    }
  };

  const handlePurchase = async () => {
    if (!selected) return;
    const amount = parseFloat(purchaseAmount);
    if (!purchaseDesc.trim()) {
      Alert.alert('Validation', 'Description is required');
      return;
    }
    if (!amount || amount <= 0) {
      Alert.alert('Validation', 'Amount must be greater than zero');
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
      showSnackbar('Purchase recorded on card');
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to record purchase');
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
        showSnackbar('No open bill to pay');
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
        `${formatMoney(res.amount_paid)} applied — ${formatMoney(res.remaining)} remaining`,
      );
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to pay bill');
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
      Alert.alert('Validation', 'Select at least one installment');
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
        `${res.installments_anticipated} installment(s) anticipated — discount ${formatMoney(res.discount_amount)}`,
      );
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to anticipate installments');
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
        <Text style={styles.pageTitle}>Credit Cards</Text>
      </View>

      {cards.length === 0 ? (
        <EmptyState
          compact
          icon="💳"
          title="No credit cards yet"
          description="Create a liability account with a closing day and due day (Accounts tab). Card purchases, bills and installment anticipation will appear here."
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
                    {c.current_bill ? c.current_bill.status : 'no bill'}
                  </Text>
                </View>
                <Text style={styles.creditCardBalance}>
                  {formatMoney(Math.abs(parseFloat(c.balance)))}
                </Text>
                <Text style={styles.creditCardMeta}>
                  {c.current_bill
                    ? `Due ${c.current_bill.due_date} · bill ${formatMoney(c.current_bill.remaining_amount)}`
                    : 'No purchases yet'}
                  {c.credit_limit ? ` · limit ${formatMoney(c.credit_limit)}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}

          {selected && (
            <View style={styles.sectionCard}>
              <View style={styles.creditCardActions}>
                <TouchableOpacity style={styles.secondaryButton} onPress={openAnticipate}>
                  <Text style={styles.secondaryButtonText}>⏩ Antecipar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowPay(true)}>
                  <Text style={styles.secondaryButtonText}>💸 Pay bill</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton} onPress={() => setShowPurchase(true)}>
                  <Text style={styles.primaryButtonText}>+ Purchase</Text>
                </TouchableOpacity>
              </View>

              {selected.current_bill && (
                <View style={styles.creditCardCurrentBill}>
                  <Text style={styles.creditCardCurrentBillLabel}>Current bill</Text>
                  <Text style={styles.creditCardCurrentBillValue}>
                    {formatMoney(selected.current_bill.remaining_amount)}
                  </Text>
                  <Text style={styles.creditCardCurrentBillMeta}>
                    Total {formatMoney(selected.current_bill.total_amount)} · paid{' '}
                    {formatMoney(selected.current_bill.paid_amount)} · due{' '}
                    {selected.current_bill.due_date}
                  </Text>
                </View>
              )}

              <Text style={styles.sectionTitle}>Billing cycles</Text>
              {bills.length === 0 ? (
                <Text style={styles.emptyText}>No billing cycles yet.</Text>
              ) : (
                bills.map((b) => (
                  <View key={b.id} style={styles.creditCardBillRow}>
                    <Text style={styles.creditCardBillRowText}>
                      {b.period_start} → {b.period_end}
                    </Text>
                    <Text style={styles.creditCardBillRowText}>Due {b.due_date}</Text>
                    <Text style={styles.creditCardBillRowText}>{formatMoney(b.total_amount)}</Text>
                    <Text
                      style={b.status === 'paid' ? styles.creditCardBillPaid : styles.creditCardBillOpen}
                    >
                      {b.status === 'paid' ? 'Paid' : formatMoney(b.remaining_amount)}
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
            <Text style={styles.modalTitle}>Record card purchase</Text>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={purchaseDesc}
              onChangeText={setPurchaseDesc}
              placeholder="e.g. Dinner at Churrascaria"
              placeholderTextColor={colors.textDim}
              autoFocus
            />
            <Text style={styles.label}>Amount (R$)</Text>
            <TextInput
              style={styles.input}
              value={purchaseAmount}
              onChangeText={setPurchaseAmount}
              placeholder="150.00"
              placeholderTextColor={colors.textDim}
              keyboardType="decimal-pad"
            />
            <Text style={styles.label}>Category</Text>
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
                  Miscellaneous
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Date</Text>
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
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handlePurchase} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.submitButtonText}>Record</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPay} transparent animationType="fade" onRequestClose={() => setShowPay(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Pay card bill</Text>
            <Text style={styles.label}>Bill</Text>
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
                      Due {b.due_date} — {formatMoney(b.remaining_amount)}
                    </Text>
                  </TouchableOpacity>
                ))}
              {selected?.current_bill && (
                <TouchableOpacity
                  style={[styles.pill, !payBillId && styles.pillActive]}
                  onPress={() => setPayBillId('')}
                >
                  <Text style={[styles.pillText, !payBillId && styles.pillTextActive]}>
                    Current bill — {formatMoney(selected.current_bill.remaining_amount)}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.label}>Amount (R$) — leave empty to pay the full remaining amount</Text>
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
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitButton, saving && styles.submitButtonDisabled]} onPress={handlePay} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.submitButtonText}>Pay</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      <Modal visible={showAnticipate} transparent animationType="fade" onRequestClose={() => setShowAnticipate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Antecipar parcelas</Text>
            <Text style={styles.label}>
              Pay future installments early on the current bill. Many providers offer a
              discount — enter the one you received.
            </Text>
            {anticipatable.length === 0 ? (
              <Text style={styles.emptyText}>No future installments linked to this card.</Text>
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
                      {checked[it.installmentId] ? '☑ ' : '☐ '}Parcela {it.number}/{it.total} —{' '}
                      {it.planDescription} · {formatMoney(it.amount)} · due {it.dueDate}
                    </Text>
                  </TouchableOpacity>
                ))}
                <Text style={styles.label}>Discount % (provider early-payment incentive, e.g. 5)</Text>
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
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={handleAnticipate}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.submitButtonText}>Antecipar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

