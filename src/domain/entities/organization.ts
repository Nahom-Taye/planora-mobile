import type {
  CalendarDate,
  EntityId,
  EntityMetadata,
} from './common';

export type AreaStatus = 'active' | 'archived';

export type Area = EntityMetadata & {
  workspaceId: EntityId;
  name: string;
  color: string | null;
  status: AreaStatus;
};

export type Tag = EntityMetadata & {
  workspaceId: EntityId;
  name: string;
  color: string | null;
};

export type ReflectionScope = 'day' | 'week' | 'goal';

export type Reflection = EntityMetadata & {
  workspaceId: EntityId;
  scope: ReflectionScope;
  scopeId: EntityId | null;
  periodStart: CalendarDate;
  body: string;
  mood: 'low' | 'steady' | 'good' | 'great' | null;
};
