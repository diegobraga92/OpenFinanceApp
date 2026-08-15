import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { colors } from '../theme/tokens';
import { useI18n } from '../i18n';
import { countPendingOperations, isOnline, syncAll } from '../offline/sync-engine';
import { clearServerProbeCache } from '../offline/net';

type Status = 'online' | 'syncing' | 'offline';

/**
 * Top banner showing connectivity + pending-sync state.
 *
 * - online  → hidden (or a brief "synced" flash after a sync completes)
 * - syncing → thin amber bar
 * - offline → red bar with the number of pending local changes
 */
export function OfflineBanner() {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>('online');
  const [pending, setPending] = useState(0);
  // Tracks the last known online state so we can auto-sync when the server
  // becomes reachable again (either the link came back or the server recovered).
  const wasOnline = useRef(true);

  const handleSync = useCallback(async () => {
    setStatus('syncing');
    const result = await syncAll();
    setStatus(result.ok ? 'online' : 'offline');
    setPending(countPendingOperations());
  }, []);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      const online = await isOnline();
      if (!mounted) return;
      setStatus(online ? 'online' : 'offline');
      setPending(countPendingOperations());
      if (online && !wasOnline.current) {
        wasOnline.current = true;
        // The server became reachable again — push queued changes right away.
        void handleSync();
      } else {
        wasOnline.current = online;
      }
    };

    // NetInfo fires on device connectivity changes. We still re-evaluate with
    // the server probe so "internet up but server unreachable" reads as offline.
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected === true) {
        // The link is back — reset the circuit breaker so we probe immediately.
        clearServerProbeCache();
      }
      void refresh();
    });

    void refresh();
    const interval = setInterval(refresh, 5000);

    return () => {
      mounted = false;
      unsub();
      clearInterval(interval);
    };
  }, [handleSync]);
  if (status === 'online' && pending === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.banner,
        status === 'offline'
          ? styles.bannerOffline
          : status === 'syncing'
            ? styles.bannerSyncing
            : styles.bannerOnline,
      ]}
    >
      <Text style={styles.text}>
        {status === 'offline' ? (
          pending > 0 ? t(pending === 1 ? 'offline.pending_one' : 'offline.pending_other', { count: pending }) : t('offline.offline')
        ) : status === 'syncing' ? (
          t('offline.syncing')
        ) : (
          <Text style={styles.text} onPress={handleSync}>
            {t(pending === 1 ? 'offline.syncPending_one' : 'offline.syncPending_other', { count: pending })}
          </Text>
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  bannerOffline: {
    backgroundColor: colors.dangerBg,
  },
  bannerSyncing: {
    backgroundColor: colors.warningBg,
  },
  bannerOnline: {
    backgroundColor: colors.primaryHover,
  },
  text: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
