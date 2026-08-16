import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { useI18n } from '@/app/i18n';
import { useToast } from '@/components/ui/toaster';
import {
  deleteAccount,
  fetchAccountsWithBalance,
  fetchCategories,
  type AccountWithBalance,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AccountForm, KIND_OPTIONS, type AccountKind } from './AccountForm';
import { AccountDetail } from './AccountDetail';
import { cn } from '@/lib/utils';

const ASSET_KINDS: AccountKind[] = ['bank', 'cash', 'investment'];
const LIABILITY_KINDS: AccountKind[] = ['card', 'loan'];

export function AccountsPage() {
  const { t, formatMoney } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = React.useState(false);
  const [formKind, setFormKind] = React.useState<AccountKind>('bank');
  const [editing, setEditing] = React.useState<AccountWithBalance | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<AccountWithBalance | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [detail, setDetail] = React.useState<AccountWithBalance | null>(null);

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => fetchAccountsWithBalance(),
  });
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => fetchCategories() });
  const accounts = accountsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const refresh = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['accounts'] });
  }, [queryClient]);

  // Lifetime roll-ups (mirrors the legacy summary bar).
  const summary = React.useMemo(() => {
    const totalAssets = accounts
      .filter((a) => a.type === 'asset')
      .reduce((sum, a) => sum + parseFloat(a.balance), 0);
    const totalDebt = accounts
      .filter((a) => a.type === 'liability')
      .reduce((sum, a) => sum + Math.abs(parseFloat(a.balance)), 0);
    const totalIncome = accounts
      .filter((a) => a.type === 'income')
      .reduce((sum, a) => sum + Math.abs(parseFloat(a.balance)), 0);
    const totalExpenses = accounts
      .filter((a) => a.type === 'expense')
      .reduce((sum, a) => sum + parseFloat(a.balance), 0);
    return {
      totalAssets,
      totalDebt,
      totalIncome,
      totalExpenses,
      netIncome: totalIncome - totalExpenses,
    };
  }, [accounts]);

  const openCreate = (kind: AccountKind) => {
    setEditing(null);
    setFormKind(kind);
    setFormOpen(true);
  };

  const openEdit = (a: AccountWithBalance) => {
    setEditing(a);
    setFormOpen(true);
  };

  const renderAccountCard = (a: AccountWithBalance) => {
    const isDebt = a.type === 'liability';
    const isIncomeOrExpense = a.type === 'income' || a.type === 'expense';
    const absBalance = Math.abs(parseFloat(a.balance));
    return (
      <div
        key={a.id}
        className="card-surface group cursor-pointer p-4 transition-shadow hover:shadow-md"
        onClick={() => setDetail(a)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDetail(a);
          }
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg',
              isDebt ? 'bg-expense/10' : isIncomeOrExpense ? 'bg-income/10' : 'bg-accent',
            )}
            aria-hidden="true"
          >
            {isDebt ? '💳' : isIncomeOrExpense ? '📊' : '🏦'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{a.name}</p>
            <p className="text-xs text-dim">
              {t(
                a.transaction_count === 1
                  ? 'accounts.form.countEntries_one'
                  : 'accounts.form.countEntries_other',
                { count: a.transaction_count },
              )}
              {isDebt && a.due_day ? ` · ${t('common.due', { date: String(a.due_day) })}` : ''}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span
            className={cn(
              'text-base font-semibold tabular-nums',
              isDebt ? 'text-expense' : isIncomeOrExpense ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {isDebt || isIncomeOrExpense ? '−' : ''}
            {formatMoney(absBalance)}
          </span>
          <div className="flex shrink-0 gap-1 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(a);
              }}
              aria-label={t('common.edit')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setPendingDelete(a);
              }}
              aria-label={t('common.delete')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const groupForKind = (kind: AccountKind) =>
    accounts.filter((a) => a.account_kind === kind);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const target = pendingDelete;
    try {
      await deleteAccount(target.id);
      setPendingDelete(null);
      await refresh();
      toast({ title: t('accounts.deleted', { name: target.name }) });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : t('accounts.failedDelete'),
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
          <h1 className="text-2xl font-bold tracking-tight">{t('nav.accounts')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('accounts.search')}</p>
        </div>
        <Button size="sm" onClick={() => openCreate('bank')}>
          <Plus className="h-4 w-4" />
          {t('accounts.new')}
        </Button>
      </div>

      {/* Summary bar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: t('accounts.totalAssets'), value: summary.totalAssets, className: 'text-foreground' },
          { label: t('accounts.totalDebt'), value: summary.totalDebt, className: 'text-expense' },
          { label: t('accounts.totalIncome'), value: summary.totalIncome, className: 'text-income' },
          { label: t('accounts.totalExpenses'), value: summary.totalExpenses, className: 'text-expense' },
          {
            label: t('accounts.netIncome'),
            value: summary.netIncome,
            className: summary.netIncome >= 0 ? 'text-income' : 'text-expense',
          },
        ].map((item) => (
          <div key={item.label} className="card-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {item.label}
            </p>
            <p className={cn('mt-1 text-lg font-semibold tabular-nums', item.className)}>
              {formatMoney(item.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Groups */}
      {[
        {
          title: t('accounts.kindGroup.assets'),
          blurb: t('accounts.kindGroup.assetsBlurb'),
          kinds: ASSET_KINDS,
          empty: t('accounts.form.noGroup', { label: t('accounts.kindGroup.assets') }),
        },
        {
          title: t('accounts.kindGroup.liabilities'),
          blurb: t('accounts.kindGroup.liabilitiesBlurb'),
          kinds: LIABILITY_KINDS,
          empty: t('accounts.form.noGroup', { label: t('accounts.kindGroup.liabilities') }),
        },
      ].map((group) => {
        const groupAccounts = group.kinds.flatMap(groupForKind);
        return (
          <section key={group.title} className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-sm font-semibold">{group.title}</h2>
                <p className="text-xs text-dim">{group.blurb}</p>
              </div>
              <div className="flex gap-2">
                {group.kinds.map((kind) => (
                  <Button key={kind} variant="outline" size="sm" onClick={() => openCreate(kind)}>
                    <Plus className="h-3.5 w-3.5" />
                    {t(KIND_OPTIONS.find((o) => o.key === kind)!.labelKey)}
                  </Button>
                ))}
              </div>
            </div>
            {groupAccounts.length === 0 ? (
              <div className="card-surface py-10 text-center text-sm text-dim">{group.empty}</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {groupAccounts.map(renderAccountCard)}
              </div>
            )}
          </section>
        );
      })}

      <AccountForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        initialKind={formKind}
        onSaved={(name) => {
          const label = editing
            ? t('accounts.updated', { name: editing.name })
            : t('accounts.created', { name });
          setFormOpen(false);
          setEditing(null);
          void refresh();
          toast({ title: label, variant: 'success' });
        }}
      />

      {detail && (
        <AccountDetail account={detail} categories={categories} open onClose={() => setDetail(null)} />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('accounts.deleteTitle', { name: pendingDelete?.name ?? '' })}
        description={t('accounts.deleteMessage')}
        busy={deleting}
        destructive
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

