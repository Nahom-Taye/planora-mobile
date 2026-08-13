import type { AppSettings } from '../../../domain/entities/index.ts';
import { toInstant, toLocalTime, toTimeZone } from '../../../domain/entities/index.ts';
import type { RepositoryStore } from '../../../domain/repositories/contracts.ts';

export const CURRENT_ONBOARDING_VERSION = 1;

export type LocalProfileDefaults = {
  locale: string;
  timeZone: ReturnType<typeof toTimeZone>;
};

export class OnboardingService {
  constructor(
    private readonly repositories: RepositoryStore,
    private readonly now: () => Date = () => new Date(),
    private readonly defaults: () => LocalProfileDefaults =
      resolveLocalProfileDefaults,
  ) {}

  async getSettings() {
    const page = await this.repositories.appSettings.list({
      page: { limit: 1, offset: 0 },
    });
    return page.items[0] ?? null;
  }

  async isComplete() {
    return isOnboardingComplete(await this.getSettings());
  }

  async complete() {
    const existing = await this.getSettings();
    const completedAt = toInstant(this.now());

    if (existing) {
      return this.repositories.appSettings.update(existing.id, {
        expectedRevision: existing.revision,
        onboardingVersion: CURRENT_ONBOARDING_VERSION,
        onboardingCompletedAt: completedAt,
      });
    }

    const defaults = this.defaults();

    return this.repositories.transaction(async (repositories) => {
      const profile = await repositories.userProfiles.create({
        displayName: null,
        locale: defaults.locale,
        timeZone: defaults.timeZone,
        weekStartsOn: 1,
        accessibility: {
          reduceMotion: null,
          useBoldText: null,
          textScale: null,
        },
      });

      return repositories.appSettings.create({
        profileId: profile.id,
        themePreference: 'system',
        defaultTab: 'today',
        planningDayStartsAt: toLocalTime('06:00'),
        languagePreference: 'system',
        dailyPlanningCapacityMinutes: 480,
        plannerView: 'day',
        onboardingVersion: CURRENT_ONBOARDING_VERSION,
        onboardingCompletedAt: completedAt,
      });
    });
  }
}

export function isOnboardingComplete(settings: AppSettings | null) {
  return Boolean(
    settings?.onboardingCompletedAt &&
      settings.onboardingVersion >= CURRENT_ONBOARDING_VERSION,
  );
}

export function resolveLocalProfileDefaults(): LocalProfileDefaults {
  const resolved = new Intl.DateTimeFormat().resolvedOptions();
  let timeZone: ReturnType<typeof toTimeZone>;

  try {
    timeZone = toTimeZone(resolved.timeZone || 'UTC');
  } catch {
    timeZone = toTimeZone('UTC');
  }

  return {
    locale: resolved.locale || 'en-US',
    timeZone,
  };
}
