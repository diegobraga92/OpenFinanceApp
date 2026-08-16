import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, BookOpen, Plus } from 'lucide-react';

import { useI18n } from '@/app/i18n';
import { useToast } from '@/components/ui/toaster';
import {
  createLedgerTransaction,
  fetchAccountsWithBalance,
  fetchLedgerTransactions,
  migrateSingleToDouble,
  type LedgerEntry,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function LedgerPage() {
  const { t, formatMoney, formatDate } = useI18n();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [debitAccountId, setDebitAccountId] = React.useState('');
  const [creditAccountId, setCreditAccountId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const ledgerQuery = useQuery({ queryKey: ['ledger'], queryFn: () => fetchLedgerTransactions() });
  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => fetchAccountsWithBalance(),
  });
  const transactions = ledgerQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];

  const handleCreate = async () => {
    const amt = parseFloat(amount.replace(',', '.'));
    if (!description.trim() || !debitAccountId || !creditAccountId || !(amt > 0)) {
      setError(t('ledger.validation.fill'));
      return;
    }
    if (debitAccountId === creditAccountId) {
      setError(t('ledger.validation.different'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createLedgerTransaction({
        description: description.trim(),
        date,
        entries: [
          { account_id: debitAccountId, debit_amount: amount.replace(',', '.'), credit_amount: '0', description: t('ledger.debit') },
          { account_id: creditAccountId, debit_amount: '0', credit_amount: amount.replace(',', '.'), description: t('ledger.credit') },
        ],
      });
      setFormOpen(false);
      setDescription('');
      setDebitAccountId('');
      setCreditAccountId('');
      setAmount('');
      await ledgerQuery.refetch();
      toast({ title: t('ledger.created'), variant: 'success' });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ledger.failedCreate'));
    } finally {
      setSaving(false);
    }
  };

  const handleMigrate = async () => {
    try {
      const res = await migrateSingleToDouble();
      await ledgerQuery.refetch();
      toast({
        title: t('ledger.migrated', { migrated: res.migrated, total: res.total_processed }),
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : t('ledger.migrationFailed'),
        variant: 'error',
      });
    }
  };

  const renderEntry = (entry: LedgerEntry) => {
    const isDebit = parseFloat(entry.debit_amount) > 0;
    return (
      <div className="flex items-center gap-2 py-1 text-sm">
        {isDebit ? (
          <ArrowDown className="h-3.5 w-3.5 shrink-0 text-expense" />
        ) : (
          <ArrowUp className="h-3.5 w-3.5 shrink-0 text-income" />
        )}
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {entry.account_name ?? entry.account_id.slice(0, 8)}
        </span>
        <span className={cn('tabular-nums', isDebit ? 'text-expense' : 'text-income')}>
          {isDebit ? t('ledger.debit') : t('ledger.credit')}{' '}
          {formatMoney(isDebit ? entry.debit_amount : entry.credit_amount)}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('nav.ledger')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('ledger.noDesc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void handleMigrate()}>
            {t('ledger.migrate')}
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('ledger.newEntry')}
          </Button>
        </div>
      </div>

      {ledgerQuery.isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-4/5" />
          </CardContent>
        </Card>
      ) : transactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <BookOpen className="h-8 w-8 text-dim" />
            <p className="text-sm font-medium">{t('ledger.noTitle')}</p>
            <p className="max-w-md text-sm text-dim">{t('ledger.noDesc')}</p>
            <Button className="mt-2" size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              {t('ledger.newEntry')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {transactions.map((tx) => (
            <Card key={tx.transaction_id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm">{tx.description}</CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-2">
                      <span>{formatDate(tx.date)}</span>
                      <span className="font-mono text-xs text-dim">
                        {tx.transaction_id.slice(0, 8)}…
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="divide-y divide-border pt-1">
                {tx.entries.map((entry) => (
                  <div key={entry.id}>{renderEntry(entry)}</div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New ledger entry */}
      <Dialog open={formOpen} onOpenChange={(next) => !saving && setFormOpen(next)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('ledger.form.title')}</DialogTitle>
            <DialogDescription>{t('ledger.noDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ledger-desc">{t('ledger.form.description')}</Label>
              <Input
                id="ledger-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('ledger.form.descriptionPlaceholder')}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ledger-date">{t('common.date')}</Label>
              <Input id="ledger-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ledger-debit">{t('ledger.form.debit')}</Label>
                <select
                  id="ledger-debit"
                  className="flex h-9 w-full rounded-md border border-input bg-surface px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={debitAccountId}
                  onChange={(e) => setDebitAccountId(e.target.value)}
                >
                  <option value="">— {t('ledger.form.select')} —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ledger-credit">{t('ledger.form.credit')}</Label>
                <select
                  id="ledger-credit"
                  className="flex h-9 w-full rounded-md border border-input bg-surface px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={creditAccountId}
                  onChange={(e) => setCreditAccountId(e.target.value)}
                >
                  <option value="">— {t('ledger.form.select')} —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ledger-amount">{t('ledger.form.amount')}</Label>
              <Input
                id="ledger-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? t('common.saving') : t('ledger.form.createEntry')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

