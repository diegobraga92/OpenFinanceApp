import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Category,
  MonthlyReportItem,
  Transaction,
  fetchMonthlyReport,
  fetchTransactions,
} from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { useI18n } from '../i18n';

/** Minimal account shape — works for both `AccountWithBalance` and `CardOverview`. */
export interface AccountLike {
  id: string;
  name: string;
  type?: string;
  account_kind?: string | null;
}

interface Props {
  account: AccountLike;
  categories: Category[];
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/** Number of months shown in the per-account monthly summary. */
const SUMMARY_MONTHS = 12;

export function AccountDetailScreen({ account, categories, onClose, onEdit, onDelete }: Props) {
  const { t, formatMoney, formatDate, monthNames } = useI18n();
  const [report, setReport] = useState<MonthlyReportItem[] | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - (SUMMARY_MONTHS - 1), 1);
        const [reportData, txData] = await Promise.all([
          fetchMonthlyReport(
            start.getFullYear(),
            start.getMonth() + 1,
            now.getFullYear(),
            now.getMonth() + 1,
            account.id,
          ),
          fetchTransactions({ account_id: account.id, page_size: 200 }),
        ]);
        if (cancelled) return;
        setReport(reportData.months);
        setTransactions(txData.items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('accounts.detail.failedLoad'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account.id, t]);

  // Report is chronological ascending; show newest month first.
  const monthsDesc = report ? [...report].reverse() : [];
  const hasActivity = report?.some(
    (m) => parseFloat(m.income_total) !== 0 || parseFloat(m.expense_total) !== 0,
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>
                {t('accounts.detail.title', { name: account.name })}
              </Text>
              <Text style={{ color: colors.textDim, fontSize: 12 }}>
                {t('accounts.detail.lastMonths', { count: SUMMARY_MONTHS })}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }} accessibilityLabel={t('common.close')}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
          ) : error ? (
            <Text style={styles.emptyText}>{error}</Text>
          ) : (
            <ScrollView style={styles.accountDetailScroll}>
              <Text style={styles.sectionTitle}>{t('accounts.detail.monthlySummary')}</Text>
              {!hasActivity ? (
                <Text style={styles.emptyText}>{t('accounts.detail.noMonthlyData')}</Text>
              ) : (
                <>
                  <View style={styles.accountDetailMonthHead}>
                    <Text style={styles.accountDetailMonthHeadMonth}>{t('reports.month')}</Text>
                    <Text style={styles.accountDetailMonthHeadCell}>{t('reports.income')}</Text>
                    <Text style={styles.accountDetailMonthHeadCell}>{t('reports.expenses')}</Text>
                    <Text style={styles.accountDetailMonthHeadCell}>{t('reports.netShort')}</Text>
                  </View>
                  {monthsDesc.map((m) => (
                    <View key={`${m.year}-${m.month}`} style={styles.accountDetailMonthRow}>
                      <Text style={styles.accountDetailMonth}>
                        {monthNames[m.month - 1]} {m.year}
                      </Text>
                      <Text style={styles.accountDetailMonthCell}>
                        {formatMoney(m.income_total)}
                      </Text>
                      <Text style={[styles.accountDetailMonthCell, { color: colors.expense }]}>
                        {formatMoney(m.expense_total)}
                      </Text>
                      <Text
                        style={[
                          styles.accountDetailNet,
                          { color: Number(m.balance) >= 0 ? colors.income : colors.expense },
                        ]}
                      >
                        {formatMoney(m.balance)}
                      </Text>
                    </View>
                  ))}
                </>
              )}

              <View style={styles.accountDetailSection}>
                <Text style={styles.sectionTitle}>{t('accounts.detail.transactions')}</Text>
                {transactions.length === 0 ? (
                  <Text style={styles.emptyText}>{t('accounts.detail.noTransactions')}</Text>
                ) : (
                  transactions.map((tx) => {
                    const cat = tx.category_id ? categoryById.get(tx.category_id) : undefined;
                    const isIncome = tx.type === 'income';
                    return (
                      <View key={tx.id} style={styles.accountDetailTxRow}>
                        <Text style={styles.accountDetailTxDate}>{formatDate(tx.date)}</Text>
                        <View style={styles.accountDetailTxInfo}>
                          <Text style={styles.accountDetailTxDesc}>{tx.description}</Text>
                          <Text style={styles.accountDetailTxMeta}>
                            {cat?.name || t('common.uncategorised')}
                          </Text>
                        </View>
                        <Text
                          style={{
                            color: isIncome ? colors.income : colors.expense,
                            fontSize: 13,
                            fontWeight: '600',
                          }}
                        >
                          {isIncome ? '+' : '-'}
                          {formatMoney(tx.amount)}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
          )}

          {(onEdit || onDelete) && (
            <View style={styles.accountDetailActions}>
              {onEdit && (
                <TouchableOpacity
                  style={[styles.secondaryButton, { flex: 1 }]}
                  onPress={onEdit}
                >
                  <Text style={styles.secondaryButtonText}>{t('common.edit')}</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    { flex: 1, borderColor: colors.dangerBorder },
                  ]}
                  onPress={onDelete}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>
                    {t('common.delete')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

