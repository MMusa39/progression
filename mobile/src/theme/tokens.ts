/**
 * Design tokens: the single source of truth for color, spacing, radius and
 * type. Components never hard-code these values, so the whole app can be
 * re-themed from this file, and light/dark mode stay consistent.
 *
 * The palette is dark-first: a near-black base, layered surfaces for depth, and
 * one high-energy lime accent reserved for primary actions and progress.
 */
import { Platform, type TextStyle } from 'react-native';

const lime = '#C6F135';

export const palettes = {
  dark: {
    background: '#0A0A0C',
    surface: '#141418',
    surfaceRaised: '#1E1E24',
    border: '#2A2A32',
    text: '#F4F4F6',
    textSecondary: '#A0A0AB',
    textTertiary: '#6E6E79',
    accent: lime,
    /** Text/icons drawn on top of `accent`. */
    onAccent: '#0A0A0C',
    /** Accent used for text and icons on the page background (links, highlights). */
    accentText: lime,
    accentMuted: 'rgba(198, 241, 53, 0.14)',
    danger: '#FF5C5C',
    dangerMuted: 'rgba(255, 92, 92, 0.14)',
    gold: '#FFC53D',
    inputBackground: '#1E1E24',
    google: '#FFFFFF',
    onGoogle: '#1F1F1F',
    /**
     * Data marks (lines, bars). A calmer lime step than `accent`, validated with
     * the dataviz palette checks: OKLCH L 0.67 (inside the dark band) and >= 3:1 vs `surface`.
     */
    chart: '#84A31A',
    chartWash: 'rgba(132, 163, 26, 0.10)',
    /** A target zone behind bars: stronger than the wash so it reads as a band. */
    chartBand: 'rgba(132, 163, 26, 0.18)',
    /** Bars outside the target: neutral, still >= 3:1 vs `surface` so they stay visible. */
    chartMuted: '#6E6E79',
    gridline: '#26262D',
  },
  light: {
    background: '#F4F4F6',
    surface: '#FFFFFF',
    surfaceRaised: '#EDEDF1',
    border: '#DEDEE4',
    text: '#0A0A0C',
    textSecondary: '#5C5C67',
    textTertiary: '#8C8C97',
    accent: lime,
    onAccent: '#0A0A0C',
    accentText: '#4A6B00',
    accentMuted: 'rgba(122, 170, 0, 0.14)',
    danger: '#E5383B',
    dangerMuted: 'rgba(229, 56, 59, 0.10)',
    gold: '#C98A00',
    inputBackground: '#FFFFFF',
    google: '#FFFFFF',
    onGoogle: '#1F1F1F',
    /** Validated: OKLCH L inside the light band, 4.3:1 vs white `surface`. */
    chart: '#5A8700',
    chartWash: 'rgba(90, 135, 0, 0.10)',
    chartBand: 'rgba(90, 135, 0, 0.16)',
    chartMuted: '#8C8C97',
    gridline: '#ECECF0',
  },
} as const;

export type Palette = { [K in keyof typeof palettes.dark]: string };
export type ColorName = keyof Palette;

/** 4-point spacing scale. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Minimum touch target (Apple HIG: 44pt). Primary actions use larger targets for gym use. */
export const hitTarget = { min: 44, large: 56 } as const;

const rounded = Platform.select({ ios: 'ui-rounded', default: undefined });

/**
 * Type scale modeled on iOS text styles. `display` uses the rounded system
 * font for big numbers (timers, weights), which reads well at a glance mid-set.
 */
export const typography = {
  display: { fontSize: 40, lineHeight: 46, fontWeight: '800', fontFamily: rounded },
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '800' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  /** Numeric entry (weight, reps): rounded, tabular figures so columns align. */
  number: { fontSize: 17, lineHeight: 22, fontWeight: '600', fontFamily: rounded, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
