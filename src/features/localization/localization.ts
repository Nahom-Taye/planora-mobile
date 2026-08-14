import { I18n } from 'i18n-js';

import type { LanguagePreference } from '../../domain/entities/index.ts';
import { am } from './catalog-am.ts';
import { ar } from './catalog-ar.ts';
import { es } from './catalog-es.ts';
import { fr } from './catalog-fr.ts';
import { en, type TranslationCatalog, type TranslationKey } from './catalogs.ts';

export const supportedLanguages = ['en', 'am', 'es', 'fr', 'ar'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageNames: Record<SupportedLanguage, string> = {
  en: 'English',
  am: 'አማርኛ',
  es: 'Español',
  fr: 'Français',
  ar: 'العربية',
};

type LocalizedListPattern = {
  pairSeparator: string;
  separator: string;
  finalSeparator: string;
};

const localizedListPatterns: Record<SupportedLanguage, LocalizedListPattern> = {
  en: { pairSeparator: ' and ', separator: ', ', finalSeparator: ', and ' },
  am: { pairSeparator: ' እና ', separator: '፣ ', finalSeparator: ' እና ' },
  es: { pairSeparator: ' y ', separator: ', ', finalSeparator: ' y ' },
  fr: { pairSeparator: ' et ', separator: ', ', finalSeparator: ' et ' },
  ar: { pairSeparator: ' و', separator: '، ', finalSeparator: ' و' },
};

export const translationCatalogs = { en, am, es, fr, ar } satisfies Record<
  SupportedLanguage,
  TranslationCatalog
>;

const messageKeys = new Map<string, TranslationKey>([
  ['Enter a task title.', 'validation.taskTitle'],
  ['Enter a block title.', 'validation.blockTitle'],
  ['Enter a routine title.', 'validation.routineTitle'],
  ['Enter a goal title.', 'validation.goalTitle'],
  ['Enter a milestone title.', 'validation.milestoneTitle'],
  ['Enter a whole percentage from 0 through 100.', 'validation.percentage'],
  ['Choose an active area from this workspace.', 'validation.activeArea'],
  ['Choose an available goal from this workspace.', 'validation.availableGoal'],
  ['Use 200 characters or fewer.', 'validation.titleLength'],
  ['Use 4,000 characters or fewer.', 'validation.notesLength'],
  ['Use a valid date in YYYY-MM-DD format.', 'validation.date'],
  ['Use a valid start date.', 'validation.startDate'],
  ['Use a valid end date.', 'validation.endDate'],
  ['Use a valid time in HH:MM format.', 'validation.time'],
  ['Use a valid start time in HH:MM format.', 'validation.startTime'],
  ['Use a valid end time in HH:MM format.', 'validation.endTime'],
  ['Use a valid start time.', 'validation.startTime'],
  ['Use a valid end time.', 'validation.endTime'],
  ['End time must be after start time.', 'validation.endAfterStart'],
  ['Choose a local time that exists on this date.', 'validation.nonexistentTime'],
  ['Choose a due date for a scheduled time.', 'validation.scheduledNeedsDate'],
  ['Choose at least one weekday.', 'validation.weekdays'],
  ['Repeat interval must be between 1 and 365.', 'validation.interval'],
  ['Enter your email address.', 'validation.emailRequired'],
  ['Enter a complete email address.', 'validation.emailComplete'],
  ['Enter your password.', 'validation.passwordRequired'],
  ['Use at least eight characters.', 'validation.passwordLength'],
  ['Enter a display name.', 'validation.displayNameRequired'],
  ['Use 60 characters or fewer.', 'validation.displayNameLength'],
  ['Passwords do not match.', 'validation.passwordsMatch'],
  ['The email or password was not accepted. Check both and try again.', 'errors.invalidCredentials'],
  ['Confirm your email before signing in, then try again.', 'errors.emailUnverified'],
  ['This email cannot be used for a new account. Try signing in instead.', 'errors.emailInUse'],
  ['Choose a stronger password with at least eight characters.', 'errors.weakPassword'],
  ['Planora could not reach the account service. Check your connection and try again.', 'errors.networkUnavailable'],
  ['Too many attempts were made. Wait a moment, then try again.', 'errors.rateLimited'],
  ['This recovery link is no longer valid. Request a new link and try again.', 'errors.expiredLink'],
  ['Account services are temporarily unavailable. Your local data is unaffected.', 'errors.serviceUnavailable'],
  ['Something went wrong with the account request. Your local data is unaffected.', 'errors.accountUnknown'],
  ['Choose an available task from this workspace.', 'errors.linkTask'],
  ['Choose an available routine from this workspace.', 'errors.linkRoutine'],
  ['Link either a task or a routine, not both.', 'errors.linkEither'],
  ['End date cannot be before the start date.', 'errors.endBeforeStart'],
  ['This recurrence changed. Refresh and try again.', 'errors.recurrenceConflict'],
  ['Recurrence windows are limited to 56 days.', 'errors.recurrenceWindow'],
  ['Your schedule could not be refreshed. Saved local data is unchanged.', 'errors.scheduleRefresh'],
  ['This schedule changed before your update was saved. Refresh and try again.', 'errors.scheduleRevision'],
  ['That schedule change could not be saved. Refresh and try again.', 'errors.scheduleSave'],
  ['Planora could not refresh this day. Your saved local data is unchanged.', 'errors.refreshDay'],
  ['Planora could not refresh goals. Saved local data is unchanged.', 'errors.goalsRefresh'],
  ['This goal changed before your update was saved. Refresh and try again.', 'errors.goalRevision'],
  ['That goal change could not be saved. Refresh and try again.', 'errors.goalSave'],
  ['The goal is no longer available.', 'errors.goalUnavailable'],
  ['Only actionable tasks can be linked.', 'errors.goalTaskActionable'],
  ['This task already supports another goal.', 'errors.goalTaskOwned'],
  ['This task is not linked to the goal.', 'errors.goalTaskMissing'],
  ['Choose an actionable task linked to this goal.', 'errors.goalNextAction'],
  ['Choose an active routine from this workspace.', 'errors.goalRoutineActive'],
  ['This item changed before your update was saved. Refresh and try again.', 'errors.revision'],
  ['That change could not be saved. Refresh the day and try again.', 'errors.save'],
  ['Planora could not read onboarding preferences. Your local data is still available.', 'errors.onboardingRead'],
  ['Planora could not save this preference. Please try again.', 'errors.onboardingSave'],
  ['Planora could not prepare your local planning space. Your data has not been changed.', 'errors.workspace'],
  ['Wait a moment and try again.', 'errors.generic'],
]);

export function createTranslator(language: SupportedLanguage) {
  const i18n = new I18n(translationCatalogs);
  i18n.defaultLocale = 'en';
  i18n.enableFallback = true;
  i18n.locale = language;

  return (
    key: TranslationKey,
    values: Record<string, string | number> = {},
  ) => {
    const translated = i18n.t(key, values);
    if (translated === key || translated.includes('[missing')) {
      return valueAtKey(en, key) ?? '';
    }
    return translated;
  };
}

export function resolveLanguage(
  preference: LanguagePreference,
  deviceLanguage: string | null | undefined,
): SupportedLanguage {
  if (preference !== 'system') return preference;
  const language = deviceLanguage?.toLowerCase().split(/[-_]/)[0];
  return supportedLanguages.includes(language as SupportedLanguage)
    ? (language as SupportedLanguage)
    : 'en';
}

export function directionForLanguage(language: SupportedLanguage) {
  return language === 'ar' ? 'rtl' : 'ltr';
}

export function translateKnownMessage(
  translate: ReturnType<typeof createTranslator>,
  message: string | null | undefined,
) {
  if (!message) return '';
  const key = messageKeys.get(message);
  return key ? translate(key) : message;
}

export function formatCalendarDateValue(
  date: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(
    new Date(Date.UTC(year, month - 1, day, 12)),
  );
}

export function formatLocalTimeValue(time: string, locale: string) {
  const [hour, minute] = time.split(':').map(Number);
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

export function formatNumberValue(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatPercentageValue(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function formatLocalizedList(items: readonly string[], locale: string) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  const pattern = localizedListPatterns[supportedLanguageForLocale(locale)];
  if (items.length === 2) return `${items[0]}${pattern.pairSeparator}${items[1]}`;
  return `${items.slice(0, -1).join(pattern.separator)}${pattern.finalSeparator}${items[items.length - 1]}`;
}

export function formatDurationValue(
  minutes: number,
  locale: string,
  translate: ReturnType<typeof createTranslator>,
) {
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const remainder = absolute % 60;
  const parts: string[] = [];
  if (hours) {
    parts.push(
      translate(hours === 1 ? 'common.hourOne' : 'common.hourOther', {
        count: formatNumberValue(hours, locale),
      }),
    );
  }
  if (remainder || !hours) {
    parts.push(
      translate(remainder === 1 ? 'common.minuteOne' : 'common.minuteOther', {
        count: formatNumberValue(remainder, locale),
      }),
    );
  }
  return formatLocalizedList(parts, locale);
}

export function pluralTranslationKey(
  language: SupportedLanguage,
  count: number,
  one: TranslationKey,
  other: TranslationKey,
) {
  if (typeof Intl.PluralRules === 'function') {
    try {
      return new Intl.PluralRules(language).select(count) === 'one' ? one : other;
    } catch {
      return count === 1 ? one : other;
    }
  }
  return count === 1 ? one : other;
}

function supportedLanguageForLocale(locale: string): SupportedLanguage {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return supportedLanguages.includes(language as SupportedLanguage)
    ? (language as SupportedLanguage)
    : 'en';
}

function valueAtKey(catalog: TranslationCatalog, key: TranslationKey) {
  const [section, item] = key.split('.') as [keyof TranslationCatalog, string];
  const value = catalog[section] as Record<string, string>;
  return value[item];
}
