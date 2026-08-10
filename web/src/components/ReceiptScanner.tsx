import { useState, useEffect, type CSSProperties, type ChangeEvent } from 'react';
import {
  scanReceipt,
  saveReceipt,
  fetchReceipts,
} from '../api';

interface Props {
  formatMoney: (value: string | number) => string;
}

export function ReceiptScanner({ formatMoney }: Props) {
  const [qrData, setQrData] = useState('');
  const [parsed, setParsed] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [gallery, setGallery] = useState<Record<string, string | number | null>[]>([]);

  const loadGallery = async () => {
    try {
      const res = await fetchReceipts();
      setGallery(res.items as Record<string, string | number | null>[]);
    } catch { /* non-critical */ }
  };

  useEffect(() => { loadGallery(); }, []);

  const parseQr = async () => {
    setError(null);
    setParsed(null);
    setLoading(true);
    try {
      const res = await scanReceipt(qrData);
      setParsed(res as Record<string, string>);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse QR');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!parsed || !parsed.total) return;
    setError(null);
    setLoading(true);
    try {
      const res = await saveReceipt({
        store_name: parsed.store_name || 'Unknown Store',
        cnpj: parsed.cnpj || null,
        date: (parsed.date as string)?.split('T')[0] || new Date().toISOString().slice(0, 10),
        total: parsed.total,
        items: [{ description: 'Receipt', quantity: '1', total_price: parsed.total }],
      });
      setSavedId(res.id);
      await loadGallery();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save receipt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Receipt Scanner</h2>
          <p style={styles.pageSubtitle}>Paste an NFC-e QR code to parse its receipt data (no OCR).</p>
        </div>
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Scan NFC-e QR</h3>
        {error && <div style={styles.errorBox}><p>{error}</p></div>}
        <label style={styles.label}>
          QR Code Data
          <textarea
            style={styles.input}
            value={qrData}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setQrData(e.target.value)}
            placeholder="Paste the NFC-e QR code URL (e.g. http://www.fazenda.gov.br/nfce/qrcode?v=2&p=...)"
            spellCheck={false}
          />
        </label>
        <button type="button" style={styles.button} onClick={parseQr} disabled={loading || !qrData.trim()}>
          {loading ? 'Parsing…' : 'Scan QR'}
        </button>
      </div>

      {parsed && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Parsed Receipt</h3>
          <div style={styles.fieldGrid}>
            <div><p style={styles.fieldLabel}>Store</p><p style={styles.fieldValue}>{parsed.store_name || '—'}</p></div>
            <div><p style={styles.fieldLabel}>Total</p><p style={styles.fieldValue}>{formatMoney(parsed.total || '0')}</p></div>
            <div><p style={styles.fieldLabel}>Date</p><p style={styles.fieldValue}>{parsed.date || '—'}</p></div>
            <div><p style={styles.fieldLabel}>CNPJ</p><p style={styles.fieldValue}>{parsed.cnpj || '—'}</p></div>
          </div>
          <button type="button" style={styles.button} onClick={save} disabled={loading}>
            {loading ? 'Saving…' : 'Save Receipt'}
          </button>
          {savedId && <p style={styles.success}>Saved ✓ (id: {savedId})</p>}
        </div>
      )}

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Gallery</h3>
        {gallery.length === 0 ? (
          <p style={styles.empty}>No receipts yet.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Store</th>
                  <th style={styles.th} align="right">Total</th>
                  <th style={styles.th} align="right">Items</th>
                </tr>
              </thead>
              <tbody>
                {gallery.map((r) => (
                  <tr key={r.id} style={styles.tr}>
                    <td style={styles.td}>{r.receipt_date || '—'}</td>
                    <td style={styles.td}>{r.store_name || '—'}</td>
                    <td style={styles.td} align="right">{r.total_amount != null ? formatMoney(r.total_amount) : '—'}</td>
                    <td style={styles.td} align="right">{r.item_count ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' },
  pageTitle: { fontSize: '1.5rem', fontWeight: 700, margin: 0 },
  pageSubtitle: { color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' },
  section: { backgroundColor: 'var(--color-surface)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid var(--color-border)', marginBottom: '2rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' },
  errorBox: { backgroundColor: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger-text)', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' },
  input: { backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.75rem', color: 'var(--color-text)', fontSize: '0.8125rem', fontFamily: 'monospace', minHeight: '6rem', resize: 'vertical', width: '100%', boxSizing: 'border-box' },
  button: { backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-text)', border: 'none', padding: '0.625rem 1.5rem', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' },
  fieldGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1rem' },
  fieldLabel: { color: 'var(--color-text-muted)', fontSize: '0.75rem', margin: '0 0 0.25rem 0', textTransform: 'uppercase', letterSpacing: '0.05em' },
  fieldValue: { color: 'var(--color-text)', fontSize: '1rem', margin: 0 },
  success: { color: 'var(--color-primary)', marginTop: '0.75rem', fontSize: '0.875rem' },
  empty: { color: 'var(--color-text-dim)', textAlign: 'center', padding: '1rem 0' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: { textAlign: 'left', padding: '0.625rem 0.75rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)' },
  tr: { borderBottom: '1px solid var(--color-surface)' },
  td: { padding: '0.625rem 0.75rem', color: 'var(--color-text)' },
};