import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Category, Transaction } from '../api';
import { colors } from '../theme/tokens';
import { useI18n } from '../i18n';
import { styles } from '../theme/styles';
import { categoryIcon } from '../../../shared/category-icons';

interface Props {
  transaction: Transaction;
  /** Resolved category for the transaction (undefined if uncategorised). */
  category?: Category;
  formatMoney: (value: string | number) => string;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}

export function TransactionRow({
  transaction: t,
  category: cat,
  formatMoney,
  onEdit,
  onDelete,
}: Props) {
  const { t: tr } = useI18n();
  const isIncome = t.type === 'income';
  return (
    <View style={styles.transactionRow}>
      <View style={styles.transactionLeft}>
        {cat && (
          <View style={[styles.categoryIconCircle, { backgroundColor: cat.color || colors.surfaceHover }]}>
            <Text style={styles.categoryIconText}>{categoryIcon(cat.icon)}</Text>
          </View>
        )}
        <View style={styles.transactionInfo}>
          <View style={styles.transactionDescriptionRow}>
            <Text style={styles.transactionDescription}>{t.description}</Text>
            {t.installment_plan_id && (
              <View style={styles.installmentTag}>
                <Text style={styles.installmentTagText}>{tr('transactions.installment')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.transactionMeta}>
            {cat?.name || tr('common.uncategorised')} • {t.date}
          </Text>
        </View>
      </View>
      <View>
        <Text style={[styles.transactionAmount, { color: isIncome ? colors.income : colors.expense }]}>
          {isIncome ? '+' : '-'}{formatMoney(t.amount)}
        </Text>
      </View>
      <View style={styles.transactionActions}>
        <TouchableOpacity onPress={() => onEdit(t)} style={styles.editButton}>
          <Text style={styles.editButtonText}>{tr('transactions.edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete(t)} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>{tr('transactions.del')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
