-- Tâches d’un compte. Chaque ligne n’est lisible que par son propriétaire.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  date_key text not null check (date_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  due_time time,
  done boolean not null default false,
  priority boolean not null default false,
  context text not null default '' check (char_length(context) <= 80),
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'weekdays')),
  ignored_on text check (ignored_on is null or ignored_on ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_date on public.tasks (user_id, date_key);

alter table public.tasks enable row level security;

revoke all on table public.tasks from public, anon;
grant select, insert, update, delete on table public.tasks to authenticated;

create policy tasks_select on public.tasks
  for select to authenticated
  using (auth.uid() = user_id);

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy tasks_update on public.tasks
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (auth.uid() = user_id);

create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row
  execute function public.touch_updated_at();
