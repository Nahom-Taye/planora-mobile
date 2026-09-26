import { palette, radii, shadows, spacing, typography } from './tokens';

export const lightColors = {
  background: palette.lavender[100],
  surface: palette.white,
  surfaceSubtle: palette.lavender[200],
  text: palette.lavender[900],
  textMuted: palette.lavender[700],
  primary: palette.violet[500],
  primaryPressed: palette.violet[600],
  primarySoft: palette.violet[100],
  onPrimary: palette.white,
  accent: palette.pink[600],
  accentSoft: palette.pink[50],
  success: '#0E7D62',
  warning: '#8A5410',
  danger: '#B83A45',
  onDanger: palette.white,
  border: palette.lavender[300],
  divider: '#E9E4F7',
  tabBar: palette.white,
  focus: palette.violet[400],
  overlay: 'rgba(23, 19, 43, 0.5)',
} as const;

export const darkColors: ColorTokens = {
  background: '#0D0B1E',
  surface: '#171430',
  surfaceSubtle: '#221D42',
  text: '#F3F1FF',
  textMuted: '#B0A9D9',
  primary: '#A78BFF',
  primaryPressed: '#BEA8FF',
  primarySoft: '#2E2560',
  onPrimary: '#1C1048',
  accent: palette.pink[400],
  accentSoft: '#3D1230',
  success: '#59D6B4',
  warning: '#E8B366',
  danger: '#F08A92',
  onDanger: '#241216',
  border: '#332C5C',
  divider: '#2A2450',
  tabBar: '#131028',
  focus: '#BEA8FF',
  overlay: 'rgba(0, 0, 0, 0.65)',
};

export type GradientTokens = {
  primary: readonly [string, string];
  aurora: readonly [string, string, string];
};

export const lightGradients: GradientTokens = {
  primary: ['#7C3AED', palette.violet[500]],
  aurora: ['#5B2EE5', '#7C3AED', '#B01A63'],
};

export const darkGradients: GradientTokens = {
  primary: ['#BEA8FF', '#A78BFF'],
  aurora: ['#2E2560', '#4A21C4', '#8B2E63'],
};

export type ColorTokens = {
  [Key in keyof typeof lightColors]: string;
};

export type ColorToken = keyof ColorTokens;

export type AppTheme = {
  mode: 'light' | 'dark';
  isDark: boolean;
  colors: ColorTokens;
  gradients: GradientTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  shadows: typeof shadows;
};

export const lightTheme: AppTheme = {
  mode: 'light',
  isDark: false,
  colors: lightColors,
  gradients: lightGradients,
  spacing,
  radii,
  typography,
  shadows,
};

export const darkTheme: AppTheme = {
  mode: 'dark',
  isDark: true,
  colors: darkColors,
  gradients: darkGradients,
  spacing,
  radii,
  typography,
  shadows,
};
