import type {
  AppSettings,
  Area,
  Goal,
  GoalRoutineLink,
  LocalChange,
  LocalAccountLink,
  Milestone,
  PlanBlock,
  PlanBlockSeries,
  Reflection,
  Routine,
  RoutineCheckIn,
  Tag,
  Task,
  UserProfile,
  Workspace,
} from '../entities/index.ts';

export type PageRequest = {
  limit?: number;
  offset?: number;
};

export type Page<TEntity> = {
  items: TEntity[];
  nextOffset: number | null;
};

export type ListOptions<TFilter> = {
  filter?: TFilter;
  page?: PageRequest;
  includeDeleted?: boolean;
};

export type EntityMetadataKeys =
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'revision'
  | 'deletedAt';

export type CreateEntityInput<TEntity> = Omit<TEntity, EntityMetadataKeys> & {
  id?: string;
};

export type UpdateEntityInput<TEntity> = Partial<
  Omit<TEntity, EntityMetadataKeys>
> & {
  expectedRevision?: number;
};

export interface EntityRepository<TEntity, TFilter> {
  getById(id: string, includeDeleted?: boolean): Promise<TEntity | null>;
  list(options?: ListOptions<TFilter>): Promise<Page<TEntity>>;
  create(input: CreateEntityInput<TEntity>): Promise<TEntity>;
  update(id: string, input: UpdateEntityInput<TEntity>): Promise<TEntity>;
  softDelete(id: string, expectedRevision?: number): Promise<TEntity>;
}

export type WorkspaceFilter = { profileId?: string; status?: Workspace['status'] };
export type WorkspaceEntityFilter<TStatus extends string | undefined = undefined> = {
  workspaceId?: string;
  status?: TStatus;
};
export type PlanBlockFilter = WorkspaceEntityFilter<PlanBlock['status']> & {
  fromDate?: string;
  toDate?: string;
  taskId?: string;
  routineId?: string;
  seriesId?: string;
};
export type PlanBlockSeriesFilter = WorkspaceEntityFilter<
  PlanBlockSeries['status']
>;
export type ProfileFilter = { profileId?: string };
export type RoutineCheckInFilter = {
  workspaceId?: string;
  routineId?: string;
  fromDate?: string;
  toDate?: string;
};
export type MilestoneFilter = { workspaceId?: string; goalId?: string };
export type GoalRoutineLinkFilter = {
  workspaceId?: string;
  goalId?: string;
  routineId?: string;
};
export type ReflectionFilter = {
  workspaceId?: string;
  scope?: Reflection['scope'];
  scopeId?: string;
  fromDate?: string;
  toDate?: string;
};
export type LocalChangeFilter = {
  entityType?: LocalChange['entityType'];
  state?: LocalChange['state'];
};
export type AccountLinkFilter = {
  localProfileId?: string;
  remoteAccountId?: string;
  status?: LocalAccountLink['status'];
};

export type UserProfileRepository = EntityRepository<UserProfile, Record<string, never>>;
export type WorkspaceRepository = EntityRepository<Workspace, WorkspaceFilter>;
export type TaskRepository = EntityRepository<
  Task,
  WorkspaceEntityFilter<Task['status']>
>;
export type PlanBlockRepository = EntityRepository<
  PlanBlock,
  PlanBlockFilter
>;
export type PlanBlockSeriesRepository = EntityRepository<
  PlanBlockSeries,
  PlanBlockSeriesFilter
>;
export type RoutineRepository = EntityRepository<
  Routine,
  WorkspaceEntityFilter<Routine['status']>
>;
export type RoutineCheckInRepository = EntityRepository<
  RoutineCheckIn,
  RoutineCheckInFilter
>;
export type GoalRepository = EntityRepository<
  Goal,
  WorkspaceEntityFilter<Goal['status']>
>;
export type MilestoneRepository = EntityRepository<Milestone, MilestoneFilter>;
export type GoalRoutineLinkRepository = EntityRepository<
  GoalRoutineLink,
  GoalRoutineLinkFilter
>;
export type AreaRepository = EntityRepository<
  Area,
  WorkspaceEntityFilter<Area['status']>
>;
export type TagRepository = EntityRepository<Tag, WorkspaceEntityFilter>;
export type ReflectionRepository = EntityRepository<Reflection, ReflectionFilter>;
export type AppSettingsRepository = EntityRepository<AppSettings, ProfileFilter>;
export type AccountLinkRepository = EntityRepository<
  LocalAccountLink,
  AccountLinkFilter
>;

export interface LocalChangeRepository {
  getById(id: string): Promise<LocalChange | null>;
  list(options?: ListOptions<LocalChangeFilter>): Promise<Page<LocalChange>>;
  create(
    input: Omit<LocalChange, 'id' | 'createdAt' | 'updatedAt' | 'revision'> & {
      id?: string;
    },
  ): Promise<LocalChange>;
  update(
    id: string,
    input: Partial<
      Omit<LocalChange, 'id' | 'createdAt' | 'updatedAt' | 'revision'>
    > & { expectedRevision?: number },
  ): Promise<LocalChange>;
}

export type RepositoryScope = {
  userProfiles: UserProfileRepository;
  workspaces: WorkspaceRepository;
  tasks: TaskRepository;
  planBlocks: PlanBlockRepository;
  planBlockSeries: PlanBlockSeriesRepository;
  routines: RoutineRepository;
  routineCheckIns: RoutineCheckInRepository;
  goals: GoalRepository;
  milestones: MilestoneRepository;
  goalRoutineLinks: GoalRoutineLinkRepository;
  areas: AreaRepository;
  tags: TagRepository;
  reflections: ReflectionRepository;
  appSettings: AppSettingsRepository;
  accountLinks: AccountLinkRepository;
  localChanges: LocalChangeRepository;
};

export interface RepositoryStore extends RepositoryScope {
  transaction<TResult>(
    operation: (repositories: RepositoryScope) => Promise<TResult>,
  ): Promise<TResult>;
}
