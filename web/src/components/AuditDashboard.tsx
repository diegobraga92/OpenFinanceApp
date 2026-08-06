import { useState, useEffect, type CSSProperties } from 'react';
import { AuditEvent, fetchAuditEvents } from '../api';

interface Props {
  token: string;
}

export function AuditDashboard({ token }: Props) {
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [eventType, setEventType] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (page = 0) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAuditEvents(token, { event_type: eventType || undefined, page, page_size: 50 });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (token) load(); }, [token]);

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Audit Log</h2>
          <p style={styles.pageSubtitle}>Admin-only view of the immutable event trail.</p>
        </div>
      </div>

      {error && <div style={styles.errorBox}><p>{error}</p></div>}

      <div style={styles.filters}>
        <input
          style={styles.input}
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          placeholder="Filter by event type (e.g. TransactionRecorded)"
        />
        <button type="button" style={styles.button} onClick={() => load()} disabled={loading}>
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </div>

      {items.length === 0 ? (
        <p style={styles.empty}>No audit events found.</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Time</th>
                <th style={styles.th}>Event Type</th>
                <th style={styles.th}>Aggregate</th>
                <th style={styles.th}>Aggregate ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} style={styles.tr}>
                  <td style={styles.td}>{new Date(e.occurred_at).toLocaleString()}</td>
                  <td style={styles.td}>{e.event_type}</td>
                  <td style={styles.td}>{e.aggregate_type}</td>
                  <td style={styles.td} title={JSON.stringify(e.payload)}>{e.aggregate_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' },
  pageTitle: { fontSize: '1.5rem', fontWeight: 700, margin: 0 },
  pageSubtitle: { color: '#94a3b8', fontSize: '0.875rem', margin: '0.25rem 0 0 0' },
  errorBox: { backgroundColor: '#450a0a', border: '1px solid #991b1b', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem' },
  filters: { display: 'flex', gap: '0.5rem', marginBottom: '1rem' },
  input: { flex: 1, backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', color: '#e2e8f0', fontSize: '0.875rem' },
  button: { backgroundColor: '#22c55e', color: '#0f172a', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' },
  empty: { color: '#64748b', textAlign: 'center', padding: '1rem 0' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' },
  th: { textAlign: 'left', padding: '0.625rem 0.75rem', color: '#94a3b8', fontWeight: 500, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #334155' },
  tr: { borderBottom: '1px solid #1e293b' },
  td: { padding: '0.625rem 0.75rem', color: '#e2e8f0' },
};