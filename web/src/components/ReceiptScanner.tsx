import { useState, useEffect, type CSSProperties, type ChangeEvent } from 'react';
import {
  scanReceipt,
  saveReceipt,
  fetchReceipts,
  fetchPriceHistory,
  mergeProducts,
} from '../api';
import { useToast } from './Toast';

interface Props {
  formatMoney: (value: string | number) => string;
}

interface ReceiptItem {
  id: string;
  receipt_id: string;
  description: string;
  quantity: string | number;
  unit_price: string | number;
  total_price: string | number;
  normalized_product_id: string | null;
}

interface PricePoint {
  receipt_date: string | null;
  store_name: string | null;
  unit_price: string | number | null;
  description: string;
}

interface ParsedReceipt {
  access_key?: string;
  total?: string;
  icms?: string;
  date?: string;
  cnpj?: string | null;
  store_name?: string;
  version?: string;
  items?: ParsedItem[];
}

interface ParsedItem {
  description?: string;
  quantity?: string | null;
  unit_price?: string | null;
  total_price?: string | null;
}

interface EditableItem {
  description: string;
  quantity: string;
  unit_price: string;
  total_price: string;
}

export function ReceiptScanner({ formatMoney }: Props) {
  const [qrData, setQrData] = useState('');
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [reviewItems, setReviewItems] = useState<EditableItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [gallery, setGallery] = useState<Record<string, string | number | null>[]>([]);
  const [itemsByReceipt, setItemsByReceipt] = useState<ReceiptItem[]>([]);
  const [priceHistory, setPriceHistory] = useState<PricePoint[] | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');
  const [mergeSource, setMergeSource] = useState('');
  const [merging, setMerging] = useState(false);
  const { push: pushToast } = useToast();

  const loadGallery = async () => {
    try {
      const res = await fetchReceipts();
      setGallery(res.items as Record<string, string | number | null>[]);
      const items = (res as unknown as { items_by_receipt?: ReceiptItem[] }).items_by_receipt;
      setItemsByReceipt(items ?? []);
    } catch { /* non-critical */ }
  };

  useEffect(() => { loadGallery(); }, []);

  // Unique products (by normalized_product_id) available in the gallery.
  const products = itemsByReceipt.filter(
    (i) => i.normalized_product_id,
  );

  const showPriceHistory = async (productId: string, productLabel: string) => {
    setSelectedProduct(productLabel);
    setPriceHistory(null);
    try {
      const res = await fetchPriceHistory(productId);
      setPriceHistory(res.points as PricePoint[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load price history');
    }
  };

  const handleMerge = async () => {
    if (!mergeTarget || !mergeSource || mergeTarget === mergeSource) {
      setError('Pick two different products to merge');
      return;
    }
    setMerging(true);
    setError(null);
    try {
      const res = await mergeProducts({ target_id: mergeTarget, source_id: mergeSource });
      pushToast({ message: `Products merged (${res.status})` });
      setMergeTarget('');
      setMergeSource('');
      setPriceHistory(null);
      await loadGallery();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge products');
    } finally {
      setMerging(false);
    }
  };

  const parseQr = async () => {
    setError(null);
    setParsed(null);
    setLoading(true);
    try {
      const res = await scanReceipt(qrData);
      const receipt = res as ParsedReceipt;
      setParsed(receipt);
      // Pre-fill the review list from parsed items, or fall back to a single
      // "Receipt" line with the total (current behavior).
      if (receipt.items && receipt.items.length > 0) {
        setReviewItems(
          receipt.items.map((i) => ({
            description: i.description ?? 'Item',
            quantity: i.quantity ?? '1',
            unit_price: i.unit_price ?? '',
            total_price: i.total_price ?? '',
          })),
        );
      } else {
        setReviewItems([
          {
            description: 'Receipt',
            quantity: '1',
            unit_price: '',
            total_price: receipt.total ?? '',
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse QR');
    } finally {
      setLoading(false);
    }
  };

  const updateReviewItem = (idx: number, patch: Partial<EditableItem>) => {
    setReviewItems((items) => items.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const save = async () => {
    if (!parsed || !parsed.total) return;
    setError(null);
    setLoading(true);
    try {
      const items = reviewItems
        .filter((i) => i.description.trim().length > 0)
        .map((i) => ({
          description: i.description.trim(),
          quantity: i.quantity || '1',
          unit_price: i.unit_price || undefined,
          total_price: i.total_price || undefined,
        }));
      const res = await saveReceipt({
        store_name: parsed.store_name || 'Unknown Store',
        cnpj: parsed.cnpj || null,
        date: (parsed.date as string)?.split('T')[0] || new Date().toISOString().slice(0, 10),
        total: parsed.total,
        items: items.length > 0 ? items : [{ description: 'Receipt', quantity: '1', total_price: parsed.total }],
      });
      setSavedId(res.id);
      await loadGallery();
      pushToast({ message: `Receipt saved with ${items.length} item(s)` });
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

          {reviewItems.length > 0 && (
            <div style={styles.itemReview}>
              <p style={styles.itemReviewTitle}>
                Items ({reviewItems.length}) — edit before saving
              </p>
              {reviewItems.map((item, idx) => (
                <div key={idx} style={styles.itemRow}>
                  <input
                    style={styles.itemInputDesc}
                    value={item.description}
                    onChange={(e) => updateReviewItem(idx, { description: e.target.value })}
                    placeholder="Description"
                  />
                  <input
                    style={styles.itemInputSmall}
                    value={item.quantity}
                    onChange={(e) => updateReviewItem(idx, { quantity: e.target.value })}
                    placeholder="Qty"
                  />
                  <input
                    style={styles.itemInputSmall}
                    value={item.unit_price}
                    onChange={(e) => updateReviewItem(idx, { unit_price: e.target.value })}
                    placeholder="Unit"
                  />
                  <input
                    style={styles.itemInputSmall}
                    value={item.total_price}
                    onChange={(e) => updateReviewItem(idx, { total_price: e.target.value })}
                    placeholder="Total"
                  />
                  <button
                    type="button"
                    style={styles.itemRemove}
                    onClick={() => setReviewItems((items) => items.filter((_, i) => i !== idx))}
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                style={styles.itemAdd}
                onClick={() =>
                  setReviewItems((items) => [
                    ...items,
                    { description: '', quantity: '1', unit_price: '', total_price: '' },
                  ])
                }
              >
                + Add item
              </button>
            </div>
          )}

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

      {products.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Products</h3>
          <p style={styles.productHint}>Click a product to see its price history.</p>
          <div style={styles.productGrid}>
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                style={styles.productChip}
                onClick={() => showPriceHistory(p.normalized_product_id!, p.description)}
              >
                {p.description}
              </button>
            ))}
          </div>

          {priceHistory && (
            <div style={styles.priceHistory}>
              <h4 style={styles.priceHistoryTitle}>Price history — {selectedProduct}</h4>
              {priceHistory.length === 0 ? (
                <p style={styles.empty}>No price history available yet.</p>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Date</th>
                        <th style={styles.th}>Store</th>
                        <th style={styles.th} align="right">Unit price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceHistory.map((pt, i) => (
                        <tr key={i} style={styles.tr}>
                          <td style={styles.td}>{pt.receipt_date || '—'}</td>
                          <td style={styles.td}>{pt.store_name || '—'}</td>
                          <td style={styles.td} align="right">
                            {pt.unit_price != null ? formatMoney(pt.unit_price) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {products.length > 1 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Merge duplicate products</h3>
          <p style={styles.productHint}>
            Reassign all items from the source product to the target product.
          </p>
          <div style={styles.mergeRow}>
            <label style={styles.label}>
              Keep (target)
              <select
                style={styles.select}
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
              >
                <option value="">Select…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.normalized_product_id!}>
                    {p.description}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Merge away (source)
              <select
                style={styles.select}
                value={mergeSource}
                onChange={(e) => setMergeSource(e.target.value)}
              >
                <option value="">Select…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.normalized_product_id!}>
                    {p.description}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              style={styles.button}
              onClick={handleMerge}
              disabled={merging}
            >
              {merging ? 'Merging…' : 'Merge'}
            </button>
          </div>
        </div>
      )}
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
  itemReview: {
    marginTop: '1rem',
    marginBottom: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  itemReviewTitle: {
    color: 'var(--color-text-muted)',
    fontSize: '0.8125rem',
    fontWeight: 600,
    margin: 0,
  },
  itemRow: {
    display: 'flex',
    gap: '0.375rem',
    alignItems: 'center',
  },
  itemInputDesc: {
    flex: 2,
    backgroundColor: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.375rem',
    padding: '0.375rem 0.5rem',
    color: 'var(--color-text)',
    fontSize: '0.8125rem',
    minWidth: 0,
  },
  itemInputSmall: {
    flex: 1,
    backgroundColor: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.375rem',
    padding: '0.375rem 0.5rem',
    color: 'var(--color-text)',
    fontSize: '0.8125rem',
    minWidth: 0,
  },
  itemRemove: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-danger)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    padding: '0.25rem',
  },
  itemAdd: {
    alignSelf: 'flex-start',
    background: 'transparent',
    border: '1px dashed var(--color-border)',
    color: 'var(--color-text-muted)',
    borderRadius: '0.375rem',
    padding: '0.375rem 0.75rem',
    fontSize: '0.8125rem',
    cursor: 'pointer',
  },
  success: { color: 'var(--color-primary)', marginTop: '0.75rem', fontSize: '0.875rem' },
  empty: { color: 'var(--color-text-dim)', textAlign: 'center', padding: '1rem 0' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' },
  th: { textAlign: 'left', padding: '0.625rem 0.75rem', color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-border)' },
  tr: { borderBottom: '1px solid var(--color-surface)' },
  td: { padding: '0.625rem 0.75rem', color: 'var(--color-text)' },
  productHint: { color: 'var(--color-text-muted)', fontSize: '0.8125rem', margin: '0 0 0.75rem 0' },
  productGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '1rem' },
  productChip: { backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', color: 'var(--color-text)', fontSize: '0.8125rem', cursor: 'pointer' },
  priceHistory: { marginTop: '0.5rem' },
  priceHistoryTitle: { fontSize: '0.9375rem', fontWeight: 600, margin: '0 0 0.75rem 0' },
  mergeRow: { display: 'flex', gap: '0.75rem', alignItems: 'flex-end' },
  select: { backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.625rem 0.75rem', color: 'var(--color-text)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' },
};