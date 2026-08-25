create sequence public.planning_change_cursor_seq;

create table public.planning_workspaces (
  id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  base_revision integer not null default 0 check (base_revision >= 0),
  revision integer not null default 0 check (revision >= 0),
  operation_id uuid not null,
  change_cursor bigint not null default 0 check (change_cursor >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, owner_id),
  unique (id, workspace_id, owner_id),
  check (id = workspace_id)
);

create table public.planning_areas (like public.planning_workspaces including defaults);
create table public.planning_tags (like public.planning_workspaces including defaults);
create table public.planning_routines (like public.planning_workspaces including defaults);
create table public.planning_goals (like public.planning_workspaces including defaults);
create table public.planning_tasks (like public.planning_workspaces including defaults);
create table public.planning_plan_block_series (like public.planning_workspaces including defaults);
create table public.planning_plan_blocks (like public.planning_workspaces including defaults);
create table public.planning_routine_check_ins (like public.planning_workspaces including defaults);
create table public.planning_milestones (like public.planning_workspaces including defaults);
create table public.planning_goal_routine_links (like public.planning_workspaces including defaults);
create table public.planning_reflections (like public.planning_workspaces including defaults);
create table public.planning_preferences (like public.planning_workspaces including defaults);
create table public.planning_reminder_intents (like public.planning_workspaces including defaults);

do $$
declare
  item text;
begin
  foreach item in array array['planning_areas','planning_tags','planning_routines','planning_goals','planning_tasks','planning_plan_block_series','planning_plan_blocks','planning_routine_check_ins','planning_milestones','planning_goal_routine_links','planning_reflections','planning_preferences','planning_reminder_intents']
  loop
    execute format('alter table public.%I add primary key (id, owner_id)', item);
    execute format('alter table public.%I add unique (id, workspace_id, owner_id)', item);
    execute format('alter table public.%I add check (jsonb_typeof(payload) = %L)', item, 'object');
    execute format('alter table public.%I add check (base_revision >= 0)', item);
    execute format('alter table public.%I add check (revision >= 0)', item);
    execute format('alter table public.%I add check (change_cursor >= 0)', item);
  end loop;
end;
$$;

alter table public.planning_areas add foreign key (workspace_id, owner_id) references public.planning_workspaces(id, owner_id) on delete cascade;
alter table public.planning_tags add foreign key (workspace_id, owner_id) references public.planning_workspaces(id, owner_id) on delete cascade;
alter table public.planning_routines add foreign key (workspace_id, owner_id) references public.planning_workspaces(id, owner_id) on delete cascade;

alter table public.planning_goals add column area_id uuid generated always as (nullif(payload ->> 'areaId', '')::uuid) stored;
alter table public.planning_goals add foreign key (workspace_id, owner_id) references public.planning_workspaces(id, owner_id) on delete cascade;

alter table public.planning_tasks add column area_id uuid generated always as (nullif(payload ->> 'areaId', '')::uuid) stored;
alter table public.planning_tasks add column goal_id uuid generated always as (nullif(payload ->> 'goalId', '')::uuid) stored;
alter table public.planning_tasks add column parent_task_id uuid generated always as (nullif(payload ->> 'parentTaskId', '')::uuid) stored;
alter table public.planning_tasks add foreign key (workspace_id, owner_id) references public.planning_workspaces(id, owner_id) on delete cascade;

alter table public.planning_plan_block_series add foreign key (workspace_id, owner_id) references public.planning_workspaces(id, owner_id) on delete cascade;

alter table public.planning_plan_blocks add column task_id uuid generated always as (nullif(payload ->> 'taskId', '')::uuid) stored;
alter table public.planning_plan_blocks add column routine_id uuid generated always as (nullif(payload ->> 'routineId', '')::uuid) stored;
alter table public.planning_plan_blocks add column series_id uuid generated always as (nullif(payload ->> 'seriesId', '')::uuid) stored;
alter table public.planning_plan_blocks add foreign key (workspace_id, owner_id) references public.planning_workspaces(id, owner_id) on delete cascade;

alter table public.planning_routine_check_ins add column routine_id uuid generated always as (nullif(payload ->> 'routineId', '')::uuid) stored;
alter table public.planning_routine_check_ins add foreign key (workspace_id, owner_id) references public.planning_workspaces(id, owner_id) on delete cascade;

