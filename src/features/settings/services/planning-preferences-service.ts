import type {
  AppSettings,
  InsightsRange,
  InsightsView,
  LanguagePreference,
  PlannerView,
} from '../../../domain/entities/index.ts';
import type { RepositoryStore } from '../../../domain/repositories/contracts.ts';

export const DEFAULT_DAILY_CAPACITY_MINUTES = 480;

export class PlanningPreferencesService {
  constructor(private readonly repositories: RepositoryStore) {}

  async get(profileId: string) {
    const page = await this.repositories.appSettings.list({
      filter: { profileId },
      page: { limit: 1, offset: 0 },
    });
    return page.items[0] ?? null;
  }

  async setLanguage(
    settings: AppSettings,
    languagePreference: LanguagePreference,
  ) {
    return this.repositories.appSettings.update(settings.id, {
      expectedRevision: settings.revision,
      languagePreference,
    });
  }

  async setCapacity(settings: AppSettings, minutes: number) {
    if (!Number.isInteger(minutes) || minutes < 30 || minutes > 1440) {
      throw new PlanningPreferenceError('capacity');
    }
    return this.repositories.appSettings.update(settings.id, {
      expectedRevision: settings.revision,
      dailyPlanningCapacityMinutes: minutes,
    });
  }

  async setPlannerView(settings: AppSettings, plannerView: PlannerView) {
    return this.repositories.appSettings.update(settings.id, {
      expectedRevision: settings.revision,
      plannerView,
    });
  }

  async setInsightsPreferences(
    settings: AppSettings,
    insightsView: InsightsView,
    insightsRange: InsightsRange,
  ) {
    return this.repositories.appSettings.update(settings.id, {
      expectedRevision: settings.revision,
      insightsView,
      insightsRange,
    });
  }
}

export class PlanningPreferenceError extends Error {
  constructor(readonly field: 'capacity') {
    super('Planning preferences need attention.');
  }
}
