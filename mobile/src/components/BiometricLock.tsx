import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors } from '../theme/tokens';
import { useI18n } from '../i18n';

interface Props {
  children: ReactNode;
  /**
   * Start the app locked behind biometrics on mount. True for a restored
   * session (i.e. any launch after the first login); false right after the
   * user logs in with a password so no redundant prompt appears.
   */
  lockOnMount: boolean;
}

/**
 * Locks the app behind the device's biometric authentication (Face ID /
 * fingerprint) once the user has logged in at least once.
 *
 * - After the first login the app stays unlocked for that session.
 * - On any later launch (restored session) it starts locked and auto-prompts.
 * - Every time the app returns from the background it re-locks and prompts.
 * - If biometrics are unavailable or not enrolled, the app opens normally.
 */
export function BiometricLock({ children, lockOnMount }: Props) {
  const { t } = useI18n();
  const [supported, setSupported] = useState(false);
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const prompting = useRef(false);
  const didAutoPrompt = useRef(false);
  const prevAppState = useRef(AppState.currentState);

  const prompt = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      // Timeout so a hung OS biometric prompt can never leave the Unlock
      // button permanently dead (prompting.current must always be released).
      const result = await Promise.race([
        LocalAuthentication.authenticateAsync({
          promptMessage: t('biometric.promptMessage'),
          cancelLabel: t('common.cancel'),
          disableDeviceFallback: false,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 60_000)),
      ]);
      if (result?.success) setLocked(false);
    } catch {
      // Stay locked if the prompt fails for any reason.
    } finally {
      prompting.current = false;
    }
  }, [t]);

  // Check for biometric hardware/enrollment and decide the initial lock state.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [hasHardware, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        const isSupported = hasHardware && enrolled;
        if (!mounted) return;
        setSupported(isSupported);
        setLocked(isSupported && lockOnMount);
      } catch {
        if (mounted) {
          setSupported(false);
          setLocked(false);
        }
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lockOnMount]);

  // Auto-prompt once when the app opens locked (restored session).
  useEffect(() => {
    if (didAutoPrompt.current) return;
    if (!ready || !supported || !locked) return;
    didAutoPrompt.current = true;
    void prompt();
  }, [ready, supported, locked, prompt]);

  // Re-lock on background and auto-prompt when returning to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = prevAppState.current;
      prevAppState.current = next;
      if (next === 'background') {
        // Any in-flight OS biometric dialog is gone now; clear the guard so a
        // never-settling authenticateAsync promise can't wedge the button.
        prompting.current = false;
        if (supported) setLocked(true);
      } else if (next === 'active' && prev === 'background') {
        // Clear a possibly-stuck guard before re-prompting.
        prompting.current = false;
        if (supported) {
          setLocked(true);
          void prompt();
        }
      }
    });
    return () => sub.remove();
  }, [supported, prompt]);

  if (!ready) return null;

  if (!supported || !locked) return <>{children}</>;

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>{t('biometric.lockedTitle')}</Text>
      <Text style={styles.subtitle}>{t('biometric.lockedSubtitle')}</Text>
      <TouchableOpacity style={styles.button} onPress={prompt} accessibilityRole="button">
        <Text style={styles.buttonText}>{t('biometric.unlock')}</Text>
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