alter table public.planning_milestones add column goal_id uuid generated always as (nullif(payload ->> 'goalId', '')::uuid) stored;
alter table public.planning_milestones add foreign key (workspace_id, owner_id) references public.planning_workspaces(id, owner_id) on delete cascade;

alter table public.planning_goal_routine_links add column goal_id uuid generated always as (nullif(payload ->> 'goalId', '')::uuid) stored;
alter table public.planning_goal_routine_links add column routine_id uuid generated always as (nullif(payload ->> 'routineId', '')::uuid) stored;
alter table public.planning_goal_routine_links add foreign key (workspace_id, owner_id) references public.planning_workspaces(id, owner_id) on delete cascade;

alter table public.planning_reflections add column goal_id uuid generated always as (case when payload ->> 'scope' = 'goal' then nullif(payload ->> 'scopeId', '')::uuid else null end) stored;
alter table public.planning_reflections add foreign key (workspace_id, owner_id) references public.planning_workspaces(id, owner_id) on delete cascade;
alter table public.planning_preferences add foreign key (workspace_id, owner_id) references public.planning_workspaces(id, owner_id) on delete cascade;
alter table public.planning_reminder_intents add foreign key (workspace_id, owner_id) references public.planning_workspaces(id, owner_id) on delete cascade;

create table public.planning_operations (
  operation_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null,
  entity_type text not null check (entity_type in ('workspace', 'task', 'plan_block_series', 'plan_block', 'routine', 'routine_check_in', 'goal', 'milestone', 'goal_routine_link', 'area', 'tag', 'reflection', 'app_settings', 'reminder_intent')),
  entity_id uuid not null,
  applied_revision integer not null check (applied_revision > 0),
  change_cursor bigint not null check (change_cursor > 0),
  created_at timestamptz not null default now(),
  primary key (operation_id, owner_id)
);

