/**
 * PudimFinance mobile design tokens.
 *
 * Single source of truth for colors, spacing, radii and typography used
 * across the React Native app. Mirror of web/src/theme/tokens.ts (dark
 * palette) so both platforms stay visually consistent.
 *
 * React Native does not support CSS custom properties, so these are plain
 * JS constants imported directly by styles and inline props.
 */

export const colors = {
  /** Page background */
  bg: '#0f172a',
  /** Card / panel background */
  surface: '#1e293b',
  /** Raised / hover surface (badges, active nav, progress tracks) */
  surfaceHover: '#334155',
  /** Form input background */
  inputBg: '#0f172a',
  /** Default border color */
  border: '#334155',
  /** Stronger border (active, focus) */
  borderStrong: '#475569',
  /** Primary text */
  text: '#e2e8f0',
  /** Secondary text */
  textMuted: '#94a3b8',
  /** Tertiary / placeholder / disabled text */
  textDim: '#64748b',
  /** Primary brand color (actions, income) */
  primary: '#22c55e',
  /** Text placed on top of the primary color */
  primaryText: '#0f172a',
  /** Primary hover state */
  primaryHover: '#16a34a',
  /** Destructive / negative actions */
  danger: '#ef4444',
  /** Error banner background */
  dangerBg: '#450a0a',
  /** Error banner border */
  dangerBorder: '#991b1b',
  /** Error banner text */
  dangerText: '#fca5a5',
  /** Warning accent (budget near limit) */
  warning: '#f59e0b',
  /** Warning banner background */
  warningBg: '#451a03',
  /** Warning banner border */
  warningBorder: '#b45309',
  /** Warning banner text */
  warningText: '#fbbf24',
  /** Positive / success text */
  success: '#22c55e',
  /** Income amount color */
  income: '#22c55e',
  /** Expense amount color */
  expense: '#ef4444',
  /** Modal / drawer scrim */
  overlay: 'rgba(0, 0, 0, 0.6)',
} as const;

/** Spacing scale (px). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
} as const;

/** Border radius scale (px). */
export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

/** Typography scale (px). */
export const typography = {
  xs: 11,
  sm: 12,
  base: 13,
  md: 14,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
} as const;
