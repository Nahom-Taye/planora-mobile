import {
  toInstant,
  type CalendarDate,
  type Routine,
  type RoutineCheckIn,
  type TimeZone,
} from '../../../domain/entities/index.ts';
import type { RepositoryStore } from '../../../domain/repositories/contracts.ts';
import { weekdayForDate } from '../../today/services/local-date.ts';
import type { RoutineDraft } from './routine-validation.ts';
import { validateRoutineDraft } from './routine-validation.ts';

export class RoutineValidationError extends Error {
  constructor(readonly errors: Record<string, string>) {
    super('Routine details need attention.');
  }
}

export class RoutineService {
  constructor(
    private readonly repositories: RepositoryStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(workspaceId: string) {
    return listAllRoutines(this.repositories, workspaceId);
  }

  async listCheckIns(workspaceId: string, date: CalendarDate) {
    const page = await this.repositories.routineCheckIns.list({
      filter: { workspaceId, fromDate: date, toDate: date },
      page: { limit: 100, offset: 0 },
    });
    return page.items;
  }

  async create(workspaceId: string, draft: RoutineDraft, timeZone: TimeZone) {
    const value = validDraft(draft);
    return this.repositories.routines.create({
      workspaceId,
      title: value.title,
      notes: value.notes,
      schedule:
        value.scheduleKind === 'daily'
          ? { kind: 'daily', time: value.time }
          : {
              kind: 'weekly',
              weekdays: value.weekdays,
              time: value.time,
            },
      timeZone,
      status: value.status,
    });
  }

  async update(routine: Routine, draft: RoutineDraft, timeZone: TimeZone) {
    const value = validDraft(draft);
    return this.repositories.routines.update(routine.id, {
      expectedRevision: routine.revision,
      title: value.title,
      notes: value.notes,
      schedule:
        value.scheduleKind === 'daily'
          ? { kind: 'daily', time: value.time }
          : {
              kind: 'weekly',
              weekdays: value.weekdays,
              time: value.time,
            },
      timeZone,
      status: value.status,
    });
  }

  async checkIn(
    routine: Routine,
    date: CalendarDate,
    outcome: 'completed' | 'skipped',
  ) {
    const existing = await this.findCheckIn(routine.id, date);
    const recordedAt = toInstant(this.now());

    if (existing) {
      return this.repositories.routineCheckIns.update(existing.id, {
        expectedRevision: existing.revision,
        outcome,
        recordedAt,
      });
    }

    return this.repositories.routineCheckIns.create({
      workspaceId: routine.workspaceId,
      routineId: routine.id,
      date,
      outcome,
      recordedAt,
      note: null,
    });
  }

  async undoCheckIn(routineId: string, date: CalendarDate) {
    const existing = await this.findCheckIn(routineId, date);
    if (!existing) return null;
    return this.repositories.routineCheckIns.softDelete(
      existing.id,
      existing.revision,
    );
  }

  private async findCheckIn(routineId: string, date: CalendarDate) {
    const page = await this.repositories.routineCheckIns.list({
      filter: { routineId, fromDate: date, toDate: date },
      page: { limit: 2, offset: 0 },
    });
    return page.items[0] ?? null;
  }
}

export function isRoutineScheduled(routine: Routine, date: CalendarDate) {
  if (routine.status !== 'active') return false;
  if (routine.schedule.kind === 'daily') return true;
  return routine.schedule.weekdays.includes(weekdayForDate(date));
}

export function checkInForRoutine(
  checkIns: RoutineCheckIn[],
  routineId: string,
) {
  return checkIns.find((checkIn) => checkIn.routineId === routineId) ?? null;
}

async function listAllRoutines(
  repositories: RepositoryStore,
  workspaceId: string,
) {
  const routines: Routine[] = [];
  let offset = 0;

  while (true) {
    const page = await repositories.routines.list({
      filter: { workspaceId },
      page: { limit: 100, offset },
    });
    routines.push(...page.items);
    if (page.nextOffset === null) return routines;
    offset = page.nextOffset;
  }
}

function validDraft(draft: RoutineDraft) {
  const result = validateRoutineDraft(draft);
  if (!result.valid) throw new RoutineValidationError(result.errors);
  return result.value;
}
