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
import { Category, createTransaction, fetchCategories } from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { useSnackbar } from '../components/Snackbar';
import { useI18n } from '../i18n';
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
  const { t } = useI18n();
  const [pending, setPending] = useState<ParsedTransaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState('');
  /** Auto-completed category from the notification; user can change it. */
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const settingsRef = useRef<NotificationSettings | null>(null);

  const persistTransaction = useCallback(
    async (
      parsed: ParsedTransaction,
      overrideDescription?: string,
      overrideCategoryId?: string | null,
    ) => {
      await createTransaction({
        description: overrideDescription ?? parsed.description,
        amount: parsed.amount,
        type: parsed.type,
        category_id: overrideCategoryId ?? parsed.categoryId,
        date: parsed.date,
        notes: t('notifications.notes'),
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
              t('notifications.captured', { type: t(parsed.type === 'income' ? 'notifications.income' : 'notifications.expense'), amount: parsed.amount, description: parsed.description }),
            );
          })
          .catch((err: unknown) => {
            showSnackbar(
              err instanceof Error ? `Capture failed: ${err.message}` : t('notifications.captureFailed'),
            );
          });
      } else {
        setDescription(parsed.description);
        setPendingCategoryId(parsed.categoryId);
        setPending(parsed);
        // Categories drive the category picker in the confirmation modal.
        void fetchCategories()
          .then(setCategories)
          .catch(() => {});
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
      await persistTransaction(pending, description.trim() || undefined, pendingCategoryId);
      showSnackbar(t('notifications.created', { amount: pending.amount }));
      setPending(null);
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('notifications.failedCreate'));
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
            <Text style={styles.modalTitle}>{t('notifications.captureTitle')}</Text>
            <Text style={styles.monthPreview}>
              {t('notifications.captureDesc', { type: t(pending?.type === 'income' ? 'notifications.income' : 'notifications.expense'), amount: pending?.amount ?? '', description: pending?.description ?? '' })}
            </Text>

            <Text style={styles.label}>{t('notifications.description')}</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder={t('notifications.descriptionPlaceholder')}
              placeholderTextColor={colors.textDim}
              autoFocus
            />

            <Text style={styles.label}>{t('common.category')}</Text>
            <View style={styles.categoryGrid}>
              <TouchableOpacity
                style={[styles.categoryChip, pendingCategoryId === null && styles.categoryChipActive]}
                onPress={() => setPendingCategoryId(null)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    pendingCategoryId === null && styles.categoryChipTextActive,
                  ]}
                >
                  {t('common.none')}
                </Text>
              </TouchableOpacity>
              {categories
                .filter((c) => c.type === pending?.type)
                .map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.categoryChip,
                      pendingCategoryId === c.id && styles.categoryChipActive,
                    ]}
                    onPress={() => setPendingCategoryId(c.id)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        pendingCategoryId === c.id && styles.categoryChipTextActive,
                      ]}
                    >
                      {c.icon ? `${c.icon} ` : ''}{c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setPending(null)}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>{t('notifications.skip')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={confirm}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <Text style={styles.submitButtonText}>{t('notifications.create')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </NotificationCaptureContext.Provider>
  );
}
