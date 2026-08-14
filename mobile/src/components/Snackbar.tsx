import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/tokens';
import { useI18n } from '../i18n';

interface SnackbarItem {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface SnackbarContextValue {
  show: (message: string, actionLabel?: string, onAction?: () => void) => void;
}

const SnackbarContext = createContext<SnackbarContextValue | undefined>(undefined);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [item, setItem] = useState<SnackbarItem | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setItem(null);
  }, []);

  const show = useCallback((message: string, actionLabel?: string, onAction?: () => void) => {
    const id = ++idRef.current;
    setItem({ id, message, actionLabel, onAction });
    if (timerRef.current) clearTimeout(timerRef.current);
    // Actions (e.g. Undo) get a slightly longer window.
    timerRef.current = setTimeout(() => {
      setItem((cur) => (cur?.id === id ? null : cur));
    }, onAction ? 6000 : 3500);
  }, []);

  return (
    <SnackbarContext.Provider value={{ show }}>
      <View style={styles.wrapper}>
        {children}
        {item && (
          <View style={styles.host} pointerEvents="box-none">
            <View style={styles.snackbar} accessibilityRole="alert">
              <Text style={styles.message} numberOfLines={2}>
                {item.message}
              </Text>
              {item.actionLabel && item.onAction && (
                <TouchableOpacity
                  style={styles.action}
                  onPress={() => {
                    item.onAction?.();
                    dismiss();
                  }}
                >
                  <Text style={styles.actionText}>{item.actionLabel}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.dismiss} onPress={dismiss} accessibilityLabel={t('toast.dismiss')}>
                <Text style={styles.dismissText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used within a SnackbarProvider');
  return ctx;
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  host: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 88,
    alignItems: 'center',
    zIndex: 1000,
  },
  snackbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceHover,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: 480,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  message: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  action: {
    marginLeft: 12,
  },
  actionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  dismiss: {
    marginLeft: 10,
    padding: 2,
  },
  dismissText: {
    color: colors.textDim,
    fontSize: 12,
  },
});
