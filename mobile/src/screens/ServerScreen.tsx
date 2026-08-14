import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getApiBaseUrl,
  getDefaultServerUrl,
  setApiBaseUrl,
  testServerConnection,
} from '../config/server';
import { colors } from '../theme/tokens';
import { styles } from '../theme/styles';
import { useSnackbar } from '../components/Snackbar';
import { useI18n } from '../i18n';

export function ServerScreen() {
  const { show: showSnackbar } = useSnackbar();
  const { t } = useI18n();
  const [current, setCurrent] = useState('');
  const [input, setInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const url = await getApiBaseUrl();
      setCurrent(url);
      setInput(url);
    })();
  }, []);

  const handleTest = useCallback(async () => {
    setTesting(true);
    try {
      const ok = await testServerConnection(input);
      if (ok) {
        showSnackbar(t('server.connectionOk'));
      } else {
        Alert.alert(
          t('server.connectionFailed'),
          t('server.connectionFailedDesc'),
        );
      }
    } finally {
      setTesting(false);
    }
  }, [input, showSnackbar]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const normalized = await setApiBaseUrl(input);
      setCurrent(normalized);
      setInput(normalized);
      showSnackbar(t('server.saved'));
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? (err.message === 'Server address cannot be empty' ? t('server.addressRequired') : err.message) : t('server.failedSave'));
    } finally {
      setSaving(false);
    }
  }, [input, showSnackbar]);

  const isDefault = current === getDefaultServerUrl();

  return (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t('server.title')}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('server.backendAddress')}</Text>
        <Text style={styles.receiptHint}>
          {t('server.hint')}
        </Text>

        <Text style={styles.label}>{t('server.current')}</Text>
        <Text style={styles.serverCurrent} numberOfLines={1}>
          {current}
          {isDefault && t('server.default')}
        </Text>

        <Text style={styles.label}>{t('server.new')}</Text>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="http://192.168.1.100:3000"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={[styles.cancelButton, testing && styles.submitButtonDisabled]}
            onPress={handleTest}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator color={colors.textMuted} size="small" />
            ) : (
              <Text style={styles.cancelButtonText}>{t('server.test')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, (saving || !input.trim()) && styles.submitButtonDisabled]}
            onPress={handleSave}
            disabled={saving || !input.trim()}
          >
            {saving ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={styles.submitButtonText}>{t('server.save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('server.whyTitle')}</Text>
        <Text style={styles.receiptHint}>
          {t('server.whyDesc')}
        </Text>
      </View>
    </ScrollView>
  );
}
