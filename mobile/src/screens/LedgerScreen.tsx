import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AccountWithBalance,
  LedgerTransaction,
  createLedgerTransaction,
  fetchAccountsWithBalance,
  fetchLedgerTransactions,
  migrateSingleToDouble,
} from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { useSnackbar } from '../components/Snackbar';
import { EmptyState } from '../components/EmptyState';

interface Props {
  formatMoney: (value: string | number) => string;
}

export function LedgerScreen({ formatMoney }: Props) {
  const { show: showSnackbar } = useSnackbar();
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [amount, setAmount] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [txns, accts] = await Promise.all([
        fetchLedgerTransactions(),
        fetchAccountsWithBalance(),
      ]);
      setTransactions(txns);
      setAccounts(accts);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    const amt = parseFloat(amount);
    if (!description.trim() || !debitAccountId || !creditAccountId || !(amt > 0)) {
      Alert.alert('Validation', 'Fill in description, both accounts and a positive amount');
      return;
    }
    if (debitAccountId === creditAccountId) {
      Alert.alert('Validation', 'Debit and credit accounts must be different');
      return;
    }
    setSaving(true);
    try {
      await createLedgerTransaction({
        description: description.trim(),
        date: new Date().toISOString().slice(0, 10),
        entries: [
          { account_id: debitAccountId, debit_amount: String(amt), credit_amount: '0', description: 'Debit' },
          { account_id: creditAccountId, debit_amount: '0', credit_amount: String(amt), description: 'Credit' },
        ],
      });
      showSnackbar('✅ Ledger transaction created');
      setShowForm(false);
      setDescription('');
      setDebitAccountId('');
      setCreditAccountId('');
      setAmount('');
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleMigrate = async () => {
    try {
      const res = await migrateSingleToDouble();
      showSnackbar(`✅ Migrated ${res.migrated} of ${res.total_processed}`);
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Migration failed');
    }
  };

  return (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Ledger</Text>
        <View style={styles.ledgerHeaderActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleMigrate}>
            <Text style={styles.secondaryButtonText}>Migrate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
            <Text style={styles.addButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : transactions.length === 0 ? (
        <EmptyState
          compact
          icon="📒"
          title="No ledger transactions yet"
          description="Double-entry transactions keep a balanced, immutable record of every movement."
          actionLabel="+ New Ledger Entry"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <View style={styles.ledgerList}>
          {transactions.map((t) => (
            <View key={t.transaction_id} style={styles.ledgerCard}>
              <View style={styles.ledgerCardHeader}>
                <Text style={styles.ledgerCardDescription}>{t.description}</Text>
                <Text style={styles.ledgerCardDate}>{t.date}</Text>
              </View>
              {t.entries.map((en) => (
                <View key={en.id} style={styles.ledgerEntry}>
                  <Text style={styles.ledgerEntryAccount}>
                    {en.account_name || en.account_id.slice(0, 8)}
                  </Text>
                  {parseFloat(en.debit_amount) > 0 ? (
                    <Text style={styles.ledgerEntryDebit}>DR {formatMoney(en.debit_amount)}</Text>
                  ) : (
                    <Text style={styles.ledgerEntryCredit}>CR {formatMoney(en.credit_amount)}</Text>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      <Modal
        visible={showForm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Ledger Transaction</Text>

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Groceries at Supermarket X"
              placeholderTextColor={colors.textDim}
            />

            <Text style={styles.label}>Debit account</Text>
            <View style={styles.ledgerAccountPicker}>
              {accounts.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.ledgerAccountChip,
                    debitAccountId === a.id && styles.ledgerAccountChipActive,
                  ]}
                  onPress={() => setDebitAccountId(a.id)}
                >
                  <Text
                    style={[
                      styles.ledgerAccountChipText,
                      debitAccountId === a.id && styles.ledgerAccountChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {a.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Credit account</Text>
            <View style={styles.ledgerAccountPicker}>
              {accounts.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.ledgerAccountChip,
                    creditAccountId === a.id && styles.ledgerAccountChipActive,
                  ]}
                  onPress={() => setCreditAccountId(a.id)}
                >
                  <Text
                    style={[
                      styles.ledgerAccountChipText,
                      creditAccountId === a.id && styles.ledgerAccountChipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {a.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Amount (R$)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.textDim}
              keyboardType="decimal-pad"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowForm(false)}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={handleCreate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <Text style={styles.submitButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