create table public.planning_changes (
  change_cursor bigint primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null,
  entity_type text not null check (entity_type in ('workspace', 'task', 'plan_block_series', 'plan_block', 'routine', 'routine_check_in', 'goal', 'milestone', 'goal_routine_link', 'area', 'tag', 'reflection', 'app_settings', 'reminder_intent')),
  entity_id uuid not null,
  revision integer not null check (revision > 0),
  deleted boolean not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create index planning_operations_owner_workspace_idx on public.planning_operations(owner_id, workspace_id, created_at, operation_id);
create index planning_changes_owner_workspace_cursor_idx on public.planning_changes(owner_id, workspace_id, change_cursor);

create function public.prepare_planning_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entity_kind text := tg_argv[0];
  caller uuid := (select auth.uid());
begin
  if entity_kind not in ('workspace', 'task', 'plan_block_series', 'plan_block', 'routine', 'routine_check_in', 'goal', 'milestone', 'goal_routine_link', 'area', 'tag', 'reflection', 'app_settings', 'reminder_intent') then
    raise exception 'Unsupported planning entity';
  end if;
  if caller is null or new.owner_id <> caller then
    raise exception 'Planning ownership is invalid';
  end if;
  if tg_op = 'UPDATE' and new.operation_id = old.operation_id then
    return old;
  end if;
  if tg_op = 'UPDATE' and new.base_revision <> old.revision then
    raise exception 'Planning revision conflict';
  end if;
  if tg_op = 'INSERT' and new.base_revision <> 0 then
    raise exception 'Initial planning revision must be zero';
  end if;
  new.revision := case when tg_op = 'INSERT' then 1 else old.revision + 1 end;
  new.change_cursor := nextval('public.planning_change_cursor_seq');
  new.created_at := case when tg_op = 'INSERT' then now() else old.created_at end;
  new.updated_at := now();
  return new;
end;
$$;

create function public.record_planning_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entity_kind text := tg_argv[0];
begin
  if tg_op = 'UPDATE' and new.operation_id = old.operation_id and new.revision = old.revision then
    return new;
  end if;
  if entity_kind not in ('workspace', 'task', 'plan_block_series', 'plan_block', 'routine', 'routine_check_in', 'goal', 'milestone', 'goal_routine_link', 'area', 'tag', 'reflection', 'app_settings', 'reminder_intent') then
    raise exception 'Unsupported planning entity';
  end if;
  insert into public.planning_operations (operation_id, owner_id, workspace_id, entity_type, entity_id, applied_revision, change_cursor)
  values (new.operation_id, new.owner_id, new.workspace_id, entity_kind, new.id, new.revision, new.change_cursor);
  insert into public.planning_changes (change_cursor, owner_id, workspace_id, entity_type, entity_id, revision, deleted, payload)
  values (new.change_cursor, new.owner_id, new.workspace_id, entity_kind, new.id, new.revision, new.deleted_at is not null, new.payload);
  return new;
end;
$$;

do $$
declare
  item text;
  entity_kind text;
begin
  foreach item in array array['planning_workspaces','planning_tasks','planning_plan_block_series','planning_plan_blocks','planning_routines','planning_routine_check_ins','planning_goals','planning_milestones','planning_goal_routine_links','planning_areas','planning_tags','planning_reflections','planning_preferences','planning_reminder_intents']
  loop
    entity_kind := case item
      when 'planning_workspaces' then 'workspace'
      when 'planning_tasks' then 'task'
      when 'planning_plan_block_series' then 'plan_block_series'
      when 'planning_plan_blocks' then 'plan_block'
      when 'planning_routines' then 'routine'
      when 'planning_routine_check_ins' then 'routine_check_in'
      when 'planning_goals' then 'goal'
      when 'planning_milestones' then 'milestone'
      when 'planning_goal_routine_links' then 'goal_routine_link'
      when 'planning_areas' then 'area'
      when 'planning_tags' then 'tag'
      when 'planning_reflections' then 'reflection'
      when 'planning_preferences' then 'app_settings'
      when 'planning_reminder_intents' then 'reminder_intent'
    end;
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.prepare_planning_record(%L)', item || '_prepare', item, entity_kind);
    execute format('create trigger %I after insert or update on public.%I for each row execute function public.record_planning_change(%L)', item || '_record', item, entity_kind);
  end loop;
end;
$$;

create function public.apply_planning_operation(
  p_operation_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_workspace_id uuid,
  p_base_revision integer,
  p_payload jsonb,
  p_deleted boolean
)
returns table(status text, applied_revision integer, applied_cursor bigint, remote_payload jsonb, remote_deleted boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  table_name text;
  current_revision integer;
  current_payload jsonb;
  current_deleted timestamptz;
  current_cursor bigint;
  existing_operation record;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  table_name := case p_entity_type
    when 'workspace' then 'planning_workspaces'
    when 'task' then 'planning_tasks'
    when 'plan_block_series' then 'planning_plan_block_series'
    when 'plan_block' then 'planning_plan_blocks'
    when 'routine' then 'planning_routines'
    when 'routine_check_in' then 'planning_routine_check_ins'
    when 'goal' then 'planning_goals'
    when 'milestone' then 'planning_milestones'
    when 'goal_routine_link' then 'planning_goal_routine_links'
    when 'area' then 'planning_areas'
    when 'tag' then 'planning_tags'
    when 'reflection' then 'planning_reflections'
    when 'app_settings' then 'planning_preferences'
    when 'reminder_intent' then 'planning_reminder_intents'
    else null
  end;
  if table_name is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Unsupported planning operation';
  end if;
  select applied_revision, change_cursor into existing_operation from public.planning_operations where operation_id = p_operation_id and owner_id = caller;
  if found then
    return query select 'applied'::text, existing_operation.applied_revision, existing_operation.change_cursor, null::jsonb, false;
    return;
  end if;
  if p_entity_type <> 'workspace' and not exists (select 1 from public.planning_workspaces where id = p_workspace_id and owner_id = caller and deleted_at is null) then
    raise exception 'Workspace ownership is invalid';
  end if;
  execute format('select revision, payload, deleted_at, change_cursor from public.%I where id = $1 and owner_id = $2 for update', table_name)
  into current_revision, current_payload, current_deleted, current_cursor using p_entity_id, caller;
  if found and current_revision <> p_base_revision then
    return query select 'conflict'::text, current_revision, current_cursor, current_payload, current_deleted is not null;
    return;
  end if;
  if not found and p_base_revision <> 0 then
    raise exception 'Planning state is unavailable';
  end if;
  execute format('insert into public.%I (id, owner_id, workspace_id, payload, base_revision, operation_id, deleted_at) values ($1,$2,$3,$4,$5,$6,case when $7 then now() else null end) on conflict (id, owner_id) do update set payload = excluded.payload, base_revision = excluded.base_revision, operation_id = excluded.operation_id, deleted_at = excluded.deleted_at returning revision, change_cursor', table_name)
  into current_revision, applied_cursor using p_entity_id, caller, p_workspace_id, p_payload, p_base_revision, p_operation_id, p_deleted;
  return query select 'applied'::text, current_revision, applied_cursor, null::jsonb, p_deleted;
end;
$$;

create function public.pull_planning_changes(p_workspace_id uuid, p_after_cursor bigint, p_batch_limit integer)
returns table(entity_type text, entity_id uuid, remote_workspace_id uuid, revision integer, change_cursor bigint, deleted boolean, payload jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  change_row record;
begin
  if caller is null or p_batch_limit < 1 or p_batch_limit > 100 then
    raise exception 'Invalid planning pull';
  end if;
  if not exists (select 1 from public.planning_workspaces where id = p_workspace_id and owner_id = caller) then
    raise exception 'Workspace ownership is invalid';
  end if;
  for change_row in select * from public.planning_changes where owner_id = caller and workspace_id = p_workspace_id and change_cursor > p_after_cursor order by change_cursor limit p_batch_limit
  loop
    entity_type := change_row.entity_type;
    entity_id := change_row.entity_id;
    remote_workspace_id := change_row.workspace_id;
    revision := change_row.revision;
    change_cursor := change_row.change_cursor;
    deleted := change_row.deleted;
    payload := change_row.payload;
    return next;
  end loop;
end;
$$;

create function public.list_owned_planning_workspaces()
returns table(remote_workspace_id uuid, revision integer, change_cursor bigint, deleted boolean, payload jsonb)
language sql
security definer
set search_path = ''
stable
as $$
  select id, revision, change_cursor, deleted_at is not null, payload
  from public.planning_workspaces
  where owner_id = (select auth.uid())
  order by created_at, id
$$;

create function public.delete_my_planning_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  delete from public.planning_workspaces where owner_id = caller;
  delete from public.planning_changes where owner_id = caller;
  delete from public.planning_operations where owner_id = caller;
end;
$$;

do $$
declare
  item text;
begin
  foreach item in array array['planning_workspaces','planning_areas','planning_tags','planning_routines','planning_goals','planning_tasks','planning_plan_block_series','planning_plan_blocks','planning_routine_check_ins','planning_milestones','planning_goal_routine_links','planning_reflections','planning_preferences','planning_reminder_intents','planning_operations','planning_changes']
  loop
    execute format('alter table public.%I enable row level security', item);
    execute format('alter table public.%I force row level security', item);
    execute format('revoke all on table public.%I from public, anon, authenticated', item);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)', item || '_select_own', item);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id)', item || '_insert_own', item);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = owner_id) with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id)', item || '_update_own', item);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)', item || '_delete_own', item);
  end loop;
