import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import {
  useI18n } from '../i18n';
import {
  KNOWN_APPS,
  NotificationSettings,
  configureNotifications,
  getNotificationSettings,
  saveNotificationSettings,
} from '../notifications/capture';

interface Props {
  categories: Category[];
}

export function NotificationSettingsScreen({ categories }: Props) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      const s = await getNotificationSettings();
      setSettings(s);
      const granted = await configureNotifications();
      setPermissionGranted(granted);
    })();
  }, []);

  const update = useCallback((patch: Partial<NotificationSettings>) => {
    setSettings((cur) => {
      if (!cur) return cur;
      const next = { ...cur, ...patch };
      void saveNotificationSettings(next);
      return next;
    });
  }, []);

  if (!settings) return null;

  const toggleApp = (label: string) => {
    const isSelected = settings.monitoredApps.includes(label);
    const next = isSelected
      ? settings.monitoredApps.filter((a) => a !== label)
      : [...settings.monitoredApps, label];
    update({ monitoredApps: next });
  };

  return (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t('notifications.title')}</Text>
      </View>

      {permissionGranted === false && (
        <View style={styles.reconErrorBox}>
          <Text style={styles.reconErrorText}>
            {t('notifications.permissionDenied')}
          </Text>
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
            onValueChange={(v) => {
              if (v && permissionGranted !== true) {
                void configureNotifications().then((g) => {
                  setPermissionGranted(g);
                  if (g) update({ enabled: true });
                  else
                    Alert.alert(
                      t('notifications.permissionNeeded'),
                      t('notifications.permissionNeededDesc'),
                    );
                });
              } else {
                update({ enabled: v });
              }
            }}
            trackColor={{ false: colors.surfaceHover, true: colors.primaryHover }}
            thumbColor={settings.enabled ? colors.primary : colors.textMuted}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('notifications.monitoredApps')}</Text>
        <Text style={styles.settingRowDesc}>
          When a selected app sends a notification, PudimFinance will try to
          extract the transaction.
        </Text>
        {KNOWN_APPS.map((app) => {
          const selected = settings.monitoredApps.includes(app.label);
          return (
            <TouchableOpacity
              key={app.label}
              style={styles.settingRow}
              onPress={() => toggleApp(app.label)}
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

