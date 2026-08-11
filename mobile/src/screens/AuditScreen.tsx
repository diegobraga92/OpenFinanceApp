import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AuditEvent, fetchAuditEvents } from '../api';
import { getAccessToken } from '../auth';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { EmptyState } from '../components/EmptyState';

export function AuditScreen() {
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [eventType, setEventType] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (page = 0) => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const res = await fetchAuditEvents(token, {
          event_type: eventType || undefined,
          page,
          page_size: 50,
        });
        setItems(res.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load audit events');
      } finally {
        setLoading(false);
      }
    },
    [eventType],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Audit Log</Text>
      </View>
      <Text style={styles.receiptHint}>
        Admin-only view of the immutable event trail.
      </Text>

      {error && (
        <View style={styles.reconErrorBox}>
          <Text style={styles.reconErrorText}>{error}</Text>
        </View>
      )}

      <View style={styles.auditFilters}>
        <TextInput
          style={styles.auditFilterInput}
          value={eventType}
          onChangeText={setEventType}
          placeholder="Filter by event type (e.g. TransactionRecorded)"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryText} size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Apply</Text>
          )}
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <EmptyState
          compact
          icon="📜"
          title="No audit events found"
          description="Try adjusting the event type filter or check back after more activity."
        />
      ) : (
        <View style={styles.auditList}>
          {items.map((e) => {
            const expanded = expandedId === e.id;
            return (
              <TouchableOpacity
                key={e.id}
                style={styles.auditRow}
                onPress={() => setExpandedId(expanded ? null : e.id)}
                accessibilityRole="button"
                accessibilityLabel={`${e.event_type} event`}
              >
                <View style={styles.auditRowHeader}>
                  <View style={styles.auditRowLeft}>
                    <Text style={styles.auditEventType}>{e.event_type}</Text>
                    <Text style={styles.auditAggregate}>
                      {e.aggregate_type} · {e.aggregate_id.slice(0, 8)}…
                    </Text>
                  </View>
                  <Text style={styles.auditTime}>
                    {new Date(e.occurred_at).toLocaleString()}
                  </Text>
                </View>
                {expanded && (
                  <Text style={styles.auditPayload}>
                    {JSON.stringify(e.payload, null, 2)}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
