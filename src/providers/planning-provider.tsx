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
  Routine,
  Task,
} from '@/domain/entities';
import type { RepositoryStore } from '@/domain/repositories';
import {
  RoutineService,
  RoutineValidationError,
} from '@/features/routines/services/routine-service';
import type { RoutineDraft } from '@/features/routines/services/routine-validation';
import {
  TaskService,
  TaskValidationError,
} from '@/features/tasks/services/task-service';
import type { TaskDraft } from '@/features/tasks/services/task-validation';
import { localCalendarDate } from '@/features/today/services/local-date';
import { buildTodayPlan } from '@/features/today/services/today-planning';
import { StorageError } from '@/storage/database/errors';

import { useWorkspace } from './workspace-provider';

type MutationResult =
  | { ok: true }
  | { ok: false; fieldErrors?: Record<string, string> };

type PlanningContextValue = ReturnType<typeof usePlanningValue>;
const PlanningContext = createContext<PlanningContextValue | undefined>(
  undefined,
);

type PlanningProviderProps = PropsWithChildren<{
  repositories: RepositoryStore | null;
}>;

export function PlanningProvider({
  repositories,
  children,
}: PlanningProviderProps) {
  const value = usePlanningValue(repositories);
  return (
    <PlanningContext.Provider value={value}>
      {children}
    </PlanningContext.Provider>
  );
}

function usePlanningValue(repositories: RepositoryStore | null) {
  const localWorkspace = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [checkIns, setCheckIns] = useState<Awaited<ReturnType<RoutineService['listCheckIns']>>>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const operationActive = useRef(false);
  const taskService = useMemo(
    () => (repositories ? new TaskService(repositories) : null),
    [repositories],
  );
  const routineService = useMemo(
    () => (repositories ? new RoutineService(repositories) : null),
    [repositories],
  );
  const today = localWorkspace.profile
    ? localCalendarDate(new Date(), localWorkspace.profile.timeZone)
    : null;

  const refresh = useCallback(async () => {
    if (
      !taskService ||
      !routineService ||
      !localWorkspace.workspace ||
      !today
    ) {
      return;
    }

    setStatus('loading');
    setErrorMessage(null);
    try {
      const [nextTasks, nextRoutines, nextCheckIns] = await Promise.all([
        taskService.list(localWorkspace.workspace.id),
        routineService.list(localWorkspace.workspace.id),
        routineService.listCheckIns(localWorkspace.workspace.id, today),
      ]);
      setTasks(nextTasks);
      setRoutines(nextRoutines);
      setCheckIns(nextCheckIns);
      setHasLoaded(true);
      setStatus('ready');
    } catch {
      setStatus('error');
      setErrorMessage(
        'Planora could not refresh this day. Your saved local data is unchanged.',
      );
    }
  }, [localWorkspace.workspace, routineService, taskService, today]);

  useEffect(() => {
    if (localWorkspace.status === 'ready') void refresh();
    else {
      setHasLoaded(false);
      setStatus('idle');
    }
  }, [localWorkspace.status, refresh]);

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
        if (
          error instanceof TaskValidationError ||
          error instanceof RoutineValidationError
        ) {
          return { ok: false, fieldErrors: error.errors };
        }
        setErrorMessage(
          error instanceof StorageError && error.code === 'REVISION_CONFLICT'
            ? 'This item changed before your update was saved. Refresh and try again.'
            : 'That change could not be saved. Refresh the day and try again.',
        );
        return { ok: false };
      } finally {
        operationActive.current = false;
        setIsMutating(false);
      }
    },
    [refresh],
  );

  const workspace = localWorkspace.workspace;
  const profile = localWorkspace.profile;
  const quickCapture = useCallback(
    (title: string) =>
      workspace && profile && today && taskService
        ? mutate(() =>
            taskService.quickCapture(
              workspace.id,
              title,
              today,
              profile.timeZone,
            ),
          )
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, profile, taskService, today, workspace],
  );
  const createTask = useCallback(
    (draft: TaskDraft, goalId: string | null = null) =>
      workspace && profile && taskService
        ? mutate(() =>
            taskService.create(workspace.id, draft, profile.timeZone, goalId),
          )
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, profile, taskService, workspace],
  );
  const updateTask = useCallback(
    (task: Task, draft: TaskDraft) =>
      profile && taskService
        ? mutate(() => taskService.update(task, draft, profile.timeZone))
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, profile, taskService],
  );
  const actOnTask = useCallback(
    (task: Task, action: 'complete' | 'reopen' | 'cancel' | 'delete') =>
      taskService
        ? mutate(() =>
            action === 'complete'
              ? taskService.complete(task)
              : action === 'reopen'
                ? taskService.reopen(task)
                : action === 'cancel'
                  ? taskService.cancel(task)
                  : taskService.softDelete(task),
          )
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, taskService],
  );
  const createRoutine = useCallback(
    (draft: RoutineDraft) =>
      workspace && profile && routineService
        ? mutate(() =>
            routineService.create(workspace.id, draft, profile.timeZone),
          )
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, profile, routineService, workspace],
  );
  const updateRoutine = useCallback(
    (routine: Routine, draft: RoutineDraft) =>
      profile && routineService
        ? mutate(() => routineService.update(routine, draft, profile.timeZone))
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, profile, routineService],
  );
  const checkRoutine = useCallback(
    (routine: Routine, outcome: 'completed' | 'skipped') =>
      today && routineService
        ? mutate(() => routineService.checkIn(routine, today, outcome))
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, routineService, today],
  );
  const undoRoutine = useCallback(
    (routine: Routine) =>
      today && routineService
        ? mutate(() => routineService.undoCheckIn(routine.id, today))
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, routineService, today],
  );

  return {
    status,
    errorMessage,
    isMutating,
    today,
    locale: profile?.locale ?? 'en-US',
    plan: hasLoaded && today
      ? buildTodayPlan(tasks, routines, checkIns, today, profile?.timeZone)
      : null,
    tasks,
    routines,
    checkIns,
    refresh,
    quickCapture,
    createTask,
    updateTask,
    completeTask: (task: Task) => actOnTask(task, 'complete'),
    reopenTask: (task: Task) => actOnTask(task, 'reopen'),
    cancelTask: (task: Task) => actOnTask(task, 'cancel'),
    deleteTask: (task: Task) => actOnTask(task, 'delete'),
    createRoutine,
    updateRoutine,
    checkRoutine,
    undoRoutine,
    getTask: (id: string) => tasks.find((task) => task.id === id) ?? null,
    getRoutine: (id: string) =>
      routines.find((routine) => routine.id === id) ?? null,
  };
}

export function usePlanning() {
  const value = useContext(PlanningContext);
  if (!value) throw new Error('usePlanning must be used within PlanningProvider.');
  return value;
}