end;
$$;

do $$
declare
  item text;
begin
  foreach item in array array['planning_workspaces','planning_areas','planning_tags','planning_routines','planning_goals','planning_tasks','planning_plan_block_series','planning_plan_blocks','planning_routine_check_ins','planning_milestones','planning_goal_routine_links','planning_reflections','planning_preferences','planning_reminder_intents']
  loop
    execute format('create index %I on public.%I(owner_id, workspace_id, revision, change_cursor) where deleted_at is null', item || '_owner_workspace_revision_idx', item);
    execute format('create index %I on public.%I(owner_id, workspace_id, change_cursor) where deleted_at is not null', item || '_tombstone_cursor_idx', item);
  end loop;
end;
$$;

revoke all on function public.prepare_planning_record() from public, anon, authenticated;
revoke all on function public.record_planning_change() from public, anon, authenticated;
revoke all on function public.apply_planning_operation(uuid, text, uuid, uuid, integer, jsonb, boolean) from public, anon;
revoke all on function public.pull_planning_changes(uuid, bigint, integer) from public, anon;
revoke all on function public.list_owned_planning_workspaces() from public, anon;
revoke all on function public.delete_my_planning_data() from public, anon;
grant execute on function public.apply_planning_operation(uuid, text, uuid, uuid, integer, jsonb, boolean) to authenticated;
grant execute on function public.pull_planning_changes(uuid, bigint, integer) to authenticated;
grant execute on function public.list_owned_planning_workspaces() to authenticated;
grant execute on function public.delete_my_planning_data() to authenticated;
revoke all on sequence public.planning_change_cursor_seq from public, anon, authenticated;
revoke insert, update, delete on table public.planning_operations, public.planning_changes from authenticated;
