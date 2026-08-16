import * as React from 'react';
import { CheckCircle2, FileUp, History, Upload, XCircle } from 'lucide-react';

import { useI18n } from '@/app/i18n';
import { useToast } from '@/components/ui/toaster';
import {
  fetchReconciliationHistory,
  uploadReconciliation,
  uploadReconciliationFile,
  type ReconciliationUploadResponse,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CsvRow {
  date: string;
  description: string;
  amount: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
  const rows: CsvRow[] = [];
  for (const line of lines) {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) {
        parts.push(current);
        current = '';
      } else current += ch;
    }
    parts.push(current);
    if (parts.length >= 3) {
      rows.push({
        date: parts[0].trim(),
        description: parts[1].trim(),
        amount: parts[2].trim(),
      });
    }
  }
  return rows;
}

export function ReconciliationPage() {
  const { t, formatMoney, formatDate, formatDateTime } = useI18n();
  const { toast } = useToast();

  const [statementName, setStatementName] = React.useState('');
  const [autoCreate, setAutoCreate] = React.useState(false);
  const [rawCsv, setRawCsv] = React.useState('');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<ReconciliationUploadResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<
    Awaited<ReturnType<typeof fetchReconciliationHistory>>['items']
  >([]);

  const loadHistory = React.useCallback(async () => {
    try {
      const data = await fetchReconciliationHistory();
      setHistory(data.items);
    } catch {
      // Non-critical.
    }
  }, []);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const showResult = async (res: ReconciliationUploadResponse) => {
    setResult(res);
    await loadHistory();
    toast({
      title: t('recon.done', { matched: res.matched_rows, unmatched: res.unmatched_rows }),
      variant: 'success',
    });
  };

  const handlePaste = async () => {
    const rows = parseCsv(rawCsv);
    if (rows.length === 0) {
      setError(t('recon.validation.empty'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await uploadReconciliation({
        statement_name: statementName.trim() || t('recon.bankStatement'),
        lines: rows,
        auto_create_unmatched: autoCreate,
      });
      await showResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('recon.failedUpload'));
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await uploadReconciliationFile(selectedFile, {
        statementName: statementName.trim() || undefined,
        autoCreateUnmatched: autoCreate,
      });
      await showResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('recon.failedUpload'));
    } finally {
      setLoading(false);
    }
  };

  const resultItems = result?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('nav.reconciliation')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('recon.subtitle')}</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Upload file */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-4 w-4" />
              {t('recon.uploadFileTitle')}
            </CardTitle>
            <CardDescription>{t('recon.chooseFile')} (.csv / .ofx)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rec-name">{t('recon.statementName')}</Label>
              <Input
                id="rec-name"
                value={statementName}
                onChange={(e) => setStatementName(e.target.value)}
                placeholder={t('recon.statementNamePlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-file">{t('recon.chooseFile')}</Label>
              <Input
                id="rec-file"
                type="file"
                accept=".csv,.ofx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              {selectedFile && (
                <p className="text-xs text-dim">
                  {t('recon.selected', { name: selectedFile.name, size: selectedFile.size })}
                </p>
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={autoCreate}
                onChange={(e) => setAutoCreate(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              {t('recon.autoCreateShort')}
            </label>
            <Button onClick={() => void handleFile()} disabled={loading || !selectedFile}>
              <Upload className="h-4 w-4" />
              {loading ? t('common.loading') : t('recon.uploadReconcile')}
            </Button>
          </CardContent>
        </Card>

        {/* Paste CSV */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {t('recon.pasteCsv')}
            </CardTitle>
            <CardDescription>{t('recon.csvPlaceholder')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={rawCsv}
              onChange={(e) => setRawCsv(e.target.value)}
              placeholder={t('recon.csvPlaceholder')}
              className="min-h-[8rem] font-mono text-xs"
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={autoCreate}
                onChange={(e) => setAutoCreate(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              {t('recon.autoCreateShort')}
            </label>
            <Button onClick={() => void handlePaste()} disabled={loading || !rawCsv.trim()}>
              {loading ? t('common.loading') : t('recon.uploadReconcile')}
            </Button>
          </CardContent>
        </Card>
      </div>


      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>{t('recon.results')}</CardTitle>
            <CardDescription>
              {t('recon.name')}: {statementName || t('recon.bankStatement')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('recon.totalRows')}</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{result.total_rows}</p>
              </div>
              <div className="rounded-lg border border-income/30 bg-income/5 p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('recon.matched')}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-income">{result.matched_rows}</p>
              </div>
              <div className="rounded-lg border border-expense/30 bg-expense/5 p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('recon.unmatched')}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-expense">{result.unmatched_rows}</p>
              </div>
            </div>

            {resultItems.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{t('common.date')}</TableHead>
                      <TableHead>{t('common.description')}</TableHead>
                      <TableHead className="text-right">{t('common.amount')}</TableHead>
                      <TableHead>{t('recon.status')}</TableHead>
                      <TableHead className="text-right">{t('recon.confidence')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(item.statement_date)}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate">
                          {item.statement_description}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(item.statement_amount)}
                        </TableCell>
                        <TableCell>
                          {item.match_status === 'matched' ? (
                            <Badge variant="income">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              {t('recon.matched')}
                            </Badge>
                          ) : (
                            <Badge variant="expense">
                              <XCircle className="mr-1 h-3 w-3" />
                              {t('recon.unmatched')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.confidence ? `${item.confidence}%` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('recon.history')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{h.statement_name}</span>
                  <span className="text-xs text-dim">{formatDateTime(h.uploaded_at)}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {h.total_rows} {t('common.entries')}
                  </span>
                  <span className="text-xs tabular-nums text-income">{h.matched_rows} ✓</span>
                  <span className="text-xs tabular-nums text-expense">{h.unmatched_rows} ✗</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

