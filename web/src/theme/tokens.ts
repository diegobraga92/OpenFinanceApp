/**
 * PudimFinance design tokens.
 *
 * Single source of truth for colors, spacing, radii, and typography.
 * The web app maps these to CSS custom properties (see ../index.css) so
 * inline styles can reference `var(--color-*)` and the whole UI reacts to
 * the active theme without re-rendering.
 */

export type ThemeMode = 'dark' | 'light';

export interface Palette {
  /** Page background */
  bg: string;
  /** Card / panel background */
  surface: string;
  /** Raised / hover surface (e.g. active nav item, toggle) */
  surfaceHover: string;
  /** Form input background */
  inputBg: string;
  /** Default border color */
  border: string;
  /** Stronger border (active, focus) */
  borderStrong: string;
  /** Primary text */
  text: string;
  /** Secondary text */
  textMuted: string;
  /** Tertiary / disabled text */
  textDim: string;
  /** Primary brand color (actions, income) */
  primary: string;
  /** Text placed on top of the primary color */
  primaryText: string;
  /** Primary hover state */
  primaryHover: string;
  /** Destructive / negative actions */
  danger: string;
  /** Error banner background */
  dangerBg: string;
  /** Error banner border */
  dangerBorder: string;
  /** Error banner text */
  dangerText: string;
  /** Warning accent (budget near limit) */
  warning: string;
  /** Warning banner background */
  warningBg: string;
  /** Warning banner border */
  warningBorder: string;
  /** Warning banner text */
  warningText: string;
  /** Positive / success text */
  success: string;
  /** Income amount color */
  income: string;
  /** Expense amount color */
  expense: string;
  /** Modal / drawer scrim */
  overlay: string;
  /** Card shadow (light theme only; transparent in dark) */
  shadow: string;
}

export const darkPalette: Palette = {
  bg: '#0f172a',
  surface: '#1e293b',
  surfaceHover: '#334155',
  inputBg: '#0f172a',
  border: '#334155',
  borderStrong: '#475569',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  primary: '#22c55e',
  primaryText: '#0f172a',
  primaryHover: '#16a34a',
  danger: '#ef4444',
  dangerBg: '#450a0a',
  dangerBorder: '#991b1b',
  dangerText: '#fca5a5',
  warning: '#f59e0b',
  warningBg: '#451a03',
  warningBorder: '#b45309',
  warningText: '#fbbf24',
  success: '#22c55e',
  income: '#22c55e',
  expense: '#ef4444',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '0 0 0 rgba(0, 0, 0, 0)',
};

export const lightPalette: Palette = {
  bg: '#f1f5f9',
  surface: '#ffffff',
  surfaceHover: '#e2e8f0',
  inputBg: '#f8fafc',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  text: '#0f172a',
  textMuted: '#475569',
  textDim: '#64748b',
  primary: '#16a34a',
  primaryText: '#ffffff',
  primaryHover: '#15803d',
  danger: '#dc2626',
  dangerBg: '#fef2f2',
  dangerBorder: '#fecaca',
  dangerText: '#b91c1c',
  warning: '#d97706',
  warningBg: '#fffbeb',
  warningBorder: '#fde68a',
  warningText: '#92400e',
  success: '#16a34a',
  income: '#16a34a',
  expense: '#dc2626',
  overlay: 'rgba(15, 23, 42, 0.45)',
  shadow: '0 1px 3px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.06)',
};

/** Map a palette to CSS custom property name → value. */
export function cssVars(palette: Palette): Record<string, string> {
  return {
    '--color-bg': palette.bg,
    '--color-surface': palette.surface,
    '--color-surface-hover': palette.surfaceHover,
    '--color-input-bg': palette.inputBg,
    '--color-border': palette.border,
    '--color-border-strong': palette.borderStrong,
    '--color-text': palette.text,
    '--color-text-muted': palette.textMuted,
    '--color-text-dim': palette.textDim,
    '--color-primary': palette.primary,
    '--color-primary-text': palette.primaryText,
    '--color-primary-hover': palette.primaryHover,
    '--color-danger': palette.danger,
    '--color-danger-bg': palette.dangerBg,
    '--color-danger-border': palette.dangerBorder,
    '--color-danger-text': palette.dangerText,
    '--color-warning': palette.warning,
    '--color-warning-bg': palette.warningBg,
    '--color-warning-border': palette.warningBorder,
    '--color-warning-text': palette.warningText,
    '--color-success': palette.success,
    '--color-income': palette.income,
    '--color-expense': palette.expense,
    '--color-overlay': palette.overlay,
    '--shadow-card': palette.shadow,
  };
}

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
  full: 9999,
} as const;

/** Typography scale (px). */
export const font = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
} as const;
