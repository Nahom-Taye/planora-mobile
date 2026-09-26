import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const palette = {
  violet: {
    50: '#F3EFFF',
    100: '#E9E2FF',
    400: '#8B66F2',
    500: '#5B2EE5',
    600: '#4A21C4',
    900: '#241356',
  },
  pink: {
    50: '#FDE7F1',
    400: '#FF8BC2',
    500: '#D6337F',
    600: '#B01A63',
  },
  lavender: {
    50: '#FBFAFF',
    100: '#F7F5FF',
    200: '#EEEAFB',
    300: '#DCD5F0',
    700: '#5C5680',
    900: '#17132B',
  },
  white: '#FFFFFF',
  black: '#0D0B1E',
} as const;

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  xxl: 40,
  xxxl: 56,
  huge: 64,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 26,
  pill: 999,
} as const;

const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
}) ?? 'System';

export type FontFamilies = {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
  display: string;
};

const systemFonts: FontFamilies = {
  regular: fontFamily,
  medium: fontFamily,
  semibold: fontFamily,
  bold: fontFamily,
  display: fontFamily,
};

export function typographyForFonts(fonts: FontFamilies) {
  return {
  display: {
    fontFamily: fonts.display,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '400',
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  overline: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 1.1,
  },
  } satisfies Record<string, TextStyle>;
}

export const typography = typographyForFonts(systemFonts);

export const shadows = {
  subtle: {
    shadowColor: palette.violet[900],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 2,
  },
  floating: {
    shadowColor: palette.violet[900],
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 8,
  },
} satisfies Record<string, ViewStyle>;

export type TypographyVariant = keyof typeof typography;
