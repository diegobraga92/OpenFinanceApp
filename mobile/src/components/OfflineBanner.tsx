import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { colors } from '../theme/tokens';
import { countPendingOperations, isOnline, syncAll } from '../offline/sync-engine';

type Status = 'online' | 'syncing' | 'offline';

/**
 * Top banner showing connectivity + pending-sync state.
 *
 * - online  → hidden (or a brief "synced" flash after a sync completes)
 * - syncing → thin amber bar
 * - offline → red bar with the number of pending local changes
 */
export function OfflineBanner() {
  const [status, setStatus] = useState<Status>('online');
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      const online = await isOnline();
      if (!mounted) return;
      setStatus(online ? 'online' : 'offline');
      setPending(countPendingOperations());
    };

    // Listen to connectivity changes.
    const unsub = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (!mounted) return;
      setStatus(online ? 'online' : 'offline');
      setPending(countPendingOperations());
    });

    void refresh();
    const interval = setInterval(refresh, 5000);

    return () => {
      mounted = false;
      unsub();
      clearInterval(interval);
    };
  }, []);

  const handleSync = useCallback(async () => {
    setStatus('syncing');
    await syncAll();
    setStatus('online');
    setPending(countPendingOperations());
  }, []);
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
          pending > 0 ? `🔴 Offline — ${pending} change(s) pending` : '🔴 Offline'
        ) : status === 'syncing' ? (
          '🟡 Syncing…'
        ) : (
          <Text style={styles.text} onPress={handleSync}>
            🟢 {pending} change(s) pending — tap to sync
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
