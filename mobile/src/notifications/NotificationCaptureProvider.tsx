import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createTransaction, undoTransaction } from '../api';
import { useSnackbar } from '../components/Snackbar';
import { useI18n } from '../i18n';
import type { NotificationPayload } from '../../modules/notification-listener';
import {
  addPendingCapture,
  dedupKeyOf,
  drainPendingNotifications,
  getNotificationSettings,
  getPendingCaptures,
  removePendingCapture,
  subscribeToNotifications,
  toPendingCapture,
  type NotificationSettings,
  type ParsedTransaction,
  type PendingCapture,
} from './capture';

/** How long a "just imported" capture stays suppressed to avoid double-imports. */
const DEDUP_WINDOW_MS = 30_000;

interface NotificationCaptureContextValue {
  /** Number of captured transactions waiting for review (ask mode). */
  pendingCount: number;
  pendingItems: PendingCapture[];
  refresh: () => Promise<void>;
  approve: (
    id: string,
    overrides?: { description?: string; amount?: string; categoryId?: string | null },
  ) => Promise<void>;
  approveAll: () => Promise<void>;
  skip: (id: string) => Promise<void>;
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
  const [pendingItems, setPendingItems] = useState<PendingCapture[]>([]);
  const settingsRef = useRef<NotificationSettings | null>(null);
  const recentImportsRef = useRef<Map<string, number>>(new Map());
  // Keep the latest snackbar/i18n in refs so long-lived async callbacks stay fresh.
  const showSnackbarRef = useRef(showSnackbar);
  showSnackbarRef.current = showSnackbar;
  const tRef = useRef(t);
  tRef.current = t;

  const refresh = useCallback(async () => {
    settingsRef.current = await getNotificationSettings();
    setPendingItems(await getPendingCaptures());
  }, []);

  const persistTransaction = useCallback(
    async (parsed: ParsedTransaction, categoryId: string | null) =>
      createTransaction({
        description: parsed.description,
        amount: parsed.amount,
        type: parsed.type,
        category_id: categoryId,
        date: parsed.date,
        notes: tRef.current('notifications.notes'),
      }),
    [],
  );

  const handleParsed = useCallback(
    (parsed: ParsedTransaction, payload: NotificationPayload) => {
      const settings = settingsRef.current;
      if (!settings) return;

      if (settings.mode === 'auto') {
        // Dedup: don't import the same transaction twice within a short window.
        const key = dedupKeyOf(parsed);
        const last = recentImportsRef.current.get(key);
        if (last !== undefined && Date.now() - last < DEDUP_WINDOW_MS) return;
        recentImportsRef.current.set(key, Date.now());

        void persistTransaction(parsed, parsed.categoryId)
          .then((created) => {
            showSnackbarRef.current(
              tRef.current('notifications.captured', {
                type: tRef.current(parsed.type === 'income' ? 'notifications.income' : 'notifications.expense'),
                amount: parsed.amount,
                description: parsed.description,
              }),
              tRef.current('notifications.undo'),
              () => {
                void undoTransaction(created.id).catch(() => {
                  showSnackbarRef.current(tRef.current('notifications.failedCreate'));
                });
              },
            );
          })
          .catch((err: unknown) => {
            showSnackbarRef.current(
              err instanceof Error
                ? `Capture failed: ${err.message}`
                : tRef.current('notifications.captureFailed'),
            );
          });
      } else {
        // Ask mode: durable review inbox (no blocking modal, no data loss).
        void addPendingCapture(toPendingCapture(parsed, payload.packageName, payload.postTime))
          .then(setPendingItems)
          .catch(() => {});
      }
    },
    [persistTransaction],
  );
  const handleParsedRef = useRef(handleParsed);
  handleParsedRef.current = handleParsed;

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    void (async () => {
      settingsRef.current = await getNotificationSettings();
      if (mounted) setPendingItems(await getPendingCaptures());
      // Process notifications captured while the app was killed.
      drainPendingNotifications((parsed, payload) => handleParsedRef.current(parsed, payload));
      // Live subscription (app alive / backgrounded).
      unsubscribe = subscribeToNotifications((parsed, payload) =>
        handleParsedRef.current(parsed, payload),
      );
    })();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const approve = useCallback(
    async (
      id: string,
      overrides?: { description?: string; amount?: string; categoryId?: string | null },
    ) => {
      const item = pendingItems.find((c) => c.id === id);
      if (!item) return;
      try {
        await createTransaction({
          description: overrides?.description ?? item.description,
          amount: overrides?.amount ?? item.amount,
          type: item.type,
          category_id: overrides && overrides.categoryId !== undefined ? overrides.categoryId : item.categoryId,
          date: item.date,
          notes: tRef.current('notifications.notes'),
        });
        const next = await removePendingCapture(id);
        setPendingItems(next);
        showSnackbarRef.current(
          tRef.current('notifications.created', { amount: overrides?.amount ?? item.amount }),
        );
      } catch (err) {
        showSnackbarRef.current(
          err instanceof Error ? err.message : tRef.current('notifications.failedCreate'),
        );
        throw err;
      }
    },
    [pendingItems],
  );

  const approveAll = useCallback(async () => {
    const items = await getPendingCaptures();
    let imported = 0;
    for (const item of items) {
      try {
        await createTransaction({
          description: item.description,
          amount: item.amount,
          type: item.type,
          category_id: item.categoryId,
          date: item.date,
          notes: tRef.current('notifications.notes'),
        });
        await removePendingCapture(item.id);
        imported += 1;
      } catch {
        // Keep failed items in the inbox so the user can retry or edit them.
      }
    }
    setPendingItems(await getPendingCaptures());
    if (imported > 0) {
      showSnackbarRef.current(
        tRef.current(
          imported === 1 ? 'notifications.approveAllDone_one' : 'notifications.approveAllDone_other',
          { count: imported },
        ),
      );
    }
  }, []);

  const skip = useCallback(async (id: string) => {
    const next = await removePendingCapture(id);
    setPendingItems(next);
  }, []);

  const value = useMemo(
    () => ({
      pendingCount: pendingItems.length,
      pendingItems,
      refresh,
      approve,
      approveAll,
      skip,
    }),
    [pendingItems, refresh, approve, approveAll, skip],
  );

  return (
    <NotificationCaptureContext.Provider value={value}>
      {children}
    </NotificationCaptureContext.Provider>
  );
}
