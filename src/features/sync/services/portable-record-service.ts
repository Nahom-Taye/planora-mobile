import type { EntityMetadata, PortableEntityType, PortableRecord, RemotePlanningRecord } from '../../../domain/entities/index.ts';
import type { EntityRepository, RepositoryScope, RepositoryStore } from '../../../domain/repositories/contracts.ts';

type AnyEntity = EntityMetadata & Record<string, unknown>;
type AnyRepository = EntityRepository<AnyEntity, Record<string, unknown>>;

const portableTypes: PortableEntityType[] = [
  'workspace',
  'area',
  'tag',
  'routine',
  'goal',
  'task',
  'plan_block_series',
  'plan_block',
  'routine_check_in',
  'milestone',
  'goal_routine_link',
  'reflection',
  'app_settings',
  'reminder_intent',
];

export class PortableRecordService {
  constructor(private readonly repositories: RepositoryStore) {}

  async read(entityType: PortableEntityType, entityId: string, workspaceId: string) {
    const entity = await repositoryFor(this.repositories, entityType).getById(entityId, true);
    const workspace = await this.repositories.workspaces.getById(workspaceId, true);
    if (!entity || !workspace || !belongsToWorkspace(entityType, entity, workspaceId, workspace.profileId)) return null;
    return toPortableRecord(entityType, entity, workspaceId);
  }

  async snapshot(workspaceId: string) {
    const workspace = await this.repositories.workspaces.getById(workspaceId, true);
    if (!workspace) return [];
    const records: PortableRecord[] = [];
    for (const entityType of portableTypes) {
      const repository = repositoryFor(this.repositories, entityType);
      const filter = filterFor(entityType, workspaceId, workspace.profileId);
      let offset: number | null = 0;
      while (offset !== null) {
        const page = await repository.list({
          filter,
          includeDeleted: true,
          page: { limit: 100, offset },
        });
        for (const entity of page.items) {
          if (belongsToWorkspace(entityType, entity, workspaceId, workspace.profileId)) {
            records.push(toPortableRecord(entityType, entity, workspaceId));
          }
        }
        offset = page.nextOffset;
      }
    }
    const taskDepths = taskDepthMap(records);
    return records.sort((left, right) => {
      const typeDifference = portableTypes.indexOf(left.entityType) - portableTypes.indexOf(right.entityType);
      if (typeDifference) return typeDifference;
      if (left.entityType === 'task' && right.entityType === 'task') {
        const taskDepthDifference = (taskDepths.get(left.entityId) ?? 0) - (taskDepths.get(right.entityId) ?? 0);
        if (taskDepthDifference) return taskDepthDifference;
      }
      return left.entityId.localeCompare(right.entityId);
    });
  }

  async apply(record: RemotePlanningRecord, localWorkspaceId: string) {
    await this.repositories.transaction(async (scope) => {
      await scope.syncControl.suppress(localWorkspaceId);
      try {
        await applyRemoteRecord(scope, record, localWorkspaceId);
        await saveEntityState(scope, record, localWorkspaceId);
      } finally {
        await scope.syncControl.resume(localWorkspaceId);
      }
    });
  }
}

export function retryDelayMs(attemptCount: number, randomValue = 0.5) {
  const base = Math.min(300_000, 1_000 * 2 ** Math.min(8, Math.max(0, attemptCount - 1)));
  const jitter = Math.round(base * 0.25 * Math.min(1, Math.max(0, randomValue)));
  return base + jitter;
}

function toPortableRecord(entityType: PortableEntityType, entity: AnyEntity, workspaceId: string): PortableRecord {
  const { id, createdAt, updatedAt, revision, deletedAt, workspaceId: ignoredWorkspace, profileId, ...values } = entity;
  const payload = entityType === 'app_settings'
    ? portableSettings(values)
    : entityType === 'workspace'
      ? withoutKeys(values, ['kind'])
      : values;
  return {
    entityType,
    entityId: id,
    workspaceId,
    localRevision: revision,
    deleted: deletedAt !== null,
    payload,
  };
}

function portableSettings(values: Record<string, unknown>) {
  return withoutKeys(values, [
    'defaultTab',
    'plannerView',
    'insightsView',
    'insightsRange',
    'deviceCalendarId',
    'deviceCalendarName',
    'onboardingVersion',
    'onboardingCompletedAt',
  ]);
}

