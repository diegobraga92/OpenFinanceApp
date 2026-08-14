import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  anticipateInstallments,
  type AnticipateInstallmentsResponse,
  type CardBill,
  type CardOverview,
  type Category,
  createCardPurchase,
  fetchCardBills,
  fetchCreditCards,
  fetchInstallmentPlan,
  fetchInstallmentPlans,
  payCardBill,
} from '../api';
import { useToast } from './Toast';
import { EmptyState } from './EmptyState';

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

interface PurchaseForm {
  description: string;
  amount: string;
  category_id: string;
  date: string;
}

export function CreditCardManager({ categories, formatMoney }: Props) {
  const [cards, setCards] = useState<CardOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bills, setBills] = useState<CardBill[]>([]);
  const { push: pushToast } = useToast();

  const [showPurchase, setShowPurchase] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseForm>({
    description: '',
    amount: '',
    category_id: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  const [showPay, setShowPay] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payFromAccount, setPayFromAccount] = useState('');
  const [payBillId, setPayBillId] = useState('');

  const [showAnticipate, setShowAnticipate] = useState(false);
  const [anticipatable, setAnticipatable] = useState<AnticipatableItem[]>([]);
  const [checkedInstallments, setCheckedInstallments] = useState<string[]>([]);
  const [discountPercent, setDiscountPercent] = useState('');

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const selected = cards.find((c) => c.id === selectedId) ?? null;

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCreditCards();
      setCards(data);
      setSelectedId((prev) => prev ?? data[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credit cards');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const refreshCards = async () => {
    const data = await fetchCreditCards();
    setCards(data);
    if (selectedId) await loadBills(selectedId);
  };

  const openAnticipate = async () => {
    if (!selected) return;
    setError(null);
    setCheckedInstallments([]);
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
      setError(err instanceof Error ? err.message : 'Failed to load installments');
    }
  };

  const handlePurchase = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const amount = parseFloat(purchaseForm.amount);
      if (!purchaseForm.description.trim()) throw new Error('Description is required');
      if (!amount || amount <= 0) throw new Error('Amount must be greater than zero');
      await createCardPurchase(selected.id, {
        description: purchaseForm.description.trim(),
        amount: purchaseForm.amount,
        category_id: purchaseForm.category_id || undefined,
        date: purchaseForm.date || undefined,
      });
      setShowPurchase(false);
      setPurchaseForm({
        description: '',
        amount: '',
        category_id: '',
        date: new Date().toISOString().slice(0, 10),
      });
      await refreshCards();
      pushToast({ message: 'Purchase recorded on card' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record purchase');
    } finally {
      setSaving(false);
    }
  };

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const billId =
        payBillId ||
        selected.current_bill?.id ||
        bills.find((b) => b.status === 'open')?.id;
      if (!billId) throw new Error('No open bill to pay');
      const res = await payCardBill(selected.id, billId, {
        amount: payAmount ? payAmount : undefined,
        from_account_id: payFromAccount || undefined,
      });
      setShowPay(false);
      setPayAmount('');
      await refreshCards();
      pushToast({
        message: `Bill paid — ${formatMoney(res.amount_paid)} applied, ${formatMoney(res.remaining)} remaining`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pay bill');
    } finally {
      setSaving(false);
    }
  };

  const handleAnticipate = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      if (checkedInstallments.length === 0) throw new Error('Select at least one installment');
      const payload: { installment_ids: string[]; discount_percent?: string } = {
        installment_ids: checkedInstallments,
      };
      if (discountPercent.trim()) payload.discount_percent = discountPercent.trim();
      const res: AnticipateInstallmentsResponse = await anticipateInstallments(
        selected.id,
        payload,
      );
      setShowAnticipate(false);
      setAnticipatable([]);
      await refreshCards();
      pushToast({
        message: `${res.installments_anticipated} installment(s) anticipated — discount ${formatMoney(res.discount_amount)}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to anticipate installments');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={styles.emptyText}>Loading credit cards…</div>;
  }

  return (
    <div>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>Credit Cards</h2>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon="💳"
          title="No credit cards yet"
          description="Create a liability account with a closing day and due day (Accounts tab). Card purchases, bills and installment anticipation will appear here."
          actionLabel="Go to Accounts"
          onAction={() => window.dispatchEvent(new CustomEvent('pudim:go-accounts'))}
        />
      ) : (
        <>
          {error && (
            <div style={styles.error}>
              <p>{error}</p>
            </div>
          )}
          <div style={styles.cardGrid}>
            {cards.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                style={c.id === selectedId ? styles.cardActive : styles.card}
              >
                <div style={styles.cardTop}>
                  <span style={styles.cardName}>{c.name}</span>
                  {c.current_bill?.status === 'paid' ? (
                    <span style={styles.badgePaid}>paid</span>
                  ) : (
                    <span style={styles.badgeOpen}>open</span>
                  )}
                </div>
                <div style={styles.cardBalance}>
                  {formatMoney(Math.abs(parseFloat(c.balance)))}
                </div>
                <div style={styles.cardMeta}>
                  {c.current_bill ? (
                    <>
                      <span>Due {c.current_bill.due_date}</span>
                      <span>Bill {formatMoney(c.current_bill.remaining_amount)}</span>
                    </>
                  ) : (
                    <span>No purchases yet</span>
                  )}
                  {c.credit_limit ? <span>Limit {formatMoney(c.credit_limit)}</span> : null}
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div style={styles.detail}>
              <div style={styles.detailHeader}>
                <h3 style={styles.detailTitle}>{selected.name}</h3>
                <div style={styles.pageActions}>
                  <button type="button" style={styles.secondaryButton} onClick={openAnticipate}>
                    ⏩ Antecipar parcelas
                  </button>
                  <button type="button" style={styles.secondaryButton} onClick={() => setShowPay(true)}>
                    💸 Pay bill
                  </button>
                  <button type="button" style={styles.primaryButton} onClick={() => setShowPurchase(true)}>
                    + Purchase
                  </button>
                </div>
              </div>

              {selected.current_bill && (
                <div style={styles.currentBill}>
                  <div>
                    <span style={styles.dim}>Current bill</span>
                    <strong style={styles.currentBillAmount}>
                      {formatMoney(selected.current_bill.remaining_amount)}
                    </strong>
                  </div>
                  <div>
                    <span style={styles.dim}>Due date</span>
                    <strong>{selected.current_bill.due_date}</strong>
                  </div>
                  <div>
                    <span style={styles.dim}>Total</span>
                    <strong>{formatMoney(selected.current_bill.total_amount)}</strong>
                  </div>
                  <div>
                    <span style={styles.dim}>Paid</span>
                    <strong>{formatMoney(selected.current_bill.paid_amount)}</strong>
                  </div>
                </div>
              )}

              <h4 style={styles.sectionTitle}>Billing cycles</h4>
              {bills.length === 0 ? (
                <p style={styles.emptyText}>No billing cycles yet.</p>
              ) : (
                <div style={styles.table}>
                  {bills.map((b) => (
                    <div key={b.id} style={styles.row}>
                      <span>
                        {b.period_start} → {b.period_end}
                      </span>
                      <span>Due {b.due_date}</span>
                      <span>{formatMoney(b.total_amount)}</span>
                      <span style={b.status === 'paid' ? styles.paidText : styles.dangerText}>
                        {b.status === 'paid' ? 'Paid' : formatMoney(b.remaining_amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Purchase modal */}
      {showPurchase && selected && (
        <Modal title="Record card purchase" onClose={() => setShowPurchase(false)}>
          {error && (
            <div style={styles.error}>
              <p>{error}</p>
            </div>
          )}
          <form onSubmit={handlePurchase} style={styles.form}>
            <label style={styles.label}>
              Description
              <input
                style={styles.input}
                value={purchaseForm.description}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Dinner at Churrascaria"
                required
                autoFocus
              />
            </label>
            <label style={styles.label}>
              Amount (R$)
              <input
                style={styles.input}
                value={purchaseForm.amount}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="150.00"
                required
              />
            </label>
            <label style={styles.label}>
              Category
              <select
                style={styles.input}
                value={purchaseForm.category_id}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, category_id: e.target.value }))}
              >
                <option value="">Miscellaneous</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Date
              <input
                type="date"
                style={styles.input}
                value={purchaseForm.date}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, date: e.target.value }))}
              />
            </label>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.cancelButton}
                onClick={() => setShowPurchase(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" style={styles.submitButton} disabled={saving}>
                {saving ? 'Saving…' : 'Record purchase'}
              </button>
            </div>
          </form>
        </Modal>
      )}


      {/* Pay modal */}
      {showPay && selected && (
        <Modal title="Pay card bill" onClose={() => setShowPay(false)}>
          {error && (
            <div style={styles.error}>
              <p>{error}</p>
            </div>
          )}
          <form onSubmit={handlePay} style={styles.form}>
            <label style={styles.label}>
              Bill
              <select
                style={styles.input}
                value={payBillId}
                onChange={(e) => setPayBillId(e.target.value)}
              >
                <option value="">Current open bill (default)</option>
                {bills
                  .filter((b) => b.status === 'open')
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      Due {b.due_date} — {formatMoney(b.remaining_amount)} remaining
                    </option>
                  ))}
              </select>
            </label>
            <label style={styles.label}>
              Amount (R$) — leave empty to pay the full remaining amount
              <input
                style={styles.input}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="250.00"
              />
            </label>
            <label style={styles.label}>
              From account (optional, defaults to Cash)
              <input
                style={styles.input}
                value={payFromAccount}
                onChange={(e) => setPayFromAccount(e.target.value)}
                placeholder="Account UUID"
              />
            </label>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.cancelButton}
                onClick={() => setShowPay(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" style={styles.submitButton} disabled={saving}>
                {saving ? 'Paying…' : 'Pay bill'}
              </button>
            </div>
          </form>
        </Modal>
      )}


      {/* Anticipate modal */}
      {showAnticipate && selected && (
        <Modal title="Antecipar parcelas" onClose={() => setShowAnticipate(false)}>
          {error && (
            <div style={styles.error}>
              <p>{error}</p>
            </div>
          )}
          <p style={styles.hint}>
            Pay future installments early on the current bill. Many providers offer a
            discount for this — enter the one you received.
          </p>
          {anticipatable.length === 0 ? (
            <p style={styles.emptyText}>No future installments linked to this card.</p>
          ) : (
            <form onSubmit={handleAnticipate} style={styles.form}>
              <div style={styles.checkList}>
                {anticipatable.map((it) => (
                  <label key={it.installmentId} style={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={checkedInstallments.includes(it.installmentId)}
                      onChange={(e) =>
                        setCheckedInstallments((prev) =>
                          e.target.checked
                            ? [...prev, it.installmentId]
                            : prev.filter((x) => x !== it.installmentId),
                        )
                      }
                    />
                    <span>
                      Parcela {it.number}/{it.total} — {it.planDescription}
                    </span>
                    <span style={styles.checkRowRight}>
                      {formatMoney(it.amount)} · due {it.dueDate}
                    </span>
                  </label>
                ))}
              </div>
              <label style={styles.label}>
                Discount % (provider early-payment incentive, e.g. 5)
                <input
                  style={styles.input}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  placeholder="0"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </label>
              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.cancelButton}
                  onClick={() => setShowAnticipate(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.submitButton} disabled={saving}>
                  {saving ? 'Anticipating…' : 'Anticipate installments'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      style={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-modal-title"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h3 id="card-modal-title" style={styles.modalTitle}>
            {title}
          </h3>
          <button type="button" style={styles.modalClose} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}


const styles: Record<string, CSSProperties> = {
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
  },
  pageActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  pageTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
  },
  error: {
    backgroundColor: 'var(--color-danger-bg)',
    color: 'var(--color-danger-text)',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  card: {
    textAlign: 'left',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.75rem',
    padding: '0.875rem 1rem',
    cursor: 'pointer',
    color: 'var(--color-text)',
  },
  cardActive: {
    textAlign: 'left',
    backgroundColor: 'var(--color-surface)',
    border: '2px solid var(--color-primary)',
    borderRadius: '0.75rem',
    padding: '0.875rem 1rem',
    cursor: 'pointer',
    color: 'var(--color-text)',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.375rem',
  },
  cardName: {
    fontWeight: 600,
    fontSize: '0.875rem',
  },
  badgeOpen: {
    fontSize: '0.625rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--color-primary-text)',
    backgroundColor: 'var(--color-primary)',
    borderRadius: '9999px',
    padding: '0.125rem 0.5rem',
  },
  badgePaid: {
    fontSize: '0.625rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: 'var(--color-text-muted)',
    backgroundColor: 'var(--color-surface-hover)',
    borderRadius: '9999px',
    padding: '0.125rem 0.5rem',
  },
  cardBalance: {
    fontSize: '1.25rem',
    fontWeight: 700,
    margin: '0.375rem 0',
  },
  cardMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    fontSize: '0.75rem',
    color: 'var(--color-text-dim)',
  },
  detail: {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.75rem',
    padding: '1rem 1.25rem',
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginBottom: '1rem',
  },
  detailTitle: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 700,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    color: 'var(--color-text-muted)',
    border: '1px solid var(--color-border)',
    padding: '0.5rem 0.875rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  primaryButton: {
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  currentBill: {
    display: 'flex',
    gap: '1.5rem',
    flexWrap: 'wrap',
    backgroundColor: 'var(--color-surface-hover)',
    borderRadius: '0.625rem',
    padding: '0.875rem 1rem',
    marginBottom: '1rem',
  },
  currentBillAmount: {
    fontSize: '1.25rem',
    fontWeight: 700,
  },
  dim: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--color-text-dim)',
  },
  sectionTitle: {
    margin: '0 0 0.5rem',
    fontSize: '0.875rem',
    fontWeight: 600,
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.5rem',
    fontSize: '0.8125rem',
    padding: '0.375rem 0',
    borderBottom: '1px solid var(--color-border)',
  },
  paidText: {
    color: 'var(--color-success-text)',
    fontWeight: 600,
  },
  dangerText: {
    color: 'var(--color-danger-text)',
    fontWeight: 600,
  },

  hint: {
    fontSize: '0.8125rem',
    color: 'var(--color-text-dim)',
    margin: '0 0 0.75rem',
  },
  emptyText: {
    color: 'var(--color-text-dim)',
    textAlign: 'center',
    padding: '1.5rem 0',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
  },
  input: {
    backgroundColor: 'var(--color-input-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  checkList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    maxHeight: 220,
    overflowY: 'auto',
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8125rem',
    padding: '0.375rem',
    borderRadius: '0.375rem',
    backgroundColor: 'var(--color-surface-hover)',
  },
  checkRowRight: {
    marginLeft: 'auto',
    color: 'var(--color-text-dim)',
    fontSize: '0.75rem',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    marginTop: '0.25rem',
  },
  submitButton: {
    alignSelf: 'flex-end',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    border: 'none',
    padding: '0.5rem 1.25rem',
    borderRadius: '0.5rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  cancelButton: {
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    border: '1px solid var(--color-border)',
    background: 'transparent',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'var(--color-overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: '1rem',
  },
  modal: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '1.5rem',
    maxWidth: 560,
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-card)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  modalTitle: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 700,
  },
  modalClose: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-dim)',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '0.25rem',
  },
};

