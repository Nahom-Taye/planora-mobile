import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type AppTheme } from './themes';
import { typographyForFonts } from './tokens';
import { useLocalization } from '../providers/localization-provider';

const ThemeContext = createContext<AppTheme | undefined>(undefined);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme();
  const localization = useLocalization();
  const theme = useMemo(() => {
    const base = colorScheme === 'dark' ? darkTheme : lightTheme;
    return {
      ...base,
      typography: typographyForFonts(localization.fontFamilies),
    };
  }, [colorScheme, localization.fontFamilies]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error('useAppTheme must be used within AppThemeProvider.');
  }

  return theme;
}
