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
  Goal,
  GoalRoutineLink,
  Milestone,
  Area,
  Routine,
  Task,
} from '@/domain/entities';
import type { RepositoryStore } from '@/domain/repositories';
import { GoalRoutineLinkService } from '@/features/goals/services/goal-routine-link-service';
import {
  GoalService,
  GoalValidationError,
} from '@/features/goals/services/goal-service';
import { GoalTaskLinkService } from '@/features/goals/services/goal-task-link-service';
import type { GoalDraft } from '@/features/goals/services/goal-validation';
import { calculateGoalProgress } from '@/features/goals/services/goal-progress';
import {
  MilestoneService,
  MilestoneValidationError,
} from '@/features/goals/services/milestone-service';
import type { MilestoneDraft } from '@/features/goals/services/milestone-validation';
import { StorageError } from '@/storage/database/errors';

import { usePlanning } from './planning-provider';
import { useWorkspace } from './workspace-provider';

type MutationResult =
  | { ok: true }
  | { ok: false; fieldErrors?: Record<string, string> };

type GoalContextValue = ReturnType<typeof useGoalValue>;
const GoalContext = createContext<GoalContextValue | undefined>(undefined);

export function GoalProvider({
  repositories,
  children,
}: PropsWithChildren<{ repositories: RepositoryStore | null }>) {
  const value = useGoalValue(repositories);
  return <GoalContext.Provider value={value}>{children}</GoalContext.Provider>;
}

