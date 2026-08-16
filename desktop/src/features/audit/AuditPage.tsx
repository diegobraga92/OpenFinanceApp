import * as React from 'react';
import { Filter, RefreshCw } from 'lucide-react';

import { useI18n } from '@/app/i18n';
import { useAuth } from '@/app/auth';
import { fetchAuditEvents, type AuditEvent } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export function AuditPage() {
  const { t, formatDateTime } = useI18n();
  const { token } = useAuth();

  const [items, setItems] = React.useState<AuditEvent[]>([]);
  const [eventType, setEventType] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(0);

  const load = React.useCallback(
    async (nextPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAuditEvents(token, {
          event_type: eventType || undefined,
          page: nextPage,
          page_size: 50,
        });
        setItems(res.items);
        setPage(res.page);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('audit.failedLoad'));
      } finally {
        setLoading(false);
      }
    },
    [token, eventType, t],
  );

  React.useEffect(() => {
    if (token) void load(0);
  }, [token, load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('nav.audit')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('audit.subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            placeholder={t('audit.filterPlaceholder')}
          />
        </div>
        <Button onClick={() => void load(0)} disabled={loading}>
          {loading ? t('common.loading') : t('common.apply')}
        </Button>
        <Button variant="outline" size="icon" onClick={() => void load(page)} disabled={loading} aria-label={t('common.retry')}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('nav.audit')}</CardTitle>
          <CardDescription>
            {items.length > 0 ? `${items.length} ${t('common.entries')}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-4/5" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
              <p className="text-sm font-medium">{t('audit.noEventsTitle')}</p>
              <p className="max-w-sm text-sm text-dim">{t('audit.noEventsDesc')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t('audit.time')}</TableHead>
                    <TableHead>{t('audit.eventType')}</TableHead>
                    <TableHead>{t('audit.aggregate')}</TableHead>
                    <TableHead>{t('audit.aggregateId')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(event.occurred_at)}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{event.event_type}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{event.aggregate_type}</TableCell>
                      <TableCell
                        className="max-w-[180px] truncate font-mono text-xs text-dim"
                        title={JSON.stringify(event.payload)}
                      >
                        {event.aggregate_id}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
