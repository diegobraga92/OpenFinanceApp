import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/tokens';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../../../shared/i18n';

const ONBOARDING_KEY = 'pudim_onboarded_v1';

const STEPS: { icon: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { icon: '🏦', titleKey: 'onboarding.step1Title', descKey: 'onboarding.step1Desc' },
  { icon: '🎯', titleKey: 'onboarding.step2Title', descKey: 'onboarding.step2Desc' },
  { icon: '🔒', titleKey: 'onboarding.step3Title', descKey: 'onboarding.step3Desc' },
];

/** Shows the onboarding wizard on first launch, then renders children. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((v) => {
        if (mounted) setOnboarded(v === '1');
      })
      .catch(() => {
        if (mounted) setOnboarded(true);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const complete = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      // Non-fatal — proceed to the app regardless.
    }
    setOnboarded(true);
  }, []);

  if (!ready) return null;
  if (!onboarded) return <OnboardingScreen onComplete={complete} />;
  return <>{children}</>;
}

function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  return (
    <View style={styles.container}>
      <View style={styles.skipRow}>
        <TouchableOpacity onPress={onComplete} style={styles.skipButton}>
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>

        <Text style={styles.icon}>{current.icon}</Text>
        <Text style={styles.title}>{t(current.titleKey)}</Text>
        <Text style={styles.description}>{t(current.descKey)}</Text>
      </ScrollView>

      <View style={styles.footer}>
        {step < STEPS.length - 1 ? (
          <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(step + 1)}>
            <Text style={styles.primaryButtonText}>{t('onboarding.next')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryButton} onPress={onComplete}>
            <Text style={styles.primaryButtonText}>{t('onboarding.getStarted')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  skipRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceHover,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 22,
  },
  icon: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
});
