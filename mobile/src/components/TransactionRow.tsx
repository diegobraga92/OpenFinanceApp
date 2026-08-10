import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Category, Transaction } from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';

interface Props {
  transaction: Transaction;
  /** Resolved category for the transaction (undefined if uncategorised). */
  category?: Category;
  formatMoney: (value: string | number) => string;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
}

export function TransactionRow({
  transaction: t,
  category: cat,
  formatMoney,
  onEdit,
  onDelete,
}: Props) {
  const isIncome = t.type === 'income';
  return (
    <View style={styles.transactionRow}>
      <View style={styles.transactionLeft}>
        {cat && (
          <View style={[styles.categoryIconCircle, { backgroundColor: cat.color || colors.surfaceHover }]}>
            <Text style={styles.categoryIconText}>{cat.icon || '•'}</Text>
          </View>
        )}
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDescription}>{t.description}</Text>
          <Text style={styles.transactionMeta}>
            {cat?.name || 'Uncategorised'} • {t.date}
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
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete(t.id)} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Del</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
