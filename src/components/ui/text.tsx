import {
  Text as NativeText,
  type TextProps as NativeTextProps,
  type TextStyle,
} from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import type { ColorToken } from '@/theme';
import type { TypographyVariant } from '@/theme/tokens';

export type TextProps = NativeTextProps & {
  variant?: TypographyVariant;
  tone?: ColorToken;
  align?: TextStyle['textAlign'];
};

export function Text({
  variant = 'body',
  tone = 'text',
  align,
  style,
  ...props
}: TextProps) {
  const theme = useAppTheme();

  return (
    <NativeText
      style={[
        theme.typography[variant],
        { color: theme.colors[tone], textAlign: align },
        style,
      ]}
      {...props}
    />
  );
}
