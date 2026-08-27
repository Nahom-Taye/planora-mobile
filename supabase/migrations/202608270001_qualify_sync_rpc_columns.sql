create or replace function public.apply_planning_operation(
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
  select po.applied_revision, po.change_cursor
  into existing_operation
  from public.planning_operations as po
  where po.operation_id = p_operation_id and po.owner_id = caller;
  if found then
    return query select 'applied'::text, existing_operation.applied_revision, existing_operation.change_cursor, null::jsonb, false;
    return;
  end if;
  if p_entity_type <> 'workspace' and not exists (
    select 1
    from public.planning_workspaces as pw
    where pw.id = p_workspace_id and pw.owner_id = caller and pw.deleted_at is null
  ) then
    raise exception 'Workspace ownership is invalid';
  end if;
  execute format('select record_row.revision, record_row.payload, record_row.deleted_at, record_row.change_cursor from public.%I as record_row where record_row.id = $1 and record_row.owner_id = $2 for update', table_name)
  into current_revision, current_payload, current_deleted, current_cursor using p_entity_id, caller;
  if found and current_revision <> p_base_revision then
    return query select 'conflict'::text, current_revision, current_cursor, current_payload, current_deleted is not null;
    return;
  end if;
  if not found and p_base_revision <> 0 then
    raise exception 'Planning state is unavailable';
  end if;
  execute format('insert into public.%I as record_row (id, owner_id, workspace_id, payload, base_revision, operation_id, deleted_at) values ($1,$2,$3,$4,$5,$6,case when $7 then now() else null end) on conflict (id, owner_id) do update set payload = excluded.payload, base_revision = excluded.base_revision, operation_id = excluded.operation_id, deleted_at = excluded.deleted_at returning record_row.revision, record_row.change_cursor', table_name)
  into current_revision, applied_cursor using p_entity_id, caller, p_workspace_id, p_payload, p_base_revision, p_operation_id, p_deleted;
  return query select 'applied'::text, current_revision, applied_cursor, null::jsonb, p_deleted;
end;
$$;

create or replace function public.pull_planning_changes(p_workspace_id uuid, p_after_cursor bigint, p_batch_limit integer)
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
  if not exists (
    select 1
    from public.planning_workspaces as pw
    where pw.id = p_workspace_id and pw.owner_id = caller
  ) then
    raise exception 'Workspace ownership is invalid';
  end if;
  for change_row in
    select pc.entity_type, pc.entity_id, pc.workspace_id, pc.revision, pc.change_cursor, pc.deleted, pc.payload
    from public.planning_changes as pc
    where pc.owner_id = caller and pc.workspace_id = p_workspace_id and pc.change_cursor > p_after_cursor
    order by pc.change_cursor
    limit p_batch_limit
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

create or replace function public.list_owned_planning_workspaces()
returns table(remote_workspace_id uuid, revision integer, change_cursor bigint, deleted boolean, payload jsonb)
language sql
security definer
set search_path = ''
stable
as $$
  select pw.id, pw.revision, pw.change_cursor, pw.deleted_at is not null, pw.payload
  from public.planning_workspaces as pw
  where pw.owner_id = (select auth.uid())
  order by pw.created_at, pw.id
$$;
