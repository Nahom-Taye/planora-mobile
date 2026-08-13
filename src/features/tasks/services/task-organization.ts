import type { CalendarDate, Task } from '../../../domain/entities/index.ts';

const priorityRank = { high: 0, medium: 1, low: 2, none: 3 } as const;
const statusRank = {
  in_progress: 0,
  pending: 1,
  completed: 2,
  cancelled: 3,
} as const;

export type TaskGroups = {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  unscheduled: Task[];
  completed: Task[];
  cancelled: Task[];
};

export function groupTasks(tasks: Task[], today: CalendarDate): TaskGroups {
  const actionable = tasks.filter(isActionableTask);

  return {
    overdue: actionable
      .filter((task) => task.dueDate !== null && task.dueDate < today)
      .sort(compareTasks),
    today: actionable
      .filter((task) => task.dueDate === today)
      .sort(compareTasks),
    upcoming: actionable
      .filter((task) => task.dueDate !== null && task.dueDate > today)
      .sort(compareDatedTasks),
    unscheduled: actionable
      .filter((task) => task.dueDate === null)
      .sort(compareTasks),
    completed: tasks
      .filter((task) => task.status === 'completed')
      .sort(compareMostRecentlyUpdated),
    cancelled: tasks
      .filter((task) => task.status === 'cancelled')
      .sort(compareMostRecentlyUpdated),
  };
}

export function compareTasks(left: Task, right: Task) {
  return (
    statusRank[left.status] - statusRank[right.status] ||
    priorityRank[left.priority] - priorityRank[right.priority] ||
    compareNullableTime(left.scheduledTime, right.scheduledTime) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

export function isActionableTask(task: Task) {
  return task.status === 'pending' || task.status === 'in_progress';
}

function compareDatedTasks(left: Task, right: Task) {
  return (
    (left.dueDate ?? '').localeCompare(right.dueDate ?? '') ||
    compareTasks(left, right)
  );
}

function compareMostRecentlyUpdated(left: Task, right: Task) {
  return (
    right.updatedAt.localeCompare(left.updatedAt) ||
    compareTasks(left, right)
  );
}

function compareNullableTime(left: string | null, right: string | null) {
  if (left && right) return left.localeCompare(right);
  if (left) return -1;
  if (right) return 1;
  return 0;
}
