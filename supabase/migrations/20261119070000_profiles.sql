-- Profil d’un compte. Chaque ligne n’est lisible que par son propriétaire.

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  given_name text not null default '' check (char_length(given_name) <= 40),
  time_zone text not null default 'Europe/Paris',
  day_start time not null default '07:00',
  day_end time not null default '22:00',
  notification_profile text not null default 'normal'
    check (notification_profile in ('normal', 'intensive', 'focus', 'rest', 'custom')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from public, anon;
grant select, insert, update, delete on table public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (auth.uid() = user_id);

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy profiles_update on public.profiles
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy profiles_delete on public.profiles
  for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row
  execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
