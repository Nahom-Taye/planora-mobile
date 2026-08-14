import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import type {
  InsightsRange,
  InsightsView,
  Reflection,
} from '@/domain/entities';
import type { RepositoryStore } from '@/domain/repositories';
import { buildInsightExplanations } from '@/features/insights/services/explanation-rules';
import {
  aggregatePeriod,
  InsightsAggregationService,
  type InsightsData,
} from '@/features/insights/services/local-aggregation';
import { calculateInsightsRange } from '@/features/insights/services/range-calculations';
import {
  ReflectionService,
  ReflectionValidationError,
} from '@/features/insights/services/reflection-lifecycle';
import type { ReflectionDraft } from '@/features/insights/services/reflection-validation';
import { calculateTrendComparisons } from '@/features/insights/services/trend-comparisons';
import { PlanningPreferencesService } from '@/features/settings/services/planning-preferences-service';
import { localCalendarDate } from '@/features/today/services/local-date';
import { StorageError } from '@/storage/database/errors';

import { useLocalization } from './localization-provider';
import { useWorkspace } from './workspace-provider';

type MutationResult =
  | { ok: true; reflection?: Reflection }
  | { ok: false; fieldErrors?: Record<string, string> };

type InsightsContextValue = ReturnType<typeof useInsightsValue>;
const InsightsContext = createContext<InsightsContextValue | undefined>(
  undefined,
);

export function InsightsProvider({
  repositories,
  children,
}: PropsWithChildren<{ repositories: RepositoryStore | null }>) {
  const value = useInsightsValue(repositories);
  return (
    <InsightsContext.Provider value={value}>
      {children}
    </InsightsContext.Provider>
  );
}

