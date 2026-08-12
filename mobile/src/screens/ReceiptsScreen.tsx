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
import * as ImagePicker from 'expo-image-picker';
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { fetchReceipts, saveReceipt, scanReceipt, scanReceiptOcr } from '../api';
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

interface ParsedReceipt {
  access_key?: string;
  total?: string;
  icms?: string;
  date?: string;
  cnpj?: string | null;
  store_name?: string;
  version?: string;
  items?: { description?: string; quantity?: string | null; unit_price?: string | null; total_price?: string | null }[];
}

interface EditableItem {
  description: string;
  quantity: string;
  unit_price: string;
  total_price: string;
}

export function ReceiptsScreen({ formatMoney }: Props) {
  const { show: showSnackbar } = useSnackbar();
  const [qrData, setQrData] = useState('');
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [reviewItems, setReviewItems] = useState<EditableItem[]>([]);
  const [gallery, setGallery] = useState<GalleryReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
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

  // Shared: populate the parsed receipt + review items from a structured scan.
  const applyParsedReceipt = (receipt: ParsedReceipt) => {
    setParsed(receipt);
    if (receipt.items && receipt.items.length > 0) {
      setReviewItems(
        receipt.items.map((i) => ({
          description: i.description ?? 'Item',
          quantity: i.quantity ?? '1',
          unit_price: i.unit_price ?? '',
          total_price: i.total_price ?? '',
        })),
      );
    } else {
      setReviewItems([
        { description: 'Receipt', quantity: '1', unit_price: '', total_price: receipt.total ?? '' },
      ]);
    }
  };

  const parseQr = async () => {
    if (!qrData.trim()) return;
    setLoading(true);
    setParsed(null);
    try {
      const res = await scanReceipt(qrData);
      applyParsedReceipt(res as ParsedReceipt);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to parse QR');
    } finally {
      setLoading(false);
    }
  };

  // Runs on-device OCR (ML Kit) on a photo, then parses the text via the backend.
  const handleOcr = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    const source =
      permission.granted || !permission.canAskAgain
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });

    if (source.canceled || !source.assets?.length) return;

    const uri = source.assets[0].uri;
    setOcrLoading(true);
    try {
      const result = await TextRecognition.recognize(uri, TextRecognitionScript.LATIN);
      const rawText = result.text;
      if (!rawText.trim()) {
        Alert.alert('OCR', 'No text recognized. Try a clearer, better-lit photo.');
        return;
      }
      const res = await scanReceiptOcr(rawText);
      applyParsedReceipt(res as ParsedReceipt);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'OCR failed');
    } finally {
      setOcrLoading(false);
    }
  };

  const updateReviewItem = (idx: number, patch: Partial<EditableItem>) => {
    setReviewItems((items) => items.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const save = async () => {
    if (!parsed || !parsed.total) return;
    setSaving(true);
    try {
      const items = reviewItems
        .filter((i) => i.description.trim().length > 0)
        .map((i) => ({
          description: i.description.trim(),
          quantity: i.quantity || '1',
          unit_price: i.unit_price || undefined,
          total_price: i.total_price || undefined,
        }));
      const res = await saveReceipt({
        store_name: parsed.store_name || 'Unknown Store',
        cnpj: parsed.cnpj ?? null,
        date: (parsed.date as string)?.split('T')[0] || new Date().toISOString().slice(0, 10),
        total: parsed.total,
        items: items.length > 0 ? items : [{ description: 'Receipt', quantity: '1', total_price: parsed.total }],
      });
      showSnackbar(`✅ Receipt saved with ${items.length} item(s) (${res.id.slice(0, 8)}…)`);
      await loadGallery();
      setParsed(null);
      setReviewItems([]);
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scan Receipt Photo (OCR)</Text>
        <Text style={styles.receiptHint}>
          No QR code handy? Take a photo of the receipt and the text will be read on-device.
        </Text>
        <TouchableOpacity
          style={[styles.submitButton, ocrLoading && styles.submitButtonDisabled]}
          onPress={handleOcr}
          disabled={ocrLoading}
        >
          {ocrLoading ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.submitButtonText}>📷 Read Receipt</Text>
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

          {reviewItems.length > 0 && (
            <View style={styles.receiptItemReview}>
              <Text style={styles.receiptItemTitle}>Items ({reviewItems.length}) — edit before saving</Text>
              {reviewItems.map((item, idx) => (
                <View key={idx} style={styles.receiptItemRow}>
                  <TextInput
                    style={[styles.receiptItemInput, styles.receiptItemDesc]}
                    value={item.description}
                    onChangeText={(v) => updateReviewItem(idx, { description: v })}
                    placeholder="Description"
                    placeholderTextColor={colors.textDim}
                  />
                  <TextInput
                    style={[styles.receiptItemInput, styles.receiptItemSmall]}
                    value={item.quantity}
                    onChangeText={(v) => updateReviewItem(idx, { quantity: v })}
                    placeholder="Qty"
                    placeholderTextColor={colors.textDim}
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={[styles.receiptItemInput, styles.receiptItemSmall]}
                    value={item.unit_price}
                    onChangeText={(v) => updateReviewItem(idx, { unit_price: v })}
                    placeholder="Unit"
                    placeholderTextColor={colors.textDim}
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={[styles.receiptItemInput, styles.receiptItemSmall]}
                    value={item.total_price}
                    onChangeText={(v) => updateReviewItem(idx, { total_price: v })}
                    placeholder="Total"
                    placeholderTextColor={colors.textDim}
                    keyboardType="decimal-pad"
                  />
                  <TouchableOpacity
                    style={styles.receiptItemRemove}
                    onPress={() => setReviewItems((items) => items.filter((_, i) => i !== idx))}
                  >
                    <Text style={styles.receiptItemRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={styles.receiptItemAdd}
                onPress={() =>
                  setReviewItems((items) => [
                    ...items,
                    { description: '', quantity: '1', unit_price: '', total_price: '' },
                  ])
                }
              >
                <Text style={styles.receiptItemAddText}>+ Add item</Text>
              </TouchableOpacity>
            </View>
          )}

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

