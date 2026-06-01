import { useState, useEffect } from 'react';
import { fetchHealth, HealthResponse } from './api';

type ConnectionStatus = 'loading' | 'healthy' | 'degraded' | 'error';

interface ComponentStatus {
  label: string;
  status: string;
}

function StatusBadge({ label, status }: ComponentStatus) {
  const color = status === 'connected' ? '#22c55e' :
                 status === 'degraded' ? '#f59e0b' : '#ef4444';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.25rem 0.75rem',
      borderRadius: '9999px',
      fontSize: '0.875rem',
      fontWeight: 500,
      backgroundColor: `${color}20`,
      color: color,
      border: `1px solid ${color}40`,
    }}>
      <span style={{
        width: '0.5rem',
        height: '0.5rem',
        borderRadius: '50%',
        backgroundColor: color,
        display: 'inline-block',
      }} />
      {label}: {status}
    </span>
  );
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const data = await fetchHealth();
        if (!cancelled) {
          setHealth(data);
          setStatus(data.database === 'connected' ? 'healthy' : 'degraded');
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setError(err instanceof Error ? err.message : 'Connection failed');
        }
      }
    }

    check();
    const interval = setInterval(check, 30000); // Poll every 30s
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#0f172a',
      color: '#e2e8f0',
    }}>
      <div style={{
        padding: '2rem',
        borderRadius: '1rem',
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)',
      }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          marginBottom: '1.5rem',
          textAlign: 'center',
        }}>
          🏦 PudimFinance
        </h1>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}>
          {status === 'loading' && (
            <p style={{ textAlign: 'center', color: '#94a3b8' }}>
              Checking connection...
            </p>
          )}

          {status === 'error' && (
            <div style={{
              padding: '1rem',
              borderRadius: '0.5rem',
              backgroundColor: '#450a0a',
              border: '1px solid #991b1b',
              color: '#fca5a5',
            }}>
              <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                ❌ Connection Error
              </p>
              <p style={{ fontSize: '0.875rem' }}>{error}</p>
            </div>
          )}

          {health && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <StatusBadge label="API" status={health.status} />
              <StatusBadge label="Database" status={health.database} />
              <StatusBadge label="RabbitMQ" status={health.rabbitmq} />
            </div>
          )}
        </div>

        {health && (
          <p style={{
            textAlign: 'center',
            fontSize: '0.75rem',
            color: '#64748b',
          }}>
            v{health.version}
          </p>
        )}
      </div>
    </div>
  );
}

export default App;