import React, { type ReactNode } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Category, SummaryResponse, Transaction } from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { useI18n } from '../i18n';
import { TransactionRow } from '../components/TransactionRow';
import { QuickAddWidget } from '../components/QuickAddWidget';
import { categoryIcon } from '../../../shared/category-icons';

interface Props {
  summary: SummaryResponse | null;
  categories: Category[];
  transactions: Transaction[];
  formatMoney: (value: string | number) => string;
  refreshControl?: ReactNode;
  onAddTransaction: () => void;
  onQuickSaved: () => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}

export function DashboardScreen({
  summary,
  categories,
  transactions,
  formatMoney,
  refreshControl,
  onAddTransaction,
  onQuickSaved,
  onEdit,
  onDelete,
}: Props) {
  const { t, monthNames } = useI18n();
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <ScrollView style={styles.content} refreshControl={refreshControl as never}>
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>{t('dashboard.currentBalance')}</Text>
          <Text style={styles.balanceMonth}>
            {monthNames[new Date().getMonth()]} {new Date().getFullYear()}
          </Text>
        </View>
        <Text style={[styles.balanceValue, { color: parseFloat(summary?.balance || '0') < 0 ? colors.expense : colors.income }]}>
          {formatMoney(summary?.balance || '0')}
        </Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>{t('common.income')}</Text>
            <Text style={[styles.balanceItemValue, { color: colors.income }]}>
              {formatMoney(summary?.income_total || '0')}
            </Text>
          </View>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>{t('common.expenses')}</Text>
            <Text style={[styles.balanceItemValue, { color: colors.expense }]}>
              {formatMoney(summary?.expense_total || '0')}
            </Text>
          </View>
        </View>
      </View>

      <QuickAddWidget
        types={['expense']}
        showTodayTotal
        transactions={transactions}
        formatMoney={formatMoney}
        onSaved={onQuickSaved}
      />

      {summary && summary.by_category.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard.categoryBreakdown')}</Text>
          {summary.by_category.slice(0, 5).map((cat) => (
            <View key={cat.category_id || 'none'} style={styles.categoryRow}>
              <View style={styles.categoryLabelRow}>
                <Text style={styles.categoryName}>
                  {cat.icon ? `${categoryIcon(cat.icon)} ` : ''}{cat.category_name || t('common.uncategorised')}
                </Text>
                <Text style={styles.categoryTotal}>{formatMoney(cat.total)}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, (parseFloat(cat.total) / Math.max(parseFloat(summary.income_total), parseFloat(summary.expense_total), 1)) * 100)}%`,
                    backgroundColor: cat.color || '#6366f1',
                  },
                ]} />
              </View>
            </View>
          ))}
        </View>
      )}

      <QuickAddWidget
        types={['expense', 'income']}
        transactions={transactions}
        formatMoney={formatMoney}
        onSaved={onQuickSaved}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('dashboard.recentTransactions')}</Text>
        {transactions.length === 0 ? (
          <View style={styles.dashboardEmpty}>
            <Text style={styles.dashboardEmptyIcon}>💸</Text>
            <Text style={styles.dashboardEmptyTitle}>{t('dashboard.noTransactionsTitle')}</Text>
            <Text style={styles.dashboardEmptyDesc}>
              {t('dashboard.noTransactionsDesc')}
            </Text>
            <TouchableOpacity style={styles.addButton} onPress={onAddTransaction}>
              <Text style={styles.addButtonText}>{t('dashboard.addTransaction')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          transactions.slice(0, 5).map((t) => (
            <TransactionRow
              key={t.id}
              transaction={t}
              category={t.category_id ? categoryById.get(t.category_id) : undefined}
              formatMoney={formatMoney}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}
