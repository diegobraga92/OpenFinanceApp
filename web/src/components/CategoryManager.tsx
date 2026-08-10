import { useState, type CSSProperties, type FormEvent } from 'react';
import type { Category } from '../api';
import { createCategory } from '../api';
import { useToast } from './Toast';

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

export function CategoryManager({ categories, onCategoriesChanged }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [icon, setIcon] = useState('shopping-cart');
  const [color, setColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push: pushToast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createCategory({ name, type, icon, color });
      pushToast({ message: `Category "${name}" created` });
      setName('');
      setIcon(type === 'expense' ? 'shopping-cart' : 'briefcase');
      await onCategoriesChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  const renderCategoryGroup = (title: string, items: Category[]) => (
    <div style={styles.group}>
      <h4 style={styles.groupTitle}>{title}</h4>
      <div style={styles.grid}>
        {items.map((c) => (
          <div key={c.id} style={styles.card}>
            <div style={{ ...styles.swatch, backgroundColor: c.color || 'var(--color-border)' }}>
              {c.icon || '•'}
            </div>
            <div style={styles.cardInfo}>
              <p style={styles.cardName}>{c.name}</p>
              {c.parent_id && <p style={styles.cardParent}>Subcategory</p>}
            </div>
          </div>
        ))}
        {items.length === 0 && <p style={styles.empty}>No categories yet.</p>}
      </div>
    </div>
  );

  return (
    <div>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>Categories</h2>
      </div>

      <div style={styles.formCard}>
        <h3 style={styles.formTitle}>New Category</h3>
        {error && (
          <div style={styles.error}>
            <p>{error}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formRow}>
            <label style={styles.label}>
              Name
              <input
                style={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pets"
                required
              />
            </label>

            <label style={styles.label}>
              Type
              <select
                style={styles.input}
                value={type}
                onChange={(e) => {
                  const newType = e.target.value as 'income' | 'expense';
                  setType(newType);
                  setIcon(newType === 'expense' ? 'shopping-cart' : 'briefcase');
                }}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
          </div>

          <label style={styles.label}>
            Icon
            <div style={styles.iconGrid}>
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  style={{ ...styles.iconButton, ...(icon === ic ? styles.iconButtonActive : {}) }}
                  onClick={() => setIcon(ic)}
                  title={ic}
                >
                  {ic}
                </button>
              ))}
            </div>
          </label>

          <label style={styles.label}>
            Color
            <div style={styles.colorGrid}>
              {COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  style={{
                    ...styles.colorButton,
                    backgroundColor: col,
                    ...(color === col ? styles.colorButtonActive : {}),
                  }}
                  onClick={() => setColor(col)}
                  aria-label={`Color ${col}`}
                />
              ))}
            </div>
          </label>

          <button type="submit" style={styles.submitButton} disabled={saving}>
            {saving ? 'Creating…' : 'Create Category'}
          </button>
        </form>
      </div>

      <div style={styles.lists}>
        {renderCategoryGroup('Expense Categories', expenseCategories)}
        {renderCategoryGroup('Income Categories', incomeCategories)}
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
  pageTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
  },
  formCard: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '1.5rem',
    border: '1px solid var(--color-border)',
    marginBottom: '2rem',
  },
  formTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    margin: '0 0 1rem 0',
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
    backgroundColor: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  iconGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.375rem',
  },
  iconButton: {
    backgroundColor: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.375rem',
    padding: '0.25rem 0.5rem',
    color: 'var(--color-text-muted)',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  iconButtonActive: {
    backgroundColor: 'var(--color-border)',
    borderColor: 'var(--color-primary)',
    color: 'var(--color-text)',
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
  },
  submitButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    border: 'none',
    padding: '0.5rem 1.5rem',
    borderRadius: '0.5rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  lists: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  group: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '1.5rem',
    border: '1px solid var(--color-border)',
  },
  groupTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    margin: '0 0 1rem 0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '0.75rem',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    borderRadius: '0.5rem',
    backgroundColor: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
  },
  swatch: {
    width: '2rem',
    height: '2rem',
    borderRadius: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
  },
  cardInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  cardName: {
    margin: 0,
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--color-text)',
  },
  cardParent: {
    margin: 0,
    fontSize: '0.75rem',
    color: 'var(--color-text-dim)',
  },
  empty: {
    color: 'var(--color-text-dim)',
    fontSize: '0.875rem',
  },
};