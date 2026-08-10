import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/tokens';

interface Props {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({
  icon = '🗂️',
  title,
  description,
  actionLabel,
  onAction,
  compact,
}: Props) {
  return (
    <View style={[styles.wrapper, compact && styles.wrapperCompact]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.action} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 8,
  },
  wrapperCompact: {
    paddingVertical: 16,
  },
  icon: {
    fontSize: 34,
    marginBottom: 2,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 280,
  },
  action: {
    marginTop: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '600',
  },
});
