import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { loginUser, registerUser } from '../api';
import { setAuthSession, type AuthUser } from '../auth';
import { getApiBaseUrl, setApiBaseUrl } from '../config/server';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Mode = 'login' | 'register';

interface Props {
  onAuthenticated: (user: AuthUser) => void;
}

/** Full-screen login / registration form shown when no valid session exists. */
export function LoginScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Load the configured server address so users can adjust it before signing in.
  useEffect(() => {
    void (async () => {
      const url = await getApiBaseUrl();
      setServerUrl(url);
    })();
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const handleSubmit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      // Persist the server address (if changed) so the auth call below hits it.
      await setApiBaseUrl(serverUrl);
      if (mode === 'login') {
        const res = await loginUser({ email: email.trim(), password });
        await setAuthSession(res.access_token, res.refresh_token, res.user);
        onAuthenticated(res.user);
      } else {
        const res = await registerUser({
          email: email.trim(),
          password,
          display_name: displayName.trim() || null,
        });
        await setAuthSession(res.access_token, res.refresh_token, res.user);
        onAuthenticated(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>🏦</Text>
        <Text style={styles.title}>PudimFinance</Text>
        <Text style={styles.subtitle}>
          {mode === 'login'
            ? 'Sign in to your personal finance dashboard'
            : 'Create an account to start tracking your money'}
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TextInput
          style={styles.serverInput}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="Server (e.g. http://192.168.1.100:3000)"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        {mode === 'register' && (
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name (optional)"
            placeholderTextColor={colors.textDim}
            autoCapitalize="words"
          />
        )}

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.textDim}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'register' ? 'Password (at least 8 characters)' : 'Password'}
          placeholderTextColor={colors.textDim}
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.submit, busy && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={busy}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.submitText}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => switchMode(mode === 'login' ? 'register' : 'login')}
          accessibilityRole="button"
        >
          <Text style={styles.switchText}>
            {mode === 'login'
              ? "Don't have an account? Create one"
              : 'Already registered? Sign in'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography['2xl'],
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginVertical: spacing.sm,
    marginBottom: spacing.xl,
  },
  errorBox: {
    width: '100%',
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.dangerText,
    fontSize: typography.sm,
    textAlign: 'left',
  },
  serverInput: {
    width: '100%',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: typography.sm,
    marginBottom: spacing.md,
    fontFamily: 'monospace',
  },
  input: {
    width: '100%',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: typography.md,
    marginBottom: spacing.md,
  },
  submit: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: colors.primaryText,
    fontSize: typography.lg,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: spacing.xl,
    padding: spacing.sm,
  },
  switchText: {
    color: colors.primary,
    fontSize: typography.md,
    fontWeight: '600',
  },
});
