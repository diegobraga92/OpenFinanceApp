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
import { useI18n } from '../i18n';
import { styles } from '../theme/styles';

interface Props {
  formatMoney: (value: string | number) => string;
}

export function ReconciliationScreen({ formatMoney }: Props) {
  const { t } = useI18n();
  const [reconStatementName, setReconStatementName] = useState('');
  const [reconCsv, setReconCsv] = useState('');
  const [reconResult, setReconResult] = useState<ReconciliationUploadResponse | null>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconError, setReconError] = useState<string | null>(null);

  const handleReconSubmit = async () => {
    setReconError(null);
    setReconResult(null);
    if (!reconCsv.trim()) {
      setReconError(t('recon.validation.csvRequired'));
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
        setReconError(t('recon.validation.mobileEmpty'));
        return;
      }

      const res = await uploadReconciliation({
        statement_name: reconStatementName.trim() || t('recon.bankStatement'),
        lines: rows,
      });
      setReconResult(res);
    } catch (err) {
      setReconError(err instanceof Error ? err.message : t('recon.failedUpload'));
    } finally {
      setReconLoading(false);
    }
  };

  return (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t('recon.title')}</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>{t('recon.uploadReconcile')}</Text>

        <Text style={styles.label}>{t('recon.statementName')}</Text>
        <TextInput
          style={styles.input}
          value={reconStatementName}
          onChangeText={setReconStatementName}
          placeholder={t('recon.bankStatement')}
          placeholderTextColor={colors.textDim}
        />

        <Text style={styles.label}>{t('recon.csvData')} (date,description,amount)</Text>
        <TextInput
          style={styles.reconCsvInput}
          value={reconCsv}
          onChangeText={setReconCsv}
          placeholder={t('recon.csvPlaceholderMobile')}
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
            <Text style={styles.submitButtonText}>{t('recon.uploadReconcile')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {reconResult && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{t('recon.results')}</Text>
          <View style={styles.reconSummaryRow}>
            <View style={styles.reconSummaryItem}>
              <Text style={styles.reconSummaryLabel}>{t('common.total')}</Text>
              <Text style={styles.reconSummaryValue}>{reconResult.total_rows}</Text>
            </View>
            <View style={styles.reconSummaryItem}>
              <Text style={[styles.reconSummaryLabel, { color: colors.income }]}>{t('recon.matched')}</Text>
              <Text style={[styles.reconSummaryValue, { color: colors.income }]}>{reconResult.matched_rows}</Text>
            </View>
            <View style={styles.reconSummaryItem}>
              <Text style={[styles.reconSummaryLabel, { color: colors.expense }]}>{t('recon.unmatched')}</Text>
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
