import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchReceipts, saveReceipt, scanReceipt } from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { useSnackbar } from '../components/Snackbar';
import { EmptyState } from '../components/EmptyState';

interface Props {
  formatMoney: (value: string | number) => string;
}

interface GalleryReceipt {
  id: string;
  receipt_date?: string;
  store_name?: string;
  total_amount?: string | number;
  item_count?: number;
}

export function ReceiptsScreen({ formatMoney }: Props) {
  const { show: showSnackbar } = useSnackbar();
  const [qrData, setQrData] = useState('');
  const [parsed, setParsed] = useState<Record<string, string | null> | null>(null);
  const [gallery, setGallery] = useState<GalleryReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadGallery = useCallback(async () => {
    try {
      const res = await fetchReceipts();
      setGallery(res.items as GalleryReceipt[]);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  const parseQr = async () => {
    if (!qrData.trim()) return;
    setLoading(true);
    setParsed(null);
    try {
      const res = await scanReceipt(qrData);
      setParsed(res as Record<string, string | null>);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to parse QR');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!parsed || !parsed.total) return;
    setSaving(true);
    try {
      const res = await saveReceipt({
        store_name: parsed.store_name || 'Unknown Store',
        cnpj: parsed.cnpj ?? null,
        date: (parsed.date as string)?.split('T')[0] || new Date().toISOString().slice(0, 10),
        total: parsed.total,
        items: [{ description: 'Receipt', quantity: '1', total_price: parsed.total }],
      });
      showSnackbar(`✅ Receipt saved (${res.id.slice(0, 8)}…)`);
      await loadGallery();
      setParsed(null);
      setQrData('');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save receipt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Receipt Scanner</Text>
      </View>
      <Text style={styles.receiptHint}>
        Paste an NFC-e QR code to parse its receipt data (no OCR).
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scan NFC-e QR</Text>
        <TextInput
          style={styles.receiptQrInput}
          value={qrData}
          onChangeText={setQrData}
          placeholder="Paste the NFC-e QR code URL…"
          placeholderTextColor={colors.textDim}
          multiline
          numberOfLines={4}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />
        <TouchableOpacity
          style={[styles.submitButton, (!qrData.trim() || loading) && styles.submitButtonDisabled]}
          onPress={parseQr}
          disabled={!qrData.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.submitButtonText}>Scan QR</Text>
          )}
        </TouchableOpacity>
      </View>

      {parsed && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parsed Receipt</Text>
          <View style={styles.receiptFields}>
            <View style={styles.receiptField}>
              <Text style={styles.receiptFieldLabel}>Store</Text>
              <Text style={styles.receiptFieldValue}>{parsed.store_name || '—'}</Text>
            </View>
            <View style={styles.receiptField}>
              <Text style={styles.receiptFieldLabel}>Total</Text>
              <Text style={styles.receiptFieldValue}>{formatMoney(parsed.total || '0')}</Text>
            </View>
            <View style={styles.receiptField}>
              <Text style={styles.receiptFieldLabel}>Date</Text>
              <Text style={styles.receiptFieldValue}>{parsed.date || '—'}</Text>
            </View>
            <View style={styles.receiptField}>
              <Text style={styles.receiptFieldLabel}>CNPJ</Text>
              <Text style={styles.receiptFieldValue}>{parsed.cnpj || '—'}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.submitButton, saving && styles.submitButtonDisabled]}
            onPress={save}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={styles.submitButtonText}>Save Receipt</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gallery</Text>
        {gallery.length === 0 ? (
          <EmptyState
            compact
            icon="🧾"
            title="No receipts yet"
            description="Scan your first NFC-e QR code to start building a receipt history."
          />
        ) : (
          <View style={styles.receiptList}>
            {gallery.map((r) => (
              <View key={r.id} style={styles.receiptRow}>
                <View style={styles.receiptRowInfo}>
                  <Text style={styles.receiptRowStore}>{r.store_name || 'Unknown store'}</Text>
                  <Text style={styles.receiptRowDate}>
                    {r.receipt_date || '—'} · {r.item_count ?? 0} items
                  </Text>
                </View>
                <Text style={styles.receiptRowTotal}>
                  {r.total_amount != null ? formatMoney(r.total_amount) : '—'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

