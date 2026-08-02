import { createContext, useContext, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type AppTheme } from './themes';

const ThemeContext = createContext<AppTheme | undefined>(undefined);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const theme = useContext(ThemeContext);

  if (!theme) {
    throw new Error('useAppTheme must be used within AppThemeProvider.');
  }

  return theme;
}
