import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  Platform,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Category } from '../api';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { categoryIcon } from '../../../shared/category-icons';
import { useI18n } from '../i18n';
import {
  KNOWN_APPS,
  NotificationSettings,
  getNotificationSettings,
  isNotificationAccessGranted,
  openNotificationAccessSettings,
  saveNotificationSettings,
} from '../notifications/capture';

interface Props {
  categories: Category[];
}

export function NotificationSettingsScreen({ categories }: Props) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [accessGranted, setAccessGranted] = useState<boolean | null>(null);

  const supported = Platform.OS === 'android';

  useEffect(() => {
    void (async () => {
      const s = await getNotificationSettings();
      setSettings(s);
      setAccessGranted(supported ? isNotificationAccessGranted() : false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh the access flag whenever the app returns to the foreground — the
  // user may have just toggled it in the system settings screen.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && supported) {
        setAccessGranted(isNotificationAccessGranted());
      }
    });
    return () => sub.remove();
  }, [supported]);

  const update = useCallback((patch: Partial<NotificationSettings>) => {
    setSettings((cur) => {
      if (!cur) return cur;
      const next = { ...cur, ...patch };
      void saveNotificationSettings(next);
      return next;
    });
  }, []);

  const requestAccess = () => {
    if (!supported) return;
    if (isNotificationAccessGranted()) {
      setAccessGranted(true);
      return;
    }
    Alert.alert(t('notifications.accessNeeded'), t('notifications.accessNeededDesc'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('notifications.openSettings'),
        onPress: () => openNotificationAccessSettings(),
      },
    ]);
  };

  if (!settings) return null;

  const toggleApp = (packageName: string) => {
    const isSelected = settings.monitoredApps.includes(packageName);
    const next = isSelected
      ? settings.monitoredApps.filter((p) => p !== packageName)
      : [...settings.monitoredApps, packageName];
    update({ monitoredApps: next });
  };

  return (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t('notifications.title')}</Text>
      </View>

      {!supported && (
        <View style={styles.reconErrorBox}>
          <Text style={styles.reconErrorText}>{t('notifications.unavailable')}</Text>
        </View>
      )}

      {supported && accessGranted === false && (
        <View style={styles.reconErrorBox}>
          <Text style={styles.reconErrorText}>{t('notifications.permissionDenied')}</Text>
          <TouchableOpacity style={styles.settingRow} onPress={requestAccess}>
            <Text style={[styles.settingRowTitle, { color: colors.primary }]}>
              {t('notifications.openSettings')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingRowText}>
            <Text style={styles.settingRowTitle}>{t('notifications.autoCapture')}</Text>
            <Text style={styles.settingRowDesc}>
              {t('notifications.autoCaptureDesc')}
            </Text>
          </View>
          <Switch
            value={settings.enabled}
            disabled={!supported}
            onValueChange={(v) => {
              if (!v) {
                update({ enabled: false });
                return;
              }
              if (!supported) return;
              if (!isNotificationAccessGranted()) {
                requestAccess();
                return;
              }
              setAccessGranted(true);
              update({ enabled: true });
            }}
            trackColor={{ false: colors.surfaceHover, true: colors.primaryHover }}
            thumbColor={settings.enabled ? colors.primary : colors.textMuted}
          />
        </View>
      </View>

      {supported && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('notifications.monitoredApps')}</Text>
          <Text style={styles.settingRowDesc}>
            When a selected app sends a notification, PudimFinance will try to
            extract the transaction.
          </Text>
          {KNOWN_APPS.map((app) => {
            const pkg = app.packageName;
            if (!pkg) return null;
            const selected = settings.monitoredApps.includes(pkg);
            return (
              <TouchableOpacity
                key={pkg}
                style={styles.settingRow}
                onPress={() => toggleApp(pkg)}
              >
                <Text style={styles.settingRowTitle}>{app.label}</Text>
                <View
                  style={[
                    styles.checkbox,
                    selected && { backgroundColor: colors.primary },
                  ]}
                >
                  {selected && <Text style={styles.checkboxCheck}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => update({ monitoredApps: [] })}
          >
            <Text style={styles.settingRowDesc}>
              {settings.monitoredApps.length === 0
                ? t('notifications.watchingAll')
                : t('notifications.clearSelection')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('notifications.captureMode')}</Text>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => update({ mode: 'ask' })}
        >
          <View style={styles.settingRowText}>
            <Text style={styles.settingRowTitle}>{t('notifications.askBefore')}</Text>
            <Text style={styles.settingRowDesc}>
              {t('notifications.askBeforeDesc')}
            </Text>
          </View>
          <View
            style={[
              styles.radioOuter,
              settings.mode === 'ask' && { borderColor: colors.primary },
            ]}
          >
            {settings.mode === 'ask' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => update({ mode: 'auto' })}
        >
          <View style={styles.settingRowText}>
            <Text style={styles.settingRowTitle}>{t('notifications.autoCreate')}</Text>
            <Text style={styles.settingRowDesc}>
              {t('notifications.autoCreateDesc')}
            </Text>
          </View>
          <View
            style={[
              styles.radioOuter,
              settings.mode === 'auto' && { borderColor: colors.primary },
            ]}
          >
            {settings.mode === 'auto' && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('notifications.defaultCategory')}</Text>
        <Text style={styles.settingRowDesc}>
          {t('notifications.defaultCategoryDesc')}
        </Text>
        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              settings.defaultCategoryId === null && styles.typeButtonActive,
            ]}
            onPress={() => update({ defaultCategoryId: null })}
          >
            <Text
              style={[
                styles.typeButtonText,
                settings.defaultCategoryId === null && styles.typeButtonTextActive,
              ]}
            >
              {t('common.none')}
            </Text>
          </TouchableOpacity>
          {categories
            .filter((c) => c.type === 'expense')
            .map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.typeButton,
                  settings.defaultCategoryId === c.id && styles.typeButtonActive,
                ]}
                onPress={() => update({ defaultCategoryId: c.id })}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.typeButtonText,
                    settings.defaultCategoryId === c.id && styles.typeButtonTextActive,
                  ]}
                >
                  {categoryIcon(c.icon)} {c.name}
                </Text>
              </TouchableOpacity>
            ))}
        </View>
      </View>
    </ScrollView>
  );
}

