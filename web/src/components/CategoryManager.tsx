import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import type { Category, CreateCategoryRequest } from '../api';
import { createCategory, deleteCategory, updateCategory } from '../api';
import { useToast } from './Toast';
import { useI18n } from '../i18n';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';

interface Props {
  categories: Category[];
  onCategoriesChanged: () => Promise<Category[]>;
}

const ICONS = [
  'briefcase', 'laptop', 'trending-up', 'gift', 'plus-circle',
  'shopping-cart', 'home', 'car', 'zap', 'film', 'heart', 'book',
  'shopping-bag', 'plane', 'repeat', 'shield', 'more-horizontal',
];

const COLORS = [
  '#22c55e', '#16a34a', '#15803d', '#a3e635', '#86efac',
  '#ef4444', '#dc2626', '#b91c1c', '#f97316', '#eab308',
  '#ec4899', '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4',
  '#14b8a6', '#84cc16', '#6b7280',
];

interface FormState {
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
}

const DEFAULT_EXPENSE_ICON = 'shopping-cart';
const DEFAULT_INCOME_ICON = 'briefcase';
const DEFAULT_COLOR = '#6366f1';

const EMPTY_FORM: FormState = {
  name: '',
  type: 'expense',
  icon: DEFAULT_EXPENSE_ICON,
  color: DEFAULT_COLOR,
};


