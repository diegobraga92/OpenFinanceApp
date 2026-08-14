import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import type { AccountWithBalance, Category } from '../api';
import { createAccount, deleteAccount, updateAccount } from '../api';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { CreditCardManager } from './CreditCardManager';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../../../shared/i18n';

interface Props {
  accounts: AccountWithBalance[];
  categories: Category[];
  onAccountsChanged: () => Promise<AccountWithBalance[]>;
}

type AccountKind = 'bank' | 'cash' | 'card' | 'loan' | 'investment' | 'income' | 'expense' | 'equity' | 'other';

const KIND_GROUPS: {
  kinds: AccountKind[];
  labelKey: TranslationKey;
  blurbKey: TranslationKey;
  icon: string;
}[] = [
  { kinds: ['bank', 'cash', 'investment'], labelKey: 'accounts.kindGroup.assets', blurbKey: 'accounts.kindGroup.assetsBlurb', icon: '💰' },
  { kinds: ['card', 'loan'], labelKey: 'accounts.kindGroup.liabilities', blurbKey: 'accounts.kindGroup.liabilitiesBlurb', icon: '💳' },
  { kinds: ['income', 'expense', 'equity', 'other'], labelKey: 'accounts.kindGroup.system', blurbKey: 'accounts.kindGroup.systemBlurb', icon: '📊' },
];

const KIND_OPTIONS: { key: AccountKind; labelKey: TranslationKey; icon: string }[] = [
  { key: 'bank', labelKey: 'accounts.kind.bank', icon: '🏦' },
  { key: 'cash', labelKey: 'accounts.kind.cash', icon: '💵' },
  { key: 'card', labelKey: 'accounts.kind.card', icon: '💳' },
  { key: 'loan', labelKey: 'accounts.kind.loan', icon: '🏛️' },
  { key: 'investment', labelKey: 'accounts.kind.investment', icon: '📈' },
];

const ACCOUNT_TYPE_FOR_KIND: Record<AccountKind, string> = {
  bank: 'asset',
  cash: 'asset',
  investment: 'asset',
  card: 'liability',
  loan: 'liability',
  income: 'income',
  expense: 'expense',
  equity: 'equity',
  other: 'other',
};

interface FormState {
  name: string;
  kind: AccountKind;
  closing_day: string;
  due_day: string;
  credit_limit: string;
}

const EMPTY_FORM: FormState = { name: '', kind: 'bank', closing_day: '', due_day: '', credit_limit: '' };

