import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const palette = {
  indigo: {
    50: '#F0EFFF',
    100: '#E2E1FF',
    400: '#7774E8',
    500: '#5B57D9',
    600: '#4844BA',
    900: '#252354',
  },
  teal: {
    50: '#DDF5F0',
    400: '#4FD0BC',
    500: '#159D8B',
    600: '#117D70',
  },
  warm: {
    50: '#FCFAF7',
    100: '#F8F6F2',
    200: '#F0ECE6',
    300: '#DED9D1',
    700: '#66636B',
    900: '#25242B',
  },
  white: '#FFFFFF',
  black: '#111015',
} as const;

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
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
};

const systemFonts: FontFamilies = {
  regular: fontFamily,
  medium: fontFamily,
  semibold: fontFamily,
  bold: fontFamily,
};

export function typographyForFonts(fonts: FontFamilies) {
  return {
  display: {
    fontFamily: fonts.bold,
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.45,
  },
  heading: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  caption: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  overline: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  } satisfies Record<string, TextStyle>;
}

export const typography = typographyForFonts(systemFonts);

export const shadows = {
  subtle: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  floating: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
} satisfies Record<string, ViewStyle>;

export type TypographyVariant = keyof typeof typography;
