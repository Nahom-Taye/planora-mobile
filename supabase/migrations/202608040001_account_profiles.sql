create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60 and display_name = btrim(display_name)),
  locale text not null check (char_length(locale) between 2 and 35),
  time_zone text not null check (char_length(time_zone) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_updated_at_idx on public.profiles(updated_at desc, user_id);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on table public.profiles from public, anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy profiles_delete_own
on public.profiles
for delete
to authenticated
using ((select auth.uid()) = user_id);

create function public.protect_profile_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'Profile ownership cannot be changed';
  end if;
  return new;
end;
$$;

create function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger protect_profile_owner_before_update
before update on public.profiles
for each row execute function public.protect_profile_owner();

create trigger set_profile_updated_at_before_update
before update on public.profiles
for each row execute function public.set_profile_updated_at();

create function public.create_account_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, locale, time_zone)
  values (
    new.id,
    left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 60),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'en-US'),
    coalesce(nullif(new.raw_user_meta_data ->> 'time_zone', ''), 'UTC')
  );
  return new;
end;
$$;

revoke all on function public.protect_profile_owner() from public;
revoke all on function public.set_profile_updated_at() from public;
revoke all on function public.create_account_profile() from public;

create trigger create_account_profile_after_signup
after insert on auth.users
for each row execute function public.create_account_profile();
