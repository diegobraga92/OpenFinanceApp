import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ReconciliationUploadResponse, uploadReconciliation } from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';

interface Props {
  formatMoney: (value: string | number) => string;
}

export function ReconciliationScreen({ formatMoney }: Props) {
  const [reconStatementName, setReconStatementName] = useState('Bank Statement');
  const [reconCsv, setReconCsv] = useState('');
  const [reconResult, setReconResult] = useState<ReconciliationUploadResponse | null>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconError, setReconError] = useState<string | null>(null);

  const handleReconSubmit = async () => {
    setReconError(null);
    setReconResult(null);
    if (!reconCsv.trim()) {
      setReconError('CSV data is required');
      return;
    }
    setReconLoading(true);
    try {
      // Minimal client-side CSV parse
      const rows = reconCsv
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#'))
        .map((line) => {
          const parts = line.split(',');
          return {
            date: (parts[0] || '').trim(),
            description: (parts[1] || '').trim(),
            amount: (parts[2] || '').trim(),
          };
        })
        .filter((r) => r.date && r.description && r.amount);

      if (rows.length === 0) {
        setReconError('CSV is empty or malformed. Expected date,description,amount');
        return;
      }

      const res = await uploadReconciliation({
        statement_name: reconStatementName.trim() || 'Bank Statement',
        lines: rows,
      });
      setReconResult(res);
    } catch (err) {
      setReconError(err instanceof Error ? err.message : 'Failed to upload reconciliation');
    } finally {
      setReconLoading(false);
    }
  };

  return (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Reconciliation</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Upload Statement</Text>

        <Text style={styles.label}>Statement Name</Text>
        <TextInput
          style={styles.input}
          value={reconStatementName}
          onChangeText={setReconStatementName}
          placeholder="Bank Statement"
          placeholderTextColor={colors.textDim}
        />

        <Text style={styles.label}>CSV Data (date,description,amount)</Text>
        <TextInput
          style={styles.reconCsvInput}
          value={reconCsv}
          onChangeText={setReconCsv}
          placeholder={"2026-08-01,Supermarket,150.00\n2026-08-02,Salary,2500.00"}
          placeholderTextColor={colors.textDim}
          multiline
          numberOfLines={6}
          autoCapitalize="none"
        />

        {reconError && (
          <View style={styles.reconErrorBox}>
            <Text style={styles.reconErrorText}>{reconError}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, reconLoading && styles.submitButtonDisabled]}
          onPress={handleReconSubmit}
          disabled={reconLoading}
        >
          {reconLoading ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.submitButtonText}>Upload & Reconcile</Text>
          )}
        </TouchableOpacity>
      </View>

      {reconResult && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Results</Text>
          <View style={styles.reconSummaryRow}>
            <View style={styles.reconSummaryItem}>
              <Text style={styles.reconSummaryLabel}>Total</Text>
              <Text style={styles.reconSummaryValue}>{reconResult.total_rows}</Text>
            </View>
            <View style={styles.reconSummaryItem}>
              <Text style={[styles.reconSummaryLabel, { color: colors.income }]}>Matched</Text>
              <Text style={[styles.reconSummaryValue, { color: colors.income }]}>{reconResult.matched_rows}</Text>
            </View>
            <View style={styles.reconSummaryItem}>
              <Text style={[styles.reconSummaryLabel, { color: colors.expense }]}>Unmatched</Text>
              <Text style={[styles.reconSummaryValue, { color: colors.expense }]}>{reconResult.unmatched_rows}</Text>
            </View>
          </View>

          {(reconResult.items ?? []).map((item) => (
            <View key={item.id} style={styles.reconRow}>
              <View style={styles.reconRowLeft}>
                <Text style={styles.reconDate}>{item.statement_date}</Text>
                <Text style={styles.reconDescription}>{item.statement_description}</Text>
              </View>
              <View style={styles.reconRowRight}>
                <Text style={styles.reconAmount}>{formatMoney(item.statement_amount)}</Text>
                <View
                  style={[
                    styles.reconStatusBadge,
                    {
                      backgroundColor: item.match_status === 'matched' ? colors.primaryHover : colors.dangerBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.reconStatusText,
                      { color: item.match_status === 'matched' ? colors.income : colors.expense },
                    ]}
                  >
                    {item.match_status}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
