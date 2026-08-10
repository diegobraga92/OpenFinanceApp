import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors } from '../theme/tokens';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: DonutSegment[];
  size?: number;
  thickness?: number;
  centerValue?: string;
  centerLabel?: string;
}

export function DonutChart({
  data,
  size = 160,
  thickness = 22,
  centerValue,
  centerLabel,
}: Props) {
  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  if (total <= 0) {
    return (
      <View style={[styles.empty, { width: size, height: size }]}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  const segments = data
    .filter((d) => d.value > 0)
    .map((d) => ({ ...d, dash: (d.value / total) * circumference }));

  let cursor = 0;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.surfaceHover}
            strokeWidth={thickness}
            fill="none"
          />
          {segments.map((seg, i) => {
            const strokeDashoffset = circumference - cursor;
            cursor += seg.dash;
            return (
              <Circle
                key={`${seg.label}-${i}`}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={seg.color}
                strokeWidth={thickness}
                fill="none"
                strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
                strokeDashoffset={strokeDashoffset}
              />
            );
          })}
        </G>
      </Svg>
      <View style={styles.center}>
        {centerValue && <Text style={styles.centerValue}>{centerValue}</Text>}
        {centerLabel && <Text style={styles.centerLabel}>{centerLabel}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  centerLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 13,
  },
});