export function AccountManager({ accounts, categories, onAccountsChanged }: Props) {
  const { t, formatMoney } = useI18n();
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<AccountWithBalance | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push: pushToast } = useToast();

  // Close the modal on Escape for keyboard users.
  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowForm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm]);

  const openCreate = (kind: AccountKind) => {
    setEditingId(null);
    setForm({ name: '', kind, closing_day: '', due_day: '', credit_limit: '' });
    setError(null);
    setShowForm(true);
  };

  const openEdit = (a: AccountWithBalance) => {
    setEditingId(a.id);
    setForm({
      name: a.name,
      kind: (a.account_kind as AccountKind) ?? 'other',
      closing_day: a.closing_day != null ? String(a.closing_day) : '',
      due_day: a.due_day != null ? String(a.due_day) : '',
      credit_limit: a.credit_limit != null ? String(a.credit_limit) : '',
    });
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError(t('accounts.validation.name'));
      return;
    }
    setSaving(true);
    setError(null);
    const isCard = form.kind === 'card';
    const closingDay = form.closing_day.trim() ? Number(form.closing_day.trim()) : null;
    const dueDay = form.due_day.trim() ? Number(form.due_day.trim()) : null;
    const creditLimit = form.credit_limit.trim() ? form.credit_limit.trim() : null;
    if (isCard && (closingDay === null || dueDay === null)) {
      setError(t('accounts.validation.cardDays'));
      setSaving(false);
      return;
    }
    if (closingDay !== null && (closingDay < 1 || closingDay > 31)) {
      setError(t('accounts.validation.closingDay'));
      setSaving(false);
      return;
    }
    if (dueDay !== null && (dueDay < 1 || dueDay > 31)) {
      setError(t('accounts.validation.dueDay'));
      setSaving(false);
      return;
    }
    const payload = {
      name,
      type: ACCOUNT_TYPE_FOR_KIND[form.kind],
      account_kind: form.kind,
      closing_day: isCard ? closingDay : undefined,
      due_day: isCard ? dueDay : undefined,
      credit_limit: isCard && creditLimit ? creditLimit : undefined,
    };
    try {
      if (editingId) {
        await updateAccount(editingId, payload);
        pushToast({ message: t('accounts.updated', { name }) });
      } else {
        await createAccount(payload);
        pushToast({ message: t('accounts.created', { name }) });
      }
      setShowForm(false);
      await onAccountsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('accounts.failedSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteAccount(deleting.id);
      pushToast({ message: t('accounts.deleted', { name: deleting.name }) });
      setDeleting(null);
      await onAccountsChanged();
    } catch (err) {
      setDeleting(null);
      pushToast({
        message: err instanceof Error ? err.message : t('accounts.failedDelete'),
      });
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) => a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q),
    );
  }, [query, accounts]);

  const formatBalance = (a: AccountWithBalance) => {
    const n = Math.abs(parseFloat(a.balance));
    return formatMoney(n);
  };

  const renderAccountCard = (a: AccountWithBalance) => {
    const isDebt = a.type === 'liability';
    const isIncomeOrExpense = a.type === 'income' || a.type === 'expense';
    return (
      <div key={a.id} style={styles.card}>
        <div
          style={{
            ...styles.accountIcon,
            backgroundColor: isDebt
              ? 'rgba(239, 68, 68, 0.15)'
              : isIncomeOrExpense
                ? 'rgba(34, 197, 94, 0.12)'
                : 'rgba(59, 130, 246, 0.12)',
          }}
          aria-hidden="true"
        >
          {isDebt ? '💳' : isIncomeOrExpense ? '📊' : '🏦'}
        </div>
        <div style={styles.cardInfo}>
          <p style={styles.cardName}>{a.name}</p>
          <p style={styles.cardMeta}>
            {t(
              a.transaction_count === 1
                ? 'accounts.form.countEntries_one'
                : 'accounts.form.countEntries_other',
              { count: a.transaction_count },
            )}
          </p>
        </div>
        <div style={styles.balanceWrap}>
          <span style={isDebt ? styles.balanceDebt : styles.balanceNormal}>
            {formatBalance(a)}
          </span>
        </div>
        <div style={styles.cardActions}>
          <button
            type="button"
            style={styles.iconAction}
            onClick={() => openEdit(a)}
            aria-label={t('common.edit') + ' ' + a.name}
            title={t('common.edit')}
          >
            ✏️
          </button>
          <button
            type="button"
            style={styles.iconActionDanger}
            onClick={() => setDeleting(a)}
            aria-label={t('common.delete') + ' ' + a.name}
            title={t('common.delete')}
          >
            🗑️
          </button>
        </div>
      </div>
    );
  };

  const renderGroup = (group: (typeof KIND_GROUPS)[number]) => {
    // Credit cards (kind 'card') are managed in the embedded Credit Card
    // section below; only non-card liabilities (loans) appear in this list.
    const items = visible.filter(
      (a) => group.kinds.includes(a.account_kind as AccountKind) && a.account_kind !== 'card',
    );
    const canAdd = KIND_OPTIONS.some((k) => k.key === group.kinds[0]);
    return (
      <div key={group.kinds.join('-')} style={styles.group}>
        <div style={styles.groupHeader}>
          <span style={styles.groupIcon} aria-hidden="true">
            {group.icon}
          </span>
          <div style={styles.groupHeaderText}>
            <h4 style={styles.groupTitle}>{t(group.labelKey)}</h4>
            <p style={styles.groupBlurb}>{t(group.blurbKey)}</p>
          </div>
          <span style={styles.groupBadge}>{items.length}</span>
          {canAdd && (
            <button
              type="button"
              style={styles.groupAdd}
              onClick={() => openCreate(group.kinds[0])}
              aria-label={t('accounts.form.addAccount')}
              title={t('accounts.form.addAccount')}
            >
              +
            </button>
          )}
        </div>
        {items.length > 0 ? (
          <div style={styles.list}>{items.map(renderAccountCard)}</div>
        ) : (
          <p style={styles.groupEmpty}>{t('accounts.form.noGroup', { label: t(group.labelKey).toLowerCase() })}</p>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>{t('accounts.title')}</h2>
        <button type="button" style={styles.primaryButton} onClick={() => openCreate('bank')}>
          {t('accounts.new')}
        </button>
      </div>

      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <input
            style={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('accounts.search')}
            aria-label={t('accounts.searchAria')}
          />
          {query && (
            <button
              type="button"
              style={styles.searchClear}
              onClick={() => setQuery('')}
              aria-label={t('common.clearSearch')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon="🏦"
          title={t('accounts.noTitle')}
          description={t('accounts.noDesc')}
          actionLabel={t('accounts.new')}
          onAction={() => openCreate('bank')}
        />
      ) : (
        <div style={styles.summaryBar}>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>{t('accounts.totalAssets')}</span>
            <span style={styles.summaryValue}>
              {formatMoney(
                accounts
                  .filter((a) => a.type === 'asset')
                  .reduce((sum, a) => sum + parseFloat(a.balance), 0),
              )}
            </span>
          </div>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>{t('accounts.totalDebt')}</span>
            <span style={{ ...styles.summaryValue, ...styles.summaryDebt }}>
              {formatMoney(
                accounts
                  .filter((a) => a.type === 'liability')
                  .reduce((sum, a) => sum + Math.abs(parseFloat(a.balance)), 0),
              )}
            </span>
          </div>
        </div>
      )}

      {accounts.length > 0 && (
        <div style={styles.groups}>{KIND_GROUPS.map(renderGroup)}</div>
      )}

      <CreditCardManager categories={categories} formatMoney={formatMoney} />

      {showForm && (
        <div
          style={styles.overlay}
          role="presentation"
          onMouseDown={() => setShowForm(false)}
        >
          <div
            style={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-form-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 id="account-form-title" style={styles.modalTitle}>
                {editingId ? t('accounts.form.edit') : t('accounts.form.new')}
              </h3>
              <button
                type="button"
                style={styles.modalClose}
                onClick={() => setShowForm(false)}
                aria-label={t('common.close')}
              >
                ✕
              </button>
            </div>

            {error && (
              <div style={styles.error}>
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.label}>
                {t('accounts.form.name')}
                <input
                  style={styles.input}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t('accounts.form.namePlaceholder')}
                  required
                  autoFocus
                />
              </label>

              <label style={styles.label}>
                {t('accounts.form.type')}
                <div style={styles.typeGrid}>
                  {KIND_OPTIONS.map((kind) => (
                    <button
                      key={kind.key}
                      type="button"
                      style={
                        form.kind === kind.key ? styles.typeButtonActive : styles.typeButton
                      }
                      onClick={() => setForm((f) => ({ ...f, kind: kind.key }))}
                    >
                      {kind.icon} {t(kind.labelKey)}
                    </button>
                  ))}
                </div>
              </label>

              {form.kind === 'card' && (
                <div style={styles.cardFields}>
                  <p style={styles.cardFieldsHint}>
                    {t('accounts.form.cardHint')}
                  </p>
                  <div style={styles.cardFieldsRow}>
                    <label style={styles.label}>
                      {t('accounts.form.closingDay')}
                      <input
                        style={styles.input}
                        value={form.closing_day}
                        onChange={(e) => setForm((f) => ({ ...f, closing_day: e.target.value }))}
                        placeholder="5"
                        inputMode="numeric"
                        maxLength={2}
                      />
                    </label>
                    <label style={styles.label}>
                      {t('accounts.form.dueDay')}
                      <input
                        style={styles.input}
                        value={form.due_day}
                        onChange={(e) => setForm((f) => ({ ...f, due_day: e.target.value }))}
                        placeholder="15"
                        inputMode="numeric"
                        maxLength={2}
                      />
                    </label>
                  </div>
                  <label style={styles.label}>
                    {t('accounts.form.creditLimit')}
                    <input
                      style={styles.input}
                      value={form.credit_limit}
                      onChange={(e) => setForm((f) => ({ ...f, credit_limit: e.target.value }))}
                      placeholder="5000.00"
                    />
                  </label>
                </div>
              )}

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.cancelButton}
                  onClick={() => setShowForm(false)}
                  disabled={saving}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" style={styles.submitButton} disabled={saving}>
                  {saving
                    ? t('common.saving')
                    : editingId
                      ? t('accounts.form.saveChanges')
                      : t('accounts.form.createAccount')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? t('accounts.deleteTitle', { name: deleting.name }) : ''}
        message={t('accounts.deleteMessage')}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
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
  pageTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
  },
  toolbar: {
    marginBottom: '1.5rem',
  },
  summaryBar: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  summaryItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    backgroundColor: 'var(--color-surface)',
    borderRadius: '0.75rem',
    padding: '0.875rem 1.125rem',
    border: '1px solid var(--color-border)',
  },
  summaryLabel: {
    fontSize: '0.75rem',
    color: 'var(--color-text-dim)',
  },
  summaryValue: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--color-text)',
  },
  summaryDebt: {
    color: 'var(--color-danger-text)',
  },
  searchWrap: {
    position: 'relative',
  },
  searchInput: {
    backgroundColor: 'var(--color-input-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    padding: '0.625rem 2rem 0.625rem 0.875rem',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  searchClear: {
    position: 'absolute',
    right: '0.375rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'transparent',
    border: 'none',
    color: 'var(--color-text-dim)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    padding: '0.25rem',
  },
  groups: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  group: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '1.25rem',
    border: '1px solid var(--color-border)',
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.75rem',
  },
  groupIcon: {
    fontSize: '1.25rem',
  },
  groupHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  groupTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
  },
  groupBlurb: {
    margin: '0.125rem 0 0 0',
    fontSize: '0.75rem',
    color: 'var(--color-text-dim)',
  },
  groupBadge: {
    backgroundColor: 'var(--color-surface-hover)',
    color: 'var(--color-text-muted)',
    borderRadius: '9999px',
    padding: '0.125rem 0.5rem',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  groupAdd: {
    width: '1.75rem',
    height: '1.75rem',
    borderRadius: '0.5rem',
    border: '1px solid var(--color-border)',
    background: 'transparent',
    color: 'var(--color-text-muted)',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupEmpty: {
    color: 'var(--color-text-dim)',
    fontSize: '0.875rem',
    margin: 0,
    padding: '0.25rem 0',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.625rem 0.75rem',
    borderRadius: '0.625rem',
    backgroundColor: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
  },
  accountIcon: {
    width: '2.25rem',
    height: '2.25rem',
    borderRadius: '0.625rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '1.125rem',
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    margin: 0,
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardMeta: {
    margin: 0,
    fontSize: '0.75rem',
    color: 'var(--color-text-dim)',
  },
  balanceWrap: {
    flexShrink: 0,
    textAlign: 'right',
  },
  balanceNormal: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--color-text)',
  },
  balanceDebt: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--color-danger-text)',
  },
  cardActions: {
    display: 'flex',
    gap: '0.25rem',
    flexShrink: 0,
  },
  iconAction: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    padding: '0.375rem',
    borderRadius: '0.375rem',
    opacity: 0.7,
  },
  iconActionDanger: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    padding: '0.375rem',
    borderRadius: '0.375rem',
    opacity: 0.7,
  },


  error: {
    backgroundColor: 'var(--color-danger-bg)',
    border: '1px solid var(--color-danger-border)',
    color: 'var(--color-danger-text)',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
    flex: 1,
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
  typeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '0.375rem',
  },
  typeButton: {
    padding: '0.5rem',
    borderRadius: '0.375rem',
    border: '1px solid var(--color-border)',
    background: 'transparent',
    color: 'var(--color-text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  },
  typeButtonActive: {
    padding: '0.5rem',
    borderRadius: '0.375rem',
    border: '1px solid var(--color-primary)',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  },
  cardFields: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    backgroundColor: 'var(--color-surface-hover)',
    borderRadius: '0.625rem',
    padding: '0.75rem',
  },
  cardFieldsHint: {
    margin: 0,
    fontSize: '0.75rem',
    color: 'var(--color-text-dim)',
  },
  cardFieldsRow: {
    display: 'flex',
    gap: '0.75rem',
  },
  submitButton: {
    alignSelf: 'flex-end',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    border: 'none',
    padding: '0.5rem 1.5rem',
    borderRadius: '0.5rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  cancelButton: {
    padding: '0.5rem 1.25rem',
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
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  primaryButton: {
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    border: 'none',
    padding: '0.625rem 1.25rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

