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
  CalendarDate,
  PlanBlock,
  PlanBlockSeries,
  PlannerView,
  Task,
} from '@/domain/entities';
import type { RepositoryStore } from '@/domain/repositories';
import { calculateCapacity } from '@/features/planner/services/capacity';
import {
  addCalendarDays,
  startOfLocalWeek,
} from '@/features/planner/services/calendar-math';
import {
  PlanBlockService,
  PlanBlockValidationError,
  revisionConflictMessage,
} from '@/features/planner/services/plan-block-service';
import type { PlanBlockDraft } from '@/features/planner/services/plan-block-validation';
import {
  blocksForDate,
  weekSummaries,
} from '@/features/planner/services/planner-organization';
import {
  RecurrenceService,
  type RecurrenceDraft,
} from '@/features/planner/services/recurrence';
import { PlanningPreferencesService } from '@/features/settings/services/planning-preferences-service';

import { useLocalization } from './localization-provider';
import { usePlanning } from './planning-provider';
import { useWorkspace } from './workspace-provider';

type MutationResult =
  | { ok: true; overlapCount?: number }
  | { ok: false; fieldErrors?: Record<string, string> };

type PlannerContextValue = ReturnType<typeof usePlannerValue>;
const PlannerContext = createContext<PlannerContextValue | undefined>(undefined);

export function PlannerProvider({
  children,
  repositories,
}: PropsWithChildren<{ repositories: RepositoryStore | null }>) {
  const value = usePlannerValue(repositories);
  return (
    <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
  );
}

