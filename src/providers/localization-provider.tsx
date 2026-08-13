import { NotoSans_400Regular } from '@expo-google-fonts/noto-sans/400Regular';
import { NotoSans_500Medium } from '@expo-google-fonts/noto-sans/500Medium';
import { NotoSans_600SemiBold } from '@expo-google-fonts/noto-sans/600SemiBold';
import { NotoSans_700Bold } from '@expo-google-fonts/noto-sans/700Bold';
import { NotoSansArabic_400Regular } from '@expo-google-fonts/noto-sans-arabic/400Regular';
import { NotoSansArabic_500Medium } from '@expo-google-fonts/noto-sans-arabic/500Medium';
import { NotoSansArabic_600SemiBold } from '@expo-google-fonts/noto-sans-arabic/600SemiBold';
import { NotoSansArabic_700Bold } from '@expo-google-fonts/noto-sans-arabic/700Bold';
import { NotoSansEthiopic_400Regular } from '@expo-google-fonts/noto-sans-ethiopic/400Regular';
import { NotoSansEthiopic_500Medium } from '@expo-google-fonts/noto-sans-ethiopic/500Medium';
import { NotoSansEthiopic_600SemiBold } from '@expo-google-fonts/noto-sans-ethiopic/600SemiBold';
import { NotoSansEthiopic_700Bold } from '@expo-google-fonts/noto-sans-ethiopic/700Bold';
import { useFonts } from 'expo-font';
import { getLocales } from 'expo-localization';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, I18nManager, Platform } from 'react-native';

import type {
  AppSettings,
  LanguagePreference,
} from '@/domain/entities';
import type { RepositoryStore } from '@/domain/repositories';
import {
  createTranslator,
  directionForLanguage,
  formatCalendarDateValue,
  formatDurationValue,
  formatLocalizedList,
  formatLocalTimeValue,
  formatNumberValue,
  resolveLanguage,
  translateKnownMessage,
  type SupportedLanguage,
} from '@/features/localization/localization';
import { PlanningPreferencesService } from '@/features/settings/services/planning-preferences-service';

type FontFamilies = {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
};

type LocalizationContextValue = {
  language: SupportedLanguage;
  locale: string;
  direction: 'ltr' | 'rtl';
  isRTL: boolean;
  requiresDirectionRestart: boolean;
  fontsReady: boolean;
  fontFamilies: FontFamilies;
  settings: AppSettings | null;
  t: ReturnType<typeof createTranslator>;
  message: (value: string | null | undefined) => string;
  formatDate: (date: string, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (time: string) => string;
  formatNumber: (value: number) => string;
  formatDuration: (minutes: number) => string;
  formatList: (items: readonly string[]) => string;
  setLanguage: (preference: LanguagePreference) => Promise<boolean>;
  refresh: () => Promise<void>;
};

const LocalizationContext = createContext<LocalizationContextValue | undefined>(
  undefined,
);

export function LocalizationProvider({
  children,
  repositories,
}: PropsWithChildren<{ repositories: RepositoryStore | null }>) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [deviceLanguage, setDeviceLanguage] = useState(deviceLanguageCode);
  const [requiresDirectionRestart, setRequiresDirectionRestart] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    PlanoraLatinRegular: NotoSans_400Regular,
    PlanoraLatinMedium: NotoSans_500Medium,
    PlanoraLatinSemibold: NotoSans_600SemiBold,
    PlanoraLatinBold: NotoSans_700Bold,
    PlanoraArabicRegular: NotoSansArabic_400Regular,
    PlanoraArabicMedium: NotoSansArabic_500Medium,
    PlanoraArabicSemibold: NotoSansArabic_600SemiBold,
    PlanoraArabicBold: NotoSansArabic_700Bold,
    PlanoraEthiopicRegular: NotoSansEthiopic_400Regular,
    PlanoraEthiopicMedium: NotoSansEthiopic_500Medium,
    PlanoraEthiopicSemibold: NotoSansEthiopic_600SemiBold,
    PlanoraEthiopicBold: NotoSansEthiopic_700Bold,
  });
  const service = useMemo(
    () => (repositories ? new PlanningPreferencesService(repositories) : null),
    [repositories],
  );

  const refresh = useCallback(async () => {
    if (!repositories) return;
    const page = await repositories.appSettings.list({
      page: { limit: 1, offset: 0 },
    });
    setSettings(page.items[0] ?? null);
  }, [repositories]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && settings?.languagePreference === 'system') {
        setDeviceLanguage(deviceLanguageCode());
      }
    });
    return () => subscription.remove();
  }, [settings?.languagePreference]);

  const language = resolveLanguage(
    settings?.languagePreference ?? 'system',
    deviceLanguage,
  );
  const direction = directionForLanguage(language);
  const isRTL = direction === 'rtl';
  const locale = localeForLanguage(language);
  const t = useMemo(() => createTranslator(language), [language]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') {
        document.documentElement.dir = direction;
        document.documentElement.lang = language;
      }
      setRequiresDirectionRestart(false);
      return;
    }
    I18nManager.allowRTL(true);
    const directionChanged = I18nManager.isRTL !== isRTL;
    setRequiresDirectionRestart(directionChanged);
    if (directionChanged) I18nManager.forceRTL(isRTL);
  }, [direction, isRTL, language]);

  const setLanguage = useCallback(
    async (preference: LanguagePreference) => {
      if (!service || !settings) return false;
      try {
        const updated = await service.setLanguage(settings, preference);
        setSettings(updated);
        if (preference === 'system') setDeviceLanguage(deviceLanguageCode());
        return true;
      } catch {
        await refresh();
        return false;
      }
    },
    [refresh, service, settings],
  );

  const fontFamilies = useMemo(() => fontsForLanguage(language), [language]);
  const value = useMemo<LocalizationContextValue>(
    () => ({
      language,
      locale,
      direction,
      isRTL,
      requiresDirectionRestart,
      fontsReady: fontsLoaded || Boolean(fontError),
      fontFamilies,
      settings,
      t,
      message: (message) => translateKnownMessage(t, message),
      formatDate: (date, options = { weekday: 'long', month: 'long', day: 'numeric' }) =>
        formatCalendarDateValue(date, locale, options),
      formatTime: (time) => formatLocalTimeValue(time, locale),
      formatNumber: (number) => formatNumberValue(number, locale),
      formatDuration: (minutes) => formatDurationValue(minutes, locale, t),
      formatList: (items) => formatLocalizedList(items, locale),
      setLanguage,
      refresh,
    }),
    [direction, fontError, fontFamilies, fontsLoaded, isRTL, language, locale, refresh, requiresDirectionRestart, setLanguage, settings, t],
  );

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const value = useContext(LocalizationContext);
  if (!value) {
    throw new Error('useLocalization must be used within LocalizationProvider.');
  }
  return value;
}

function deviceLanguageCode() {
  return getLocales()[0]?.languageCode ?? 'en';
}

function localeForLanguage(language: SupportedLanguage) {
  if (language === 'am') return 'am-ET';
  if (language === 'ar') return 'ar';
  if (language === 'es') return 'es';
  if (language === 'fr') return 'fr';
  return 'en';
}

function fontsForLanguage(language: SupportedLanguage): FontFamilies {
  const prefix =
    language === 'am'
      ? 'PlanoraEthiopic'
      : language === 'ar'
        ? 'PlanoraArabic'
        : 'PlanoraLatin';
  return {
    regular: `${prefix}Regular`,
    medium: `${prefix}Medium`,
    semibold: `${prefix}Semibold`,
    bold: `${prefix}Bold`,
  };
}
