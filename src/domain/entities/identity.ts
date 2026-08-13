import type {
  EntityId,
  EntityMetadata,
  Instant,
  LocalTime,
  TimeZone,
  Weekday,
} from './common';

export type AccessibilityPreferences = {
  reduceMotion: boolean | null;
  useBoldText: boolean | null;
  textScale: number | null;
};

export type UserProfile = EntityMetadata & {
  displayName: string | null;
  locale: string;
  timeZone: TimeZone;
  weekStartsOn: Weekday;
  accessibility: AccessibilityPreferences;
};

export type WorkspaceStatus = 'active' | 'archived';

export type Workspace = EntityMetadata & {
  profileId: EntityId;
  name: string;
  kind: 'personal';
  status: WorkspaceStatus;
};

export type ThemePreference = 'system' | 'light' | 'dark';
export type DefaultTab = 'today' | 'planner' | 'goals' | 'insights';
export type LanguagePreference = 'system' | 'en' | 'am' | 'es' | 'fr' | 'ar';
export type PlannerView = 'day' | 'week';

export type AppSettings = EntityMetadata & {
  profileId: EntityId;
  themePreference: ThemePreference;
  defaultTab: DefaultTab;
  planningDayStartsAt: LocalTime;
  languagePreference: LanguagePreference;
  dailyPlanningCapacityMinutes: number;
  plannerView: PlannerView;
  onboardingVersion: number;
  onboardingCompletedAt: Instant | null;
};
