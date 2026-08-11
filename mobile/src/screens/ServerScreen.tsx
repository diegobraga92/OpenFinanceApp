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

export function ServerScreen() {
  const { show: showSnackbar } = useSnackbar();
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
        showSnackbar('✅ Connection OK — backend is reachable');
      } else {
        Alert.alert(
          'Connection failed',
          'Could not reach the backend at this address. Check the IP/port and that the server is running.',
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
      showSnackbar('✅ Server saved — the app is using it now');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save server');
    } finally {
      setSaving(false);
    }
  }, [input, showSnackbar]);

  const isDefault = current === getDefaultServerUrl();

  return (
    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Server</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backend address</Text>
        <Text style={styles.receiptHint}>
          Enter the address of your PudimFinance server so the app can talk to
          it. Use your computer's LAN IP on a phone (e.g. http://192.168.1.100:3000).
        </Text>

        <Text style={styles.label}>Current address</Text>
        <Text style={styles.serverCurrent} numberOfLines={1}>
          {current}
          {isDefault && '  (default)'}
        </Text>

        <Text style={styles.label}>New address</Text>
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
              <Text style={styles.cancelButtonText}>Test connection</Text>
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
              <Text style={styles.submitButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Why configure this?</Text>
        <Text style={styles.receiptHint}>
          The backend runs on your server/computer, not on the phone. Since the
          address can change (new LAN IP, different port, moving to a hosted
          server), it is configurable here instead of being fixed at build
          time.
        </Text>
      </View>
    </ScrollView>
  );
}
