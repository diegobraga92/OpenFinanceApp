import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme/tokens';

export interface TrendPoint {
  label: string;
  income: number;
  expense: number;
}

interface Props {
  data: TrendPoint[];
  width: number;
  height?: number;
  formatValue?: (value: number) => string;
}

const PAD = { top: 12, right: 12, bottom: 26, left: 12 };

export function TrendChart({ data, width, height = 180, formatValue }: Props) {
  const chartWidth = Math.max(40, width - PAD.left - PAD.right);
  const chartHeight = height - PAD.top - PAD.bottom;
  const max = Math.max(
    1,
    ...data.flatMap((d) => [d.income, d.expense]),
  );

  const xFor = (i: number) =>
    PAD.left + (data.length <= 1 ? chartWidth / 2 : (i / (data.length - 1)) * chartWidth);
  const yFor = (v: number) => PAD.top + chartHeight - (v / max) * chartHeight;

  const incomePoints = data.map((d, i) => `${xFor(i)},${yFor(d.income)}`).join(' ');
  const expensePoints = data.map((d, i) => `${xFor(i)},${yFor(d.expense)}`).join(' ');

  const gridValues = [0.25, 0.5, 0.75, 1];

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        {gridValues.map((g) => {
          const y = PAD.top + chartHeight * (1 - g);
          return (
            <Line
              key={g}
              x1={PAD.left}
              y1={y}
              x2={width - PAD.right}
              y2={y}
              stroke={colors.surfaceHover}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          );
        })}
        {data.length > 1 && (
          <Polyline
            points={incomePoints}
            fill="none"
            stroke={colors.income}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}
        {data.length > 1 && (
          <Polyline
            points={expensePoints}
            fill="none"
            stroke={colors.expense}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}
        {data.map((d, i) => (
          <React.Fragment key={`${d.label}-${i}`}>
            <Circle cx={xFor(i)} cy={yFor(d.income)} r={3} fill={colors.income} />
            <Circle cx={xFor(i)} cy={yFor(d.expense)} r={3} fill={colors.expense} />
            <SvgText
              x={xFor(i)}
              y={height - 8}
              fontSize={10}
              fill={colors.textMuted}
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.income }]} />
          <Text style={styles.legendText}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.expense }]} />
          <Text style={styles.legendText}>Expenses</Text>
        </View>
        {formatValue && (
          <Text style={styles.legendHint}>
            {formatValue(max)} peak
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  legendHint: {
    color: colors.textDim,
    fontSize: 11,
  },
});
