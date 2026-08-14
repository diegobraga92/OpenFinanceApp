import React, { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Category, Transaction } from '../api';
import { colors } from '../theme/tokens';
import { useI18n } from '../i18n';
import { styles } from '../theme/styles';
import { TransactionRow } from '../components/TransactionRow';

interface Props {
  transactions: Transaction[];
  categories: Category[];
  formatMoney: (value: string | number) => string;
  refreshControl?: ReactNode;
  onAdd: () => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}

export function TransactionsScreen({
  transactions,
  categories,
  formatMoney,
  refreshControl,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((t) => {
      if (t.description.toLowerCase().includes(q)) return true;
      const cat = t.category_id ? categoryById.get(t.category_id) : undefined;
      return (cat?.name.toLowerCase().includes(q) ?? false) || (cat?.icon?.toLowerCase().includes(q) ?? false);
    });
  }, [transactions, searchQuery, categoryById]);

  return (
    <View style={styles.content}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t('transactions.title')}</Text>
        <TouchableOpacity style={styles.addButton} onPress={onAdd}>
          <Text style={styles.addButtonText}>{t('transactions.addShort')}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('transactions.search')}
          placeholderTextColor={colors.textDim}
          clearButtonMode="while-editing"
          accessibilityLabel={t('transactions.searchAria')}
        />
      </View>
      {transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('transactions.noTitle')}</Text>
          <TouchableOpacity style={styles.addButton} onPress={onAdd}>
            <Text style={styles.addButtonText}>{t('transactions.firstOne')}</Text>
          </TouchableOpacity>
        </View>
      ) : filteredTransactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('transactions.noMatchesMobile', { query: searchQuery })}</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setSearchQuery('')}>
            <Text style={styles.addButtonText}>{t('common.clearSearch')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TransactionRow
              transaction={item}
              category={item.category_id ? categoryById.get(item.category_id) : undefined}
              formatMoney={formatMoney}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={refreshControl as never}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}
