import React, { type ReactNode } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Category, SummaryResponse, Transaction } from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { MONTHS } from '../theme/constants';
import { TransactionRow } from '../components/TransactionRow';

interface Props {
  summary: SummaryResponse | null;
  categories: Category[];
  transactions: Transaction[];
  formatMoney: (value: string | number) => string;
  refreshControl?: ReactNode;
  onAddTransaction: () => void;
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
  onEdit,
  onDelete,
}: Props) {
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <ScrollView style={styles.content} refreshControl={refreshControl as never}>
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceMonth}>
            {MONTHS[new Date().getMonth()]} {new Date().getFullYear()}
          </Text>
        </View>
        <Text style={[styles.balanceValue, { color: parseFloat(summary?.balance || '0') < 0 ? colors.expense : colors.income }]}>
          {formatMoney(summary?.balance || '0')}
        </Text>
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>Income</Text>
            <Text style={[styles.balanceItemValue, { color: colors.income }]}>
              {formatMoney(summary?.income_total || '0')}
            </Text>
          </View>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>Expenses</Text>
            <Text style={[styles.balanceItemValue, { color: colors.expense }]}>
              {formatMoney(summary?.expense_total || '0')}
            </Text>
          </View>
        </View>
      </View>

      {summary && summary.by_category.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Breakdown</Text>
          {summary.by_category.slice(0, 5).map((cat) => (
            <View key={cat.category_id || 'none'} style={styles.categoryRow}>
              <View style={styles.categoryLabelRow}>
                <Text style={styles.categoryName}>
                  {cat.icon ? `${cat.icon} ` : ''}{cat.category_name || 'Uncategorised'}
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        {transactions.length === 0 ? (
          <View style={styles.dashboardEmpty}>
            <Text style={styles.dashboardEmptyIcon}>💸</Text>
            <Text style={styles.dashboardEmptyTitle}>No transactions yet</Text>
            <Text style={styles.dashboardEmptyDesc}>
              Add your first income or expense to start tracking your money.
            </Text>
            <TouchableOpacity style={styles.addButton} onPress={onAddTransaction}>
              <Text style={styles.addButtonText}>+ Add Transaction</Text>
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
