import { palette, radii, shadows, spacing, typography } from './tokens';

export const lightColors = {
  background: palette.warm[100],
  surface: palette.white,
  surfaceSubtle: palette.warm[200],
  text: palette.warm[900],
  textMuted: palette.warm[700],
  primary: palette.indigo[500],
  primaryPressed: palette.indigo[600],
  onPrimary: palette.white,
  accent: palette.teal[600],
  accentSoft: palette.teal[50],
  success: palette.teal[600],
  warning: '#9A6215',
  danger: '#B83A45',
  onDanger: palette.white,
  border: palette.warm[300],
  divider: '#E8E3DC',
  tabBar: '#FFFDFC',
  focus: palette.indigo[400],
  overlay: 'rgba(17, 16, 21, 0.42)',
} as const;

export const darkColors: ColorTokens = {
  background: '#121116',
  surface: '#1C1B22',
  surfaceSubtle: '#27252E',
  text: '#F7F3EE',
  textMuted: '#B1ACB6',
  primary: '#9C99F5',
  primaryPressed: '#B2B0FF',
  onPrimary: '#1D1B4E',
  accent: palette.teal[400],
  accentSoft: '#163A36',
  success: '#65D5C1',
  warning: '#E4AE5E',
  danger: '#F08A92',
  onDanger: '#241216',
  border: '#383640',
  divider: '#302E37',
  tabBar: '#19181E',
  focus: '#B2B0FF',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export type ColorTokens = {
  [Key in keyof typeof lightColors]: string;
};

export type ColorToken = keyof ColorTokens;

export type AppTheme = {
  mode: 'light' | 'dark';
  isDark: boolean;
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  shadows: typeof shadows;
};

export const lightTheme: AppTheme = {
  mode: 'light',
  isDark: false,
  colors: lightColors,
  spacing,
  radii,
  typography,
  shadows,
};

export const darkTheme: AppTheme = {
  mode: 'dark',
  isDark: true,
  colors: darkColors,
  spacing,
  radii,
  typography,
  shadows,
};