function useGoalValue(repositories: RepositoryStore | null) {
  const localWorkspace = useWorkspace();
  const planning = usePlanning();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [routineLinks, setRoutineLinks] = useState<GoalRoutineLink[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const operationActive = useRef(false);
  const goalService = useMemo(
    () => (repositories ? new GoalService(repositories) : null),
    [repositories],
  );
  const milestoneService = useMemo(
    () => (repositories ? new MilestoneService(repositories) : null),
    [repositories],
  );
  const taskLinkService = useMemo(
    () => (repositories ? new GoalTaskLinkService(repositories) : null),
    [repositories],
  );
  const routineLinkService = useMemo(
    () => (repositories ? new GoalRoutineLinkService(repositories) : null),
    [repositories],
  );

  const refresh = useCallback(async () => {
    const workspace = localWorkspace.workspace;
    if (!workspace || !goalService || !milestoneService || !routineLinkService) return;
    setStatus('loading');
    setErrorMessage(null);
    try {
      const [nextGoals, nextMilestones, nextLinks, nextAreas] = await Promise.all([
        goalService.list(workspace.id),
        milestoneService.list(workspace.id),
        routineLinkService.list(workspace.id),
        goalService.listAreas(workspace.id),
      ]);
      setGoals(nextGoals);
      setMilestones(nextMilestones);
      setRoutineLinks(nextLinks);
      setAreas(nextAreas);
      setStatus('ready');
    } catch {
      setStatus('error');
      setErrorMessage('Planora could not refresh goals. Saved local data is unchanged.');
    }
  }, [goalService, localWorkspace.workspace, milestoneService, routineLinkService]);

  useEffect(() => {
    if (localWorkspace.status === 'ready') void refresh();
    else setStatus('idle');
  }, [localWorkspace.status, refresh]);

  const mutate = useCallback(
    async (
      operation: () => Promise<unknown>,
      refreshTasks = false,
    ): Promise<MutationResult> => {
      if (operationActive.current) return { ok: false };
      operationActive.current = true;
      setIsMutating(true);
      setErrorMessage(null);
      try {
        await operation();
        if (refreshTasks) await planning.refresh();
        await refresh();
        return { ok: true };
      } catch (error) {
        if (
          error instanceof GoalValidationError ||
          error instanceof MilestoneValidationError
        ) {
          return { ok: false, fieldErrors: error.errors };
        }
        setErrorMessage(
          error instanceof StorageError && error.code === 'REVISION_CONFLICT'
            ? 'This goal changed before your update was saved. Refresh and try again.'
            : error instanceof StorageError && error.retryable
              ? error.message
              : 'That goal change could not be saved. Refresh and try again.',
        );
        return { ok: false };
      } finally {
        operationActive.current = false;
        setIsMutating(false);
      }
    },
    [planning, refresh],
  );

  const workspace = localWorkspace.workspace;
  const createGoal = useCallback(
    (draft: GoalDraft) =>
      workspace && goalService
        ? mutate(() => goalService.create(workspace.id, draft))
        : Promise.resolve<MutationResult>({ ok: false }),
    [goalService, mutate, workspace],
  );
  const updateGoal = useCallback(
    (goal: Goal, draft: GoalDraft) =>
      goalService
        ? mutate(() => goalService.update(goal, draft))
        : Promise.resolve<MutationResult>({ ok: false }),
    [goalService, mutate],
  );
  const actOnGoal = useCallback(
    (
      goal: Goal,
      action: 'pause' | 'resume' | 'complete' | 'reopen' | 'abandon' | 'delete',
    ) =>
      goalService
        ? mutate(() =>
            action === 'pause'
              ? goalService.pause(goal)
              : action === 'resume'
                ? goalService.resume(goal)
                : action === 'complete'
                  ? goalService.complete(goal)
                  : action === 'reopen'
                    ? goalService.reopen(goal)
                    : action === 'abandon'
                      ? goalService.abandon(goal)
                      : goalService.softDelete(goal),
          )
        : Promise.resolve<MutationResult>({ ok: false }),
    [goalService, mutate],
  );
  const createMilestone = useCallback(
    (goal: Goal, draft: MilestoneDraft) =>
      milestoneService
        ? mutate(() => milestoneService.create(goal, draft))
        : Promise.resolve<MutationResult>({ ok: false }),
    [milestoneService, mutate],
  );
  const updateMilestone = useCallback(
    (goal: Goal, milestone: Milestone, draft: MilestoneDraft) =>
      milestoneService
        ? mutate(() => milestoneService.update(goal, milestone, draft))
        : Promise.resolve<MutationResult>({ ok: false }),
    [milestoneService, mutate],
  );
  const actOnMilestone = useCallback(
    (
      goal: Goal,
      milestone: Milestone,
      action: 'complete' | 'reopen' | 'cancel' | 'delete',
    ) =>
      milestoneService
        ? mutate(() =>
            action === 'complete'
              ? milestoneService.complete(goal, milestone)
              : action === 'reopen'
                ? milestoneService.reopen(goal, milestone)
                : action === 'cancel'
                  ? milestoneService.cancel(goal, milestone)
                  : milestoneService.softDelete(goal, milestone),
          )
        : Promise.resolve<MutationResult>({ ok: false }),
    [milestoneService, mutate],
  );
  const reorderMilestone = useCallback(
    (goal: Goal, milestone: Milestone, direction: 'up' | 'down') =>
      milestoneService
        ? mutate(() => milestoneService.reorder(goal, milestone, direction))
        : Promise.resolve<MutationResult>({ ok: false }),
    [milestoneService, mutate],
  );
  const linkTask = useCallback(
    (goal: Goal, task: Task) =>
      taskLinkService
        ? mutate(() => taskLinkService.link(goal, task), true)
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, taskLinkService],
  );
  const unlinkTask = useCallback(
    (goal: Goal, task: Task) =>
      taskLinkService
        ? mutate(() => taskLinkService.unlink(goal, task), true)
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, taskLinkService],
  );
  const setNextAction = useCallback(
    (goal: Goal, task: Task | null) =>
      taskLinkService
        ? mutate(() => taskLinkService.setNextAction(goal, task))
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, taskLinkService],
  );
  const linkRoutine = useCallback(
    (goal: Goal, routine: Routine) =>
      routineLinkService
        ? mutate(() => routineLinkService.link(goal, routine))
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, routineLinkService],
  );
  const unlinkRoutine = useCallback(
    (goal: Goal, link: GoalRoutineLink) =>
      routineLinkService
        ? mutate(() => routineLinkService.unlink(goal, link))
        : Promise.resolve<MutationResult>({ ok: false }),
    [mutate, routineLinkService],
  );

  return {
    status,
    errorMessage,
    isMutating,
    goals,
    milestones,
    routineLinks,
    areas,
    tasks: planning.tasks,
    routines: planning.routines,
    checkIns: planning.checkIns,
    today: planning.today,
    refresh,
    createGoal,
    updateGoal,
    pauseGoal: (goal: Goal) => actOnGoal(goal, 'pause'),
    resumeGoal: (goal: Goal) => actOnGoal(goal, 'resume'),
    completeGoal: (goal: Goal) => actOnGoal(goal, 'complete'),
    reopenGoal: (goal: Goal) => actOnGoal(goal, 'reopen'),
    abandonGoal: (goal: Goal) => actOnGoal(goal, 'abandon'),
    deleteGoal: (goal: Goal) => actOnGoal(goal, 'delete'),
    createMilestone,
    updateMilestone,
    completeMilestone: (goal: Goal, milestone: Milestone) =>
      actOnMilestone(goal, milestone, 'complete'),
    reopenMilestone: (goal: Goal, milestone: Milestone) =>
      actOnMilestone(goal, milestone, 'reopen'),
    cancelMilestone: (goal: Goal, milestone: Milestone) =>
      actOnMilestone(goal, milestone, 'cancel'),
    deleteMilestone: (goal: Goal, milestone: Milestone) =>
      actOnMilestone(goal, milestone, 'delete'),
    reorderMilestone,
    linkTask,
    unlinkTask,
    setNextAction,
    linkRoutine,
    unlinkRoutine,
    getGoal: (id: string) => goals.find((goal) => goal.id === id) ?? null,
    getMilestone: (id: string) =>
      milestones.find((milestone) => milestone.id === id) ?? null,
    milestonesFor: (goalId: string) =>
      milestones
        .filter((milestone) => milestone.goalId === goalId)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)),
    tasksFor: (goalId: string) =>
      planning.tasks.filter((task) => task.goalId === goalId),
    routineLinksFor: (goalId: string) =>
      routineLinks.filter((link) => link.goalId === goalId),
    progressFor: (goal: Goal) =>
      calculateGoalProgress(
        goal,
        milestones.filter((milestone) => milestone.goalId === goal.id),
        planning.tasks.filter((task) => task.goalId === goal.id),
      ),
  };
}

export function useGoals() {
  const value = useContext(GoalContext);
  if (!value) throw new Error('useGoals must be used within GoalProvider.');
  return value;
}
