import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';

import { useI18n } from '@/app/i18n';
import { useToast } from '@/components/ui/toaster';
import { deleteCategory, fetchCategories, type Category } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CategoryForm } from './CategoryForm';
import { categoryIcon } from '@shared/category-icons';

export function CategoriesPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = React.useState<'expense' | 'income'>('expense');
  const [query, setQuery] = React.useState('');
  const [formOpen, setFormOpen] = React.useState(false);
  const [formType, setFormType] = React.useState<'expense' | 'income'>('expense');
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<Category | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => fetchCategories() });
  const categories = categoriesQuery.data ?? [];

  const childrenByParent = React.useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of categories) {
      if (c.parent_id) {
        const list = map.get(c.parent_id) ?? [];
        list.push(c);
        map.set(c.parent_id, list);
      }
    }
    return map;
  }, [categories]);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = categories.filter((c) => c.type === tab);
    if (!q) return source;
    return source.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.icon ?? '').toLowerCase().includes(q),
    );
  }, [categories, tab, query]);

  const refresh = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['categories'] });
  }, [queryClient]);

  const openCreate = (type: 'expense' | 'income') => {
    setEditing(null);
    setFormType(type);
    setTab(type);
    setFormOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const target = pendingDelete;
    try {
      await deleteCategory(target.id);
      setPendingDelete(null);
      await refresh();
      toast({ title: t('categories.deleted', { name: target.name }) });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : t('categories.failedDelete'),
        variant: 'error',
      });
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('nav.categories')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('categories.search')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => openCreate('income')}>
            <Plus className="h-4 w-4" />
            {t('categories.newIncome')}
          </Button>
          <Button size="sm" onClick={() => openCreate('expense')}>
            <Plus className="h-4 w-4" />
            {t('categories.newExpense')}
          </Button>
        </div>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'expense' | 'income')}>
          <TabsList>
            <TabsTrigger value="expense">{t('categories.tabExpenses')}</TabsTrigger>
            <TabsTrigger value="income">{t('categories.tabIncome')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('categories.search')}
            aria-label={t('categories.searchAria')}
          />
        </div>
      </div>


      {/* Grid */}
      {visible.length === 0 ? (
        <div className="card-surface flex flex-col items-center justify-center gap-1 py-16 text-center">
          <p className="text-sm font-medium">
            {query
              ? t('categories.noMatchingTitle')
              : tab === 'expense'
                ? t('categories.noExpenseTitle')
                : t('categories.noIncomeTitle')}
          </p>
          <p className="max-w-sm text-sm text-dim">
            {query ? t('categories.noMatchingDesc', { query }) : t('categories.noExpenseDesc')}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((c) => {
            const children = childrenByParent.get(c.id) ?? [];
            return (
              <div key={c.id} className="card-surface group flex items-center gap-3 p-4">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl"
                  style={{ backgroundColor: `${c.color ?? '#6366f1'}1a` }}
                  aria-hidden="true"
                >
                  {categoryIcon(c.icon)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-dim">
                    {c.parent_id
                      ? t('common.subcategory')
                      : children.length > 0
                        ? t(
                            children.length === 1
                              ? 'common.subcategory'
                              : 'common.subcategories',
                            { count: children.length },
                          )
                        : t('common.topLevel')}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(c)}
                    aria-label={t('common.edit')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setPendingDelete(c)}
                    aria-label={t('common.delete')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CategoryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        editing={editing}
        initialType={formType}
        onSaved={(name) => {
          const label = editing
            ? t('categories.updated', { name: editing.name })
            : t('categories.created', { name });
          setFormOpen(false);
          setEditing(null);
          void refresh();
          toast({ title: label, variant: 'success' });
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('categories.deleteTitle', { name: pendingDelete?.name ?? '' })}
        description={t('categories.deleteMessage')}
        busy={deleting}
        destructive
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

