import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { fetchHealth, HealthResponse } from './src/api';

type ConnectionStatus = 'idle' | 'loading' | 'healthy' | 'error';

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    setStatus('loading');
    setError(null);
    try {
      const data = await fetchHealth();
      setHealth(data);
      setStatus('healthy');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setStatus('error');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.card}>
        <Text style={styles.title}>🏦 PudimFinance</Text>
        <Text style={styles.subtitle}>Mobile Client</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={handleCheck}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.buttonText}>Check Connection</Text>
          )}
        </TouchableOpacity>

        {status === 'idle' && (
          <Text style={styles.hint}>Tap the button to check backend status</Text>
        )}

        {status === 'healthy' && health && (
          <View style={styles.statusContainer}>
            <Text style={styles.healthyText}>✅ All Systems Operational</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>API:</Text>
              <Text style={styles.statusValue}>{health.status}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Database:</Text>
              <Text style={styles.statusValue}>{health.database}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>RabbitMQ:</Text>
              <Text style={styles.statusValue}>{health.rabbitmq}</Text>
            </View>
            <Text style={styles.version}>v{health.version}</Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>❌ Connection Error</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e2e8f0',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  statusContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  healthyText: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statusLabel: {
    color: '#94a3b8',
    fontSize: 14,
  },
  statusValue: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '500',
  },
  version: {
    color: '#475569',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },
  errorContainer: {
    marginTop: 16,
    backgroundColor: '#450a0a',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#991b1b',
  },
  errorTitle: {
    color: '#fca5a5',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
  },
});