import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useI18n } from '../i18n';
import { colors } from '../theme/tokens';
import type { Locale } from '../../../shared/i18n';

const OPTIONS: { value: Locale; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'pt-BR', label: 'PT' },
];

/** Segmented EN / PT control for switching the UI language. */
export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  return (
    <View
      style={styles.group}
      accessibilityLabel={t('app.language')}
      accessible
    >
      {OPTIONS.map((opt) => {
        const active = locale === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.button, active && styles.buttonActive]}
            onPress={() => setLocale(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.buttonText, active && styles.buttonTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 2,
    alignSelf: 'flex-start',
  },
  button: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  buttonActive: {
    backgroundColor: colors.surfaceHover,
  },
  buttonText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  buttonTextActive: {
    color: colors.text,
  },
});