function withoutKeys(values: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !keys.includes(key)));
}

function repositoryFor(scope: RepositoryScope, entityType: PortableEntityType): AnyRepository {
  const repository = entityType === 'workspace' ? scope.workspaces
    : entityType === 'task' ? scope.tasks
    : entityType === 'plan_block' ? scope.planBlocks
      : entityType === 'plan_block_series' ? scope.planBlockSeries
        : entityType === 'routine' ? scope.routines
          : entityType === 'routine_check_in' ? scope.routineCheckIns
            : entityType === 'goal' ? scope.goals
              : entityType === 'milestone' ? scope.milestones
                : entityType === 'goal_routine_link' ? scope.goalRoutineLinks
                : entityType === 'area' ? scope.areas
                  : entityType === 'tag' ? scope.tags
                    : entityType === 'reflection' ? scope.reflections
                      : entityType === 'app_settings' ? scope.appSettings
                        : scope.reminderIntents;
  return repository as unknown as AnyRepository;
}

function taskDepthMap(records: PortableRecord[]) {
  const tasks = new Map(records.filter((record) => record.entityType === 'task').map((record) => [record.entityId, record]));
  const depths = new Map<string, number>();
  const depthFor = (record: PortableRecord, seen: Set<string>): number => {
    const cached = depths.get(record.entityId);
    if (cached !== undefined) return cached;
    const parentId = record.payload.parentTaskId;
    if (typeof parentId !== 'string' || !parentId || seen.has(parentId)) return 0;
    const parent = tasks.get(parentId);
    if (!parent) return 0;
    const nextSeen = new Set(seen).add(record.entityId);
    const depth = 1 + depthFor(parent, nextSeen);
    depths.set(record.entityId, depth);
    return depth;
  };
  for (const record of tasks.values()) depthFor(record, new Set());
  return depths;
}

function filterFor(entityType: PortableEntityType, workspaceId: string, profileId: string) {
  if (entityType === 'workspace') return {};
  if (entityType === 'app_settings') return { profileId };
  return { workspaceId };
}

function belongsToWorkspace(entityType: PortableEntityType, entity: AnyEntity, workspaceId: string, profileId: string) {
  if (entityType === 'workspace') return entity.id === workspaceId;
  if (entityType === 'app_settings') return entity.profileId === profileId;
  return entity.workspaceId === workspaceId;
}

async function applyRemoteRecord(scope: RepositoryScope, record: RemotePlanningRecord, localWorkspaceId: string) {
  if (record.entityType === 'workspace') {
    if (record.deleted) return;
    const workspace = await scope.workspaces.getById(localWorkspaceId);
    if (workspace) await scope.workspaces.update(workspace.id, record.payload);
    return;
  }
  if (record.entityType === 'app_settings') {
    if (record.deleted) return;
    const workspace = await scope.workspaces.getById(localWorkspaceId);
    if (!workspace) return;
    const page = await scope.appSettings.list({ filter: { profileId: workspace.profileId }, page: { limit: 1, offset: 0 } });
    const settings = page.items[0];
    if (settings) await scope.appSettings.update(settings.id, record.payload);
    return;
  }
  const repository = repositoryFor(scope, record.entityType);
  const existing = await repository.getById(record.entityId, true);
  if (record.deleted) {
    if (existing && !existing.deletedAt) await repository.softDelete(existing.id, existing.revision);
    return;
  }
  const values = { ...record.payload, workspaceId: localWorkspaceId };
  if (existing?.deletedAt) return;
  if (existing) await repository.update(existing.id, values);
  else await repository.create({ ...values, id: record.entityId });
}

async function saveEntityState(scope: RepositoryScope, record: RemotePlanningRecord, workspaceId: string) {
  const page = await scope.syncEntityStates.list({
    filter: { workspaceId, entityType: record.entityType, entityId: record.entityId },
    page: { limit: 1, offset: 0 },
  });
  const values = {
    workspaceId,
    entityType: record.entityType,
    entityId: record.entityId,
    remoteRevision: record.revision,
    remoteCursor: record.changeCursor,
  };
  if (page.items[0]) await scope.syncEntityStates.update(page.items[0].id, values);
  else await scope.syncEntityStates.create(values);
}
