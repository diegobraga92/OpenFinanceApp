import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import {
  ReconciliationHistoryItem,
  ReconciliationUploadResponse,
  ReconciliationUploadRequest,
  fetchReconciliationHistory,
  uploadReconciliation,
  uploadReconciliationFile,
} from '../api';
import { useToast } from './Toast';

interface Props {
  formatMoney: (value: string | number) => string;
}

interface CsvRow {
  date: string;
  description: string;
  amount: string;
}

export function ReconciliationUpload({ formatMoney }: Props) {
  const [statementName, setStatementName] = useState('Bank Statement');
  const [rawCsv, setRawCsv] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [autoCreateUnmatched, setAutoCreateUnmatched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReconciliationUploadResponse | null>(null);
  const [history, setHistory] = useState<ReconciliationHistoryItem[]>([]);
  const { push: pushToast } = useToast();

  const loadHistory = useCallback(async () => {
    try {
      const data = await fetchReconciliationHistory();
      setHistory(data.items);
    } catch {
      // Non-critical.
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const parseCsv = (text: string): CsvRow[] => {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
    const rows: CsvRow[] = [];
    for (const line of lines) {
      // Handle quoted CSV fields
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
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const rows = parseCsv(rawCsv);
    if (rows.length === 0) {
      setError('CSV is empty or malformed. Expected columns: date,description,amount');
      return;
    }

    try {
      const payload: ReconciliationUploadRequest = {
        statement_name: statementName.trim() || 'Bank Statement',
        lines: rows.map((r) => ({
          date: r.date,
          description: r.description,
          amount: r.amount,
        })),
        auto_create_unmatched: autoCreateUnmatched,
      };
      setLoading(true);
      const res = await uploadReconciliation(payload);
      setResult(res);
      pushToast({
        message: `Reconciliation done: ${res.matched_rows} matched, ${res.unmatched_rows} unmatched`,
      });
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload reconciliation');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await uploadReconciliationFile(selectedFile, {
        statementName: statementName.trim() || selectedFile.name,
        autoCreateUnmatched,
      });
      setResult(res);
      pushToast({
        message: `Reconciliation done: ${res.matched_rows} matched, ${res.unmatched_rows} unmatched`,
      });
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload statement file');
    } finally {
      setLoading(false);
    }
  };

  const parseAmount = (v: string | undefined) => {
    if (v === undefined) return 0;
    const n = parseFloat(String(v));
    return isNaN(n) ? 0 : n;
  };

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Reconciliation</h2>
          <p style={styles.pageSubtitle}>
            Upload a bank statement (CSV or OFX) or paste CSV to match against your transactions
          </p>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Upload Statement File (.csv / .ofx)</h3>
        <form onSubmit={handleFileUpload} style={styles.form}>
          <label style={styles.label}>
            Statement Name
            <input
              style={styles.input}
              value={statementName}
              onChange={(e) => setStatementName(e.target.value)}
              placeholder="e.g. Nubank August 2026"
            />
          </label>
          <label style={styles.fileLabel}>
            Choose file
            <input
              type="file"
              accept=".csv,.ofx,.qfx,text/csv,application/x-ofx"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              style={styles.fileInput}
            />
          </label>
          {selectedFile && (
            <p style={styles.fileHint}>Selected: {selectedFile.name} ({selectedFile.size} bytes)</p>
          )}
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={autoCreateUnmatched}
              onChange={(e) => setAutoCreateUnmatched(e.target.checked)}
              style={styles.checkbox}
            />
            Auto-create transactions for unmatched rows (as expenses, uncategorized)
          </label>
          <button type="submit" style={styles.submitButton} disabled={loading || !selectedFile}>
            {loading ? 'Reconciling…' : 'Upload & Reconcile'}
          </button>
        </form>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Or Paste CSV Manually</h3>
        {error && (
          <div style={styles.errorBanner}>
            <p>{error}</p>
            <button onClick={() => setError(null)} style={styles.dismissButton}>✕</button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            CSV Data
            <textarea
              style={styles.csvInput}
              value={rawCsv}
              onChange={(e) => setRawCsv(e.target.value)}
              placeholder={`date,description,amount\n2026-08-01,Supermarket,150.00\n2026-08-02,Salary,2500.00\n...\n\nFormat: date (YYYY-MM-DD), description, amount. Negative amounts = expenses.`}
              spellCheck={false}
            />
          </label>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={autoCreateUnmatched}
              onChange={(e) => setAutoCreateUnmatched(e.target.checked)}
              style={styles.checkbox}
            />
            Auto-create transactions for unmatched rows
          </label>

          <button type="submit" style={styles.submitButton} disabled={loading}>
            {loading ? 'Reconciling…' : 'Upload & Reconcile'}
          </button>
        </form>
      </div>

      {result && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Results</h3>
          <div style={styles.summaryCards}>
            <div style={styles.summaryCard}>
              <p style={styles.summaryLabel}>Total Rows</p>
              <p style={styles.summaryValue}>{result.total_rows}</p>
            </div>
            <div style={styles.summaryCard}>
              <p style={{ ...styles.summaryLabel, color: 'var(--color-income)' }}>Matched</p>
              <p style={{ ...styles.summaryValue, color: 'var(--color-income)' }}>{result.matched_rows}</p>
            </div>
            <div style={styles.summaryCard}>
              <p style={{ ...styles.summaryLabel, color: 'var(--color-expense)' }}>Unmatched</p>
              <p style={{ ...styles.summaryValue, color: 'var(--color-expense)' }}>{result.unmatched_rows}</p>
            </div>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Description</th>
                  <th style={styles.th} align="right">Amount</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {(result.items ?? []).map((item) => (
                  <tr key={item.id} style={styles.tr}>
                    <td style={styles.td}>{item.statement_date}</td>
                    <td style={styles.td}>{item.statement_description}</td>
                    <td style={{ ...styles.td, ...styles.numCell }}>
                      {formatMoney(item.statement_amount)}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          backgroundColor: item.match_status === 'matched' ? 'var(--color-primary)' : 'var(--color-danger-bg)',
                          color: item.match_status === 'matched' ? 'var(--color-primary-text)' : 'var(--color-danger)',
                        }}
                      >
                        {item.match_status}
                      </span>
                    </td>
                    <td style={{ ...styles.td, ...styles.numCell }}>
                      {item.confidence ? `${Math.round(parseAmount(item.confidence))}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>History</h3>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Uploaded</th>
                  <th style={styles.th} align="right">Total</th>
                  <th style={styles.th} align="right">Matched</th>
                  <th style={styles.th} align="right">Unmatched</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} style={styles.tr}>
                    <td style={styles.td}>{h.statement_name}</td>
                    <td style={styles.td}>{new Date(h.uploaded_at).toLocaleString('pt-BR')}</td>
                    <td style={{ ...styles.td, ...styles.numCell }}>{h.total_rows}</td>
                    <td style={{ ...styles.td, ...styles.numCell }}>{h.matched_rows}</td>
                    <td style={{ ...styles.td, ...styles.numCell }}>{h.unmatched_rows}</td>
                    <td style={styles.td}>{h.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
  },
  pageTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
  },
  pageSubtitle: {
    color: 'var(--color-text-muted)',
    fontSize: '0.875rem',
    margin: '0.25rem 0 0 0',
  },
  section: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '1rem',
    padding: '1.5rem',
    border: '1px solid var(--color-border)',
    marginBottom: '2rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    margin: '0 0 1rem 0',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'var(--color-danger-bg)',
    border: '1px solid var(--color-danger-border)',
    color: 'var(--color-danger-text)',
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    marginBottom: '1rem',
  },
  dismissButton: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-danger-text)',
    cursor: 'pointer',
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
  csvInput: {
    backgroundColor: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    padding: '0.75rem',
    color: 'var(--color-text)',
    fontSize: '0.8125rem',
    fontFamily: 'monospace',
    minHeight: '10rem',
    resize: 'vertical',
    width: '100%',
    boxSizing: 'border-box',
  },
  fileLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
  },
  fileInput: {
    backgroundColor: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    color: 'var(--color-text)',
    fontSize: '0.875rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  fileHint: {
    color: 'var(--color-text-muted)',
    fontSize: '0.8125rem',
    margin: 0,
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
  },
  checkbox: {
    accentColor: 'var(--color-primary)',
    width: '1rem',
    height: '1rem',
    cursor: 'pointer',
  },
  submitButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-primary-text)',
    border: 'none',
    padding: '0.625rem 1.5rem',
    borderRadius: '0.5rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  summaryCards: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'var(--color-bg)',
    borderRadius: '0.75rem',
    padding: '1rem',
    border: '1px solid var(--color-border)',
  },
  summaryLabel: {
    color: 'var(--color-text-muted)',
    fontSize: '0.75rem',
    margin: '0 0 0.25rem 0',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  summaryValue: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.625rem 0.75rem',
    color: 'var(--color-text-muted)',
    fontWeight: 500,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--color-border)',
  },
  tr: {
    borderBottom: '1px solid var(--color-surface)',
  },
  td: {
    padding: '0.625rem 0.75rem',
    color: 'var(--color-text)',
  },
  numCell: {
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
};