export function CategoryManager({ categories, onCategoriesChanged }: Props) {
  const [tab, setTab] = useState<'expense' | 'income'>('expense');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push: pushToast } = useToast();
  const { t } = useI18n();

  // Close the modal on Escape for keyboard users.
  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowForm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm]);

  const openCreate = (type: 'income' | 'expense') => {
    setEditingId(null);
    setForm({
      name: '',
      type,
      icon: type === 'expense' ? DEFAULT_EXPENSE_ICON : DEFAULT_INCOME_ICON,
      color: DEFAULT_COLOR,
    });
    setError(null);
    setShowForm(true);
  };

  const openEdit = (c: Category) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      type: c.type as 'income' | 'expense',
      icon: c.icon || (c.type === 'expense' ? DEFAULT_EXPENSE_ICON : DEFAULT_INCOME_ICON),
      color: c.color || DEFAULT_COLOR,
    });
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError(t('common.nameRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    const payload: CreateCategoryRequest = {
      name,
      type: form.type,
      icon: form.icon,
      color: form.color,
    };
    try {
      if (editingId) {
        await updateCategory(editingId, payload);
        pushToast({ message: t('categories.updated', { name }) });
      } else {
        await createCategory(payload);
        pushToast({ message: t('categories.created', { name }) });
      }
      setShowForm(false);
      await onCategoriesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('categories.failedSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteCategory(deleting.id);
      pushToast({ message: t('categories.deleted', { name: deleting.name }) });
      setDeleting(null);
      await onCategoriesChanged();
    } catch (err) {
      setDeleting(null);
      pushToast({
        message: err instanceof Error ? err.message : t('categories.failedDelete'),
      });
    }
  };

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories],
  );
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === 'income'),
    [categories],
  );

  const visible = useMemo(() => {
    const source = tab === 'expense' ? expenseCategories : incomeCategories;
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.icon || '').toLowerCase().includes(q),
    );
  }, [tab, query, expenseCategories, incomeCategories]);


  const renderCategoryCard = (c: Category) => {
    const childCount = categories.filter((x) => x.parent_id === c.id).length;
    return (
      <div key={c.id} style={styles.card}>
        <div
          style={{
            ...styles.swatch,
            backgroundColor: c.color || 'var(--color-border)',
          }}
          aria-hidden="true"
        >
          <span style={styles.swatchIcon}>{c.icon || '•'}</span>
        </div>
        <div style={styles.cardInfo}>
          <p style={styles.cardName}>{c.name}</p>
          {c.parent_id ? (
            <p style={styles.cardParent}>{t('common.subcategory')}</p>
          ) : (
            <p style={styles.cardCount}>
              {childCount > 0
                ? t(childCount === 1 ? 'common.subcategory' : 'common.subcategories', { count: childCount })
                : t('common.topLevel')}
            </p>
          )}
        </div>
        <div style={styles.cardActions}>
          <button
            type="button"
            style={styles.iconAction}
            onClick={() => openEdit(c)}
            aria-label={t('common.edit') + ' ' + c.name}
            title={t('common.edit')}
          >
            ✏️
          </button>
          <button
            type="button"
            style={styles.iconActionDanger}
            onClick={() => setDeleting(c)}
            aria-label={t('common.delete') + ' ' + c.name}
            title={t('common.delete')}
          >
            🗑️
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>{t('categories.title')}</h2>
        <div style={styles.pageActions}>
          <button type="button" style={styles.secondaryButton} onClick={() => openCreate('income')}>
            {t('categories.newIncome')}
          </button>
          <button type="button" style={styles.primaryButton} onClick={() => openCreate('expense')}>
            {t('categories.newExpense')}
          </button>
        </div>
      </div>

      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <input
            style={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('categories.search')}
            aria-label={t('categories.searchAria')}
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

      <div style={styles.tabs} role="tablist" aria-label={t('categories.typeAria')}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'expense'}
          style={tab === 'expense' ? styles.tabActive : styles.tab}
          onClick={() => setTab('expense')}
        >
          {t('categories.tabExpenses')}
          <span style={styles.tabBadge}>{expenseCategories.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'income'}
          style={tab === 'income' ? styles.tabActive : styles.tab}
          onClick={() => setTab('income')}
        >
          {t('categories.tabIncome')}
          <span style={styles.tabBadge}>{incomeCategories.length}</span>
        </button>
      </div>

      <div style={styles.group}>
        {visible.length > 0 ? (
          <div style={styles.list}>{visible.map(renderCategoryCard)}</div>
        ) : (
          <EmptyState
            icon={tab === 'expense' ? '🛒' : '💰'}
            title={query ? t('categories.noMatchingTitle') : (tab === 'expense' ? t('categories.noExpenseTitle') : t('categories.noIncomeTitle'))}
            description={
              query
                ? t('categories.noMatchingDesc', { query })
                : tab === 'expense'
                  ? t('categories.noExpenseDesc')
                  : t('categories.noIncomeDesc')
            }
            actionLabel={t('categories.new')}
            onAction={() => openCreate(tab)}
          />
        )}
      </div>

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
            aria-labelledby="category-form-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 id="category-form-title" style={styles.modalTitle}>
                {editingId ? t('categories.form.edit') : t('categories.form.new')}
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
                {t('categories.form.name')}
                <input
                  style={styles.input}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t('categories.form.namePlaceholder')}
                  required
                  autoFocus
                />
              </label>

              <label style={styles.label}>
                {t('categories.form.type')}
                <div style={styles.typeToggle}>
                  {(['expense', 'income'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      style={form.type === type ? styles.typeActive : styles.typeButton}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          type,
                          icon: type === 'expense' ? DEFAULT_EXPENSE_ICON : DEFAULT_INCOME_ICON,
                        }))
                      }
                    >
                      {type === 'expense' ? t('common.expense') : t('common.income')}
                    </button>
                  ))}
                </div>
              </label>

              <label style={styles.label}>
                {t('categories.form.icon')}
                <div style={styles.iconGrid}>
                  {ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      style={form.icon === ic ? styles.iconButtonActive : styles.iconButton}
                      onClick={() => setForm((f) => ({ ...f, icon: ic }))}
                      aria-label={t('categories.form.iconAria', { icon: ic })}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </label>

              <label style={styles.label}>
                {t('categories.form.color')}
                <div style={styles.colorGrid}>
                  {COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      style={{
                        ...styles.colorButton,
                        backgroundColor: col,
                        ...(form.color === col ? styles.colorButtonActive : {}),
                      }}
                      onClick={() => setForm((f) => ({ ...f, color: col }))}
                      aria-label={t('categories.form.colorAria', { color: col })}
                    />
                  ))}
                </div>
              </label>

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
                      ? t('categories.form.saveChanges')
                      : t('categories.form.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? t('categories.deleteTitle', { name: deleting.name }) : ''}
        message={t('categories.deleteMessage')}
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
  pageActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  toolbar: {
    marginBottom: '1rem',
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
  tabs: {
    display: 'flex',
    gap: '0.375rem',
    marginBottom: '1rem',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.75rem',
    padding: '0.25rem',
  },
  tab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: 'transparent',
    color: 'var(--color-text-muted)',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabActive: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    backgroundColor: 'var(--color-surface-hover)',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabBadge: {
    backgroundColor: 'var(--color-surface-hover)',
    color: 'var(--color-text-muted)',
    borderRadius: '9999px',
    padding: '0.125rem 0.5rem',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  group: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '1rem',
    border: '1px solid var(--color-border)',
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
  swatch: {
    width: '2.25rem',
    height: '2.25rem',
    borderRadius: '0.625rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  swatchIcon: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.9)',
    textShadow: '0 1px 2px rgba(0,0,0,0.35)',
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
  cardParent: {
    margin: 0,
    fontSize: '0.75rem',
    color: 'var(--color-text-dim)',
  },
  cardCount: {
    margin: 0,
    fontSize: '0.75rem',
    color: 'var(--color-text-dim)',
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
  formRow: {
    display: 'flex',
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
  typeToggle: {
    display: 'flex',
    gap: '0.375rem',
  },
  typeButton: {
    flex: 1,
    padding: '0.5rem',
    borderRadius: '0.375rem',
    border: '1px solid var(--color-border)',
    background: 'transparent',
    color: 'var(--color-text-muted)',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  typeActive: {
    flex: 1,
    padding: '0.5rem',
    borderRadius: '0.375rem',
    border: '1px solid var(--color-primary)',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  iconGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.375rem',
  },
  iconButton: {
    backgroundColor: 'var(--color-input-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.375rem',
    padding: '0.25rem 0.5rem',
    color: 'var(--color-text-muted)',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  iconButtonActive: {
    backgroundColor: 'var(--color-surface-hover)',
    border: '1px solid var(--color-primary)',
    color: 'var(--color-text)',
    borderRadius: '0.375rem',
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  colorGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.375rem',
  },
  colorButton: {
    width: '1.75rem',
    height: '1.75rem',
    borderRadius: '0.5rem',
    border: '2px solid transparent',
    cursor: 'pointer',
  },
  colorButtonActive: {
    borderColor: 'var(--color-text)',
    boxShadow: '0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-border-strong)',
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
    maxWidth: 520,
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
  secondaryButton: {
    backgroundColor: 'transparent',
    color: 'var(--color-text-muted)',
    border: '1px solid var(--color-border)',
    padding: '0.625rem 1.25rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

