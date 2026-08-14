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
import { useI18n } from '../i18n';

interface Props {
  formatMoney: (value: string | number) => string;
}

export function LedgerScreen({ formatMoney }: Props) {
  const { show: showSnackbar } = useSnackbar();
  const { t } = useI18n();
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
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('ledger.failedLoad'));
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
      Alert.alert(t('common.validation'), t('ledger.validation.fill'));
      return;
    }
    if (debitAccountId === creditAccountId) {
      Alert.alert(t('common.validation'), t('ledger.validation.different'));
      return;
    }
    setSaving(true);
    try {
      await createLedgerTransaction({
        description: description.trim(),
        date: new Date().toISOString().slice(0, 10),
        entries: [
          { account_id: debitAccountId, debit_amount: String(amt), credit_amount: '0', description: t('ledger.debit') },
          { account_id: creditAccountId, debit_amount: '0', credit_amount: String(amt), description: t('ledger.credit') },
        ],
      });
      showSnackbar(t('ledger.created'));
      setShowForm(false);
      setDescription('');
      setDebitAccountId('');
      setCreditAccountId('');
      setAmount('');
      await load();
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('ledger.failedCreate'));
    } finally {
      setSaving(false);
    }
  };

  const handleMigrate = async () => {
    try {
      const res = await migrateSingleToDouble();
      showSnackbar(t('ledger.migrated', { migrated: res.migrated, total: res.total_processed }));
      await load();
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('ledger.migrationFailed'));
    }
  };

  return (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t('ledger.title')}</Text>
        <View style={styles.ledgerHeaderActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleMigrate}>
            <Text style={styles.secondaryButtonText}>{t('ledger.migrate')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
            <Text style={styles.addButtonText}>{t('ledger.newEntry')}</Text>
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
          title={t('ledger.noTitle')}
          description={t('ledger.noDesc')}
          actionLabel={t('ledger.newEntry')}
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
            <Text style={styles.modalTitle}>{t('ledger.form.title')}</Text>

            <Text style={styles.label}>{t('ledger.form.description')}</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder={t('ledger.form.descriptionPlaceholder')}
              placeholderTextColor={colors.textDim}
            />

            <Text style={styles.label}>{t('ledger.form.debit')}</Text>
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

            <Text style={styles.label}>{t('ledger.form.credit')}</Text>
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

            <Text style={styles.label}>{t('ledger.form.amount')}</Text>
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
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={handleCreate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <Text style={styles.submitButtonText}>{t('ledger.form.createEntry')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

