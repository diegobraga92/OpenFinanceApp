import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  CategoryBreakdownResponse,
  MonthlyReportResponse,
  fetchCategoryBreakdown,
  fetchMonthlyReport,
} from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { SHORT_MONTHS } from '../theme/constants';
import { DonutChart } from '../components/DonutChart';
import { TrendChart } from '../components/TrendChart';
import { useSnackbar } from '../components/Snackbar';

interface Props {
  formatMoney: (value: string | number) => string;
}

export function ReportsScreen({ formatMoney }: Props) {
  const { show: showSnackbar } = useSnackbar();
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReportResponse | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      const now = new Date();
      const endMonth = now.getMonth() + 1;
      const endYear = now.getFullYear();
      let startMonth = endMonth - 5;
      let startYear = endYear;
      if (startMonth <= 0) {
        startYear -= 1;
        startMonth += 12;
      }
      const [monthly, breakdown] = await Promise.all([
        fetchMonthlyReport(startYear, startMonth, endYear, endMonth),
        fetchCategoryBreakdown(
          new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
          now.toISOString().slice(0, 10),
        ),
      ]);
      setMonthlyReport(monthly);
      setCategoryBreakdown(breakdown);
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : 'Failed to load reports');
    }
  }, [showSnackbar]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadReports();
    } finally {
      setRefreshing(false);
    }
  }, [loadReports]);

  const totalIncome = (monthlyReport?.months ?? []).reduce((s, m) => s + parseFloat(m.income_total), 0);
  const totalExpense = (monthlyReport?.months ?? []).reduce((s, m) => s + parseFloat(m.expense_total), 0);
  const net = totalIncome - totalExpense;
  const chartWidth = Dimensions.get('window').width - 64;

  const donutData = (categoryBreakdown?.categories ?? [])
    .slice(0, 6)
    .map((c) => ({
      label: c.category_name || 'Uncategorised',
      value: parseFloat(c.total),
      color: c.color || '#6366f1',
    }));
  const totalSpent = donutData.reduce((s, d) => s + d.value, 0);

  const trendData = (monthlyReport?.months ?? []).map((m) => ({
    label: `${SHORT_MONTHS[m.month - 1]}/${String(m.year).slice(2)}`,
    income: parseFloat(m.income_total),
    expense: parseFloat(m.expense_total),
  }));

  const maxBreakdown = Math.max(
    1,
    ...(categoryBreakdown?.categories ?? []).slice(0, 8).map((c) => parseFloat(c.percentage)),
  );

  return (
    <ScrollView
      style={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.textMuted}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surface}
        />
      }
    >
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Reports</Text>
      </View>

      <View style={styles.overviewCards}>
        <View style={styles.overviewCard}>
          <Text style={styles.overviewLabel}>Income</Text>
          <Text style={[styles.overviewValue, { color: colors.income }]}>{formatMoney(totalIncome)}</Text>
        </View>
        <View style={styles.overviewCard}>
          <Text style={styles.overviewLabel}>Expenses</Text>
          <Text style={[styles.overviewValue, { color: colors.expense }]}>{formatMoney(totalExpense)}</Text>
        </View>
        <View style={styles.overviewCard}>
          <Text style={styles.overviewLabel}>Net</Text>
          <Text style={[styles.overviewValue, { color: net >= 0 ? colors.income : colors.expense }]}>{formatMoney(net)}</Text>
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Category Spending (This Month)</Text>
        {(categoryBreakdown?.categories ?? []).length === 0 ? (
          <Text style={styles.emptyText}>No expenses this month.</Text>
        ) : (
          <>
            <View style={styles.chartArea}>
              <DonutChart
                data={donutData}
                centerValue={formatMoney(totalSpent)}
                centerLabel="Spent"
              />
            </View>
            <View style={styles.donutLegend}>
              {donutData.map((d) => (
                <View key={d.label} style={styles.legendRow}>
                  <View style={[styles.legendSwatch, { backgroundColor: d.color }]} />
                  <Text style={styles.legendLabel} numberOfLines={1}>
                    {d.label}
                  </Text>
                  <Text style={styles.legendValue}>
                    {totalSpent > 0 ? `${Math.round((d.value / totalSpent) * 100)}%` : '0%'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
        {(categoryBreakdown?.categories ?? []).length > 0 && (
          (categoryBreakdown?.categories ?? []).slice(0, 8).map((c) => (
            <View key={c.category_id || 'none'} style={styles.categoryRow}>
              <View style={styles.categoryLabelRow}>
                <Text style={styles.categoryName}>
                  {c.icon ? `${c.icon} ` : ''}{c.category_name || 'Uncategorised'}
                </Text>
                <Text style={styles.categoryTotal}>
                  {formatMoney(c.total)} ({Math.round(parseFloat(c.percentage))}%)
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[
                  styles.progressFill,
                  {
                    width: `${(parseFloat(c.percentage) / maxBreakdown) * 100}%`,
                    backgroundColor: c.color || '#6366f1',
                  },
                ]} />
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Monthly Income vs Expenses</Text>
        {(monthlyReport?.months ?? []).length === 0 ? (
          <Text style={styles.emptyText}>No monthly data yet.</Text>
        ) : (
          <>
            <View style={styles.chartArea}>
              <TrendChart data={trendData} width={chartWidth} formatValue={formatMoney} />
            </View>
            {(monthlyReport?.months ?? []).map((m) => {
              const income = parseFloat(m.income_total);
              const expense = parseFloat(m.expense_total);
              return (
                <View key={`${m.year}-${m.month}`} style={styles.trendRow}>
                  <Text style={styles.trendLabel}>
                    {SHORT_MONTHS[m.month - 1]} {String(m.year).slice(2)}
                  </Text>
                  <View style={styles.trendValues}>
                    <Text style={styles.trendIncomeText}>+{formatMoney(income)}</Text>
                    <Text style={styles.trendExpenseText}>-{formatMoney(expense)}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </View>
    </ScrollView>
  );
}