function useInsightsValue(repositories: RepositoryStore | null) {
  const workspace = useWorkspace();
  const localization = useLocalization();
  const [data, setData] = useState<InsightsData | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'ready' | 'partial' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [selectedView, setSelectedView] = useState<InsightsView>('summary');
  const [selectedRange, setSelectedRange] = useState<InsightsRange>('7d');
  const operationActive = useRef(false);
  const hasData = useRef(false);
  const selection = useRef<{
    view: InsightsView;
    range: InsightsRange;
  }>({ view: 'summary', range: '7d' });
  const preferenceWrite = useRef<Promise<void>>(Promise.resolve());
  const aggregationService = useMemo(
    () => (repositories ? new InsightsAggregationService(repositories) : null),
    [repositories],
  );
  const reflectionService = useMemo(
    () => (repositories ? new ReflectionService(repositories) : null),
    [repositories],
  );
  const preferencesService = useMemo(
    () => (repositories ? new PlanningPreferencesService(repositories) : null),
    [repositories],
  );

  useEffect(() => {
    if (localization.settings) {
      setSelectedView(localization.settings.insightsView);
      setSelectedRange(localization.settings.insightsRange);
      selection.current = {
        view: localization.settings.insightsView,
        range: localization.settings.insightsRange,
      };
    }
  }, [localization.settings]);

  const refresh = useCallback(async () => {
    if (!aggregationService || !workspace.workspace) return;
    setStatus('loading');
    setErrorMessage(null);
    try {
      setData(await aggregationService.load(workspace.workspace.id));
      hasData.current = true;
      setStatus('ready');
    } catch {
      setStatus(hasData.current ? 'partial' : 'error');
      setErrorMessage(
        'Planora could not refresh insights. Saved local data is unchanged.',
      );
    }
  }, [aggregationService, workspace.workspace]);

  useEffect(() => {
    if (workspace.status === 'ready') void refresh();
    else {
      setData(null);
      hasData.current = false;
      setStatus('idle');
    }
  }, [refresh, workspace.status]);

  const profile = workspace.profile;
  const today = profile
    ? localCalendarDate(new Date(), profile.timeZone)
    : null;
  const snapshot = useMemo(() => {
    if (!data || !profile || !today) return null;
    const range = calculateInsightsRange(
      today,
      selectedRange,
      profile.weekStartsOn,
    );
    const capacityMinutes =
      localization.settings?.dailyPlanningCapacityMinutes ?? 480;
    const current = aggregatePeriod(
      data,
      range.current,
      today,
      profile.timeZone,
      profile.weekStartsOn,
      capacityMinutes,
    );
    const previous = aggregatePeriod(
      data,
      range.previous,
      today,
      profile.timeZone,
      profile.weekStartsOn,
      capacityMinutes,
    );
    const trends = calculateTrendComparisons(current, previous);
    return {
      range,
      current,
      previous,
      reflections: data.reflections,
      trends,
      explanations: buildInsightExplanations(current, trends),
    };
  }, [data, localization.settings, profile, selectedRange, today]);

  const persistSelection = useCallback(
    (view: InsightsView, range: InsightsRange) => {
      preferenceWrite.current = preferenceWrite.current.then(async () => {
        if (!preferencesService || !profile) return;
        try {
          const settings = await preferencesService.get(profile.id);
          if (!settings) return;
          await preferencesService.setInsightsPreferences(settings, view, range);
          await localization.refresh();
        } catch {
          await localization.refresh().catch(() => undefined);
        }
      });
      return preferenceWrite.current;
    },
    [localization, preferencesService, profile],
  );

  const selectView = useCallback(
    (view: InsightsView) => {
      setSelectedView(view);
      selection.current.view = view;
      void persistSelection(view, selection.current.range);
    },
    [persistSelection],
  );
  const selectRange = useCallback(
    (range: InsightsRange) => {
      setSelectedRange(range);
      selection.current.range = range;
      void persistSelection(selection.current.view, range);
    },
    [persistSelection],
  );

  const mutate = useCallback(
    async (operation: () => Promise<Reflection>): Promise<MutationResult> => {
      if (operationActive.current) return { ok: false };
      operationActive.current = true;
      setIsMutating(true);
      setErrorMessage(null);
      try {
        const reflection = await operation();
        await refresh();
        return { ok: true, reflection };
      } catch (error) {
        if (error instanceof ReflectionValidationError) {
          return { ok: false, fieldErrors: error.errors };
        }
        setErrorMessage(
          error instanceof StorageError && error.code === 'REVISION_CONFLICT'
            ? 'This reflection changed before your update was saved. Refresh and try again.'
            : 'That reflection change could not be saved. Refresh and try again.',
        );
        return { ok: false };
      } finally {
        operationActive.current = false;
        setIsMutating(false);
      }
    },
    [refresh],
  );

  const createReflection = useCallback(
    (draft: ReflectionDraft) =>
      workspace.workspace && profile && reflectionService
        ? mutate(() =>
            reflectionService.create(workspace.workspace!.id, profile, draft),
          )
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, profile, reflectionService, workspace.workspace],
  );
  const updateReflection = useCallback(
    (reflection: Reflection, draft: ReflectionDraft) =>
      profile && reflectionService
        ? mutate(() => reflectionService.update(reflection, profile, draft))
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, profile, reflectionService],
  );
  const deleteReflection = useCallback(
    (reflection: Reflection) =>
      reflectionService
        ? mutate(() => reflectionService.softDelete(reflection))
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, reflectionService],
  );

  return {
    status,
    errorMessage,
    isMutating,
    selectedView,
    selectedRange,
    snapshot,
    today,
    profile,
    goals: data?.goals ?? [],
    reflections: data?.reflections ?? [],
    refresh,
    selectView,
    selectRange,
    createReflection,
    updateReflection,
    deleteReflection,
    getReflection: (id: string) =>
      data?.reflections.find((reflection) => reflection.id === id) ?? null,
  };
}

export function useInsights() {
  const value = useContext(InsightsContext);
  if (!value) {
    throw new Error('useInsights must be used within InsightsProvider.');
  }
  return value;
}
