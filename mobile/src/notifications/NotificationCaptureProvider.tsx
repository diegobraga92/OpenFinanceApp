import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { createTransaction } from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { useSnackbar } from '../components/Snackbar';
import {
  NotificationSettings,
  ParsedTransaction,
  getNotificationSettings,
  subscribeToNotifications,
} from './capture';

interface NotificationCaptureContextValue {
  refresh: () => Promise<void>;
}

const NotificationCaptureContext =
  createContext<NotificationCaptureContextValue | null>(null);

export function useNotificationCapture(): NotificationCaptureContextValue {
  const ctx = useContext(NotificationCaptureContext);
  if (!ctx) throw new Error('useNotificationCapture requires NotificationCaptureProvider');
  return ctx;
}

export function NotificationCaptureProvider({ children }: { children: ReactNode }) {
  const { show: showSnackbar } = useSnackbar();
  const [pending, setPending] = useState<ParsedTransaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState('');
  const settingsRef = useRef<NotificationSettings | null>(null);

  const persistTransaction = useCallback(
    async (parsed: ParsedTransaction, overrideDescription?: string) => {
      await createTransaction({
        description: overrideDescription ?? parsed.description,
        amount: parsed.amount,
        type: parsed.type,
        category_id: parsed.categoryId,
        date: parsed.date,
        notes: 'Captured from push notification',
      });
    },
    [],
  );

  const handleParsed = useCallback(
    (parsed: ParsedTransaction) => {
      const settings = settingsRef.current;
      if (!settings) return;
      if (settings.mode === 'auto') {
        void persistTransaction(parsed)
          .then(() => {
            showSnackbar(
              `✅ ${parsed.type === 'income' ? 'Income' : 'Expense'} R$ ${parsed.amount} — ${parsed.description}`,
            );
          })
          .catch((err: unknown) => {
            showSnackbar(
              err instanceof Error ? `Capture failed: ${err.message}` : 'Capture failed',
            );
          });
      } else {
        setDescription(parsed.description);
        setPending(parsed);
      }
    },
    [persistTransaction, showSnackbar],
  );

  useEffect(() => {
    void (async () => {
      settingsRef.current = await getNotificationSettings();
    })();
    const unsubscribe = subscribeToNotifications(handleParsed);
    return unsubscribe;
  }, [handleParsed]);

  const refresh = useCallback(async () => {
    settingsRef.current = await getNotificationSettings();
  }, []);

  const confirm = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      await persistTransaction(pending, description.trim() || undefined);
      showSnackbar(`✅ Transaction R$ ${pending.amount} created`);
      setPending(null);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create transaction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <NotificationCaptureContext.Provider value={{ refresh }}>
      {children}
      <Modal
        visible={pending !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPending(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Capture transaction?</Text>
            <Text style={styles.monthPreview}>
              A notification was detected: {pending?.type === 'income' ? 'income' : 'expense'} of
              R$ {pending?.amount} from "{pending?.description}".
            </Text>

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Merchant / description"
              placeholderTextColor={colors.textDim}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setPending(null)}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={confirm}
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
    </NotificationCaptureContext.Provider>
  );
}
