import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors } from '../theme/tokens';

interface Props {
  children: ReactNode;
}

/**
 * Locks the app behind the device's biometric authentication (Face ID /
 * fingerprint). If biometrics are unavailable or not enrolled, the app opens
 * normally. Otherwise a lock screen is shown until the user authenticates.
 */
export function BiometricLock({ children }: Props) {
  const [supported, setSupported] = useState(true);
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [hasHardware, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        if (!mounted) return;
        setSupported(hasHardware && enrolled);
        if (!(hasHardware && enrolled)) setLocked(false);
      } catch {
        if (mounted) {
          setSupported(false);
          setLocked(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const unlock = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock PudimFinance',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) setLocked(false);
    } catch {
      // Stay locked if the prompt fails for any reason.
    }
  }, []);

  if (!supported || !locked) return <>{children}</>;

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>PudimFinance is locked</Text>
      <Text style={styles.subtitle}>Authenticate to view your finances</Text>
      <TouchableOpacity style={styles.button} onPress={unlock} accessibilityRole="button">
        <Text style={styles.buttonText}>Unlock</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: 24,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 28,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  buttonText: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: '600',
  },
});