function usePlannerValue(repositories: RepositoryStore | null) {
  const workspace = useWorkspace();
  const planning = usePlanning();
  const localization = useLocalization();
  const [blocks, setBlocks] = useState<PlanBlock[]>([]);
  const [series, setSeries] = useState<PlanBlockSeries[]>([]);
  const [selectedDate, setSelectedDate] = useState<CalendarDate | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const operationActive = useRef(false);
  const blockService = useMemo(
    () => (repositories ? new PlanBlockService(repositories) : null),
    [repositories],
  );
  const recurrenceService = useMemo(
    () => (repositories ? new RecurrenceService(repositories) : null),
    [repositories],
  );
  const preferencesService = useMemo(
    () => (repositories ? new PlanningPreferencesService(repositories) : null),
    [repositories],
  );
  const today = planning.today;

  useEffect(() => {
    if (today && !selectedDate) setSelectedDate(today);
  }, [selectedDate, today]);

  const refresh = useCallback(async () => {
    if (
      !blockService ||
      !recurrenceService ||
      !repositories ||
      !workspace.workspace ||
      !today
    ) {
      return;
    }
    setStatus('loading');
    setErrorMessage(null);
    try {
      await recurrenceService.materializeWindow(
        workspace.workspace.id,
        today,
        addCalendarDays(today, 55),
      );
      const [nextBlocks, nextSeries] = await Promise.all([
        blockService.list(workspace.workspace.id),
        listAllSeries(repositories, workspace.workspace.id),
      ]);
      setBlocks(nextBlocks);
      setSeries(nextSeries);
      setStatus('ready');
    } catch {
      setStatus('error');
      setErrorMessage('Your schedule could not be refreshed. Saved local data is unchanged.');
    }
  }, [blockService, recurrenceService, repositories, today, workspace.workspace]);

  useEffect(() => {
    if (workspace.status === 'ready') void refresh();
    else setStatus('idle');
  }, [refresh, workspace.status]);

  const mutate = useCallback(
    async (operation: () => Promise<unknown>): Promise<MutationResult> => {
      if (operationActive.current) return { ok: false };
      operationActive.current = true;
      setIsMutating(true);
      setErrorMessage(null);
      try {
        await operation();
        await refresh();
        return { ok: true };
      } catch (error) {
        if (error instanceof PlanBlockValidationError) {
          return { ok: false, fieldErrors: error.errors };
        }
        setErrorMessage(
          revisionConflictMessage(error)
            ? 'This schedule changed before your update was saved. Refresh and try again.'
            : 'That schedule change could not be saved. Refresh and try again.',
        );
        return { ok: false };
      } finally {
        operationActive.current = false;
        setIsMutating(false);
      }
    },
    [refresh],
  );

  const activeWorkspace = workspace.workspace;
  const profile = workspace.profile;
  const createBlock = useCallback(
    (draft: PlanBlockDraft) =>
      activeWorkspace && profile && blockService
        ? mutate(() =>
            blockService.create(activeWorkspace.id, draft, profile.timeZone),
          )
        : Promise.resolve<MutationResult>({ ok: false }),
    [activeWorkspace, blockService, mutate, profile],
  );
  const scheduleTask = useCallback(
    (task: Task, draft: Parameters<PlanBlockService['scheduleTask']>[2]) =>
      activeWorkspace && profile && blockService
        ? mutate(() =>
            blockService.scheduleTask(
              activeWorkspace.id,
              task,
              draft,
              profile.timeZone,
            ),
          )
        : Promise.resolve<MutationResult>({ ok: false }),
    [activeWorkspace, blockService, mutate, profile],
  );
  const updateBlock = useCallback(
    (block: PlanBlock, draft: PlanBlockDraft) =>
      profile && blockService
        ? mutate(() => blockService.update(block, draft, profile.timeZone))
        : Promise.resolve<MutationResult>({ ok: false }),
    [blockService, mutate, profile],
  );
  const actOnBlock = useCallback(
    (
      block: PlanBlock,
      action: 'complete' | 'reopen' | 'cancel' | 'delete' | 'unlink',
    ) =>
      blockService
        ? mutate(() =>
            action === 'complete'
              ? blockService.complete(block)
              : action === 'reopen'
                ? blockService.reopen(block)
                : action === 'cancel'
                  ? blockService.cancel(block)
                  : action === 'unlink'
                    ? blockService.unlink(block)
                    : blockService.softDelete(block),
          )
        : Promise.resolve<MutationResult>({ ok: false }),
    [blockService, mutate],
  );
  const createRecurrence = useCallback(
    (draft: RecurrenceDraft) =>
      activeWorkspace && profile && recurrenceService
        ? mutate(() =>
            recurrenceService.create(
              activeWorkspace.id,
              draft,
              profile.timeZone,
            ),
          )
        : Promise.resolve<MutationResult>({ ok: false }),
    [activeWorkspace, mutate, profile, recurrenceService],
  );
  const editFuture = useCallback(
    (
      recurrence: PlanBlockSeries,
      draft: RecurrenceDraft,
      effectiveDate: CalendarDate,
    ) =>
      profile && recurrenceService
        ? mutate(() =>
            recurrenceService.editFuture(
              recurrence,
              draft,
              effectiveDate,
              profile.timeZone,
            ),
          )
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, profile, recurrenceService],
  );

  const view = localization.settings?.plannerView ?? 'day';
  const setView = useCallback(
    async (next: PlannerView) => {
      if (!preferencesService || !profile) return false;
      const current = await preferencesService.get(profile.id);
      if (!current) return false;
      try {
        await preferencesService.setPlannerView(current, next);
        await localization.refresh();
        return true;
      } catch {
        await localization.refresh();
        return false;
      }
    },
    [localization, preferencesService, profile],
  );
  const capacityMinutes =
    localization.settings?.dailyPlanningCapacityMinutes ?? 480;
  const selected = selectedDate ?? today;
  const selectedBlocks = selected ? blocksForDate(blocks, selected) : [];
  const capacity =
    selected && profile
      ? calculateCapacity(
          selectedBlocks,
          planning.tasks,
          capacityMinutes,
          profile.timeZone,
        )
      : null;
  const summaries =
    selected && profile
      ? weekSummaries(
          selected,
          profile.weekStartsOn,
          blocks,
          planning.tasks,
          capacityMinutes,
          profile.timeZone,
        )
      : [];
  const linkedTaskIds = new Set(
    blocks.flatMap((block) =>
      block.taskId && block.status !== 'cancelled' ? [block.taskId] : [],
    ),
  );

  return {
    status,
    errorMessage,
    isMutating,
    view,
    selectedDate: selected,
    today,
    blocks,
    selectedBlocks,
    series,
    capacityMinutes,
    capacity,
    weekSummaries: summaries,
    unscheduledTasks: planning.tasks.filter(
      (task) =>
        (task.status === 'pending' || task.status === 'in_progress') &&
        !linkedTaskIds.has(task.id),
    ),
    refresh,
    selectDate: setSelectedDate,
    selectToday: () => today && setSelectedDate(today),
    moveDate: (days: number) =>
      selected && setSelectedDate(addCalendarDays(selected, days)),
    moveWeek: (weeks: number) =>
      selected && setSelectedDate(addCalendarDays(selected, weeks * 7)),
    weekStart:
      selected && profile
        ? startOfLocalWeek(selected, profile.weekStartsOn)
        : null,
    setView,
    createBlock,
    scheduleTask,
    updateBlock,
    completeBlock: (block: PlanBlock) => actOnBlock(block, 'complete'),
    reopenBlock: (block: PlanBlock) => actOnBlock(block, 'reopen'),
    cancelBlock: (block: PlanBlock) => actOnBlock(block, 'cancel'),
    deleteBlock: (block: PlanBlock) => actOnBlock(block, 'delete'),
    unlinkBlock: (block: PlanBlock) => actOnBlock(block, 'unlink'),
    createRecurrence,
    editFuture,
    getBlock: (id: string) => blocks.find((block) => block.id === id) ?? null,
    getSeries: (id: string) =>
      series.find((item) => item.id === id) ?? null,
  };
}

async function listAllSeries(
  repositories: RepositoryStore,
  workspaceId: string,
) {
  const series: PlanBlockSeries[] = [];
  let offset = 0;
  while (true) {
    const page = await repositories.planBlockSeries.list({
      filter: { workspaceId },
      page: { limit: 100, offset },
    });
    series.push(...page.items);
    if (page.nextOffset === null) return series;
    offset = page.nextOffset;
  }
}

export function usePlanner() {
  const value = useContext(PlannerContext);
  if (!value) throw new Error('usePlanner must be used within PlannerProvider.');
  return value;
}
