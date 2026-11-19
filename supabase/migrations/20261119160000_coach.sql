-- Routines, objectifs, habitudes, note du jour et mode du coach.
-- Chaque ligne n’est lisible que par son propriétaire.

alter table public.profiles
  add column if not exists coach_mode text not null default 'normal'
  check (coach_mode in ('normal', 'overwhelmed', 'focus', 'play', 'family', 'prepare', 'away'));

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  due_time time,
  recurrence text not null default 'daily' check (recurrence in ('none', 'daily', 'weekdays')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index routines_user on public.routines (user_id);

alter table public.routines enable row level security;
revoke all on table public.routines from public, anon;
grant select, insert, update, delete on table public.routines to authenticated;

create policy routines_select on public.routines for select to authenticated using (auth.uid() = user_id);
create policy routines_insert on public.routines for insert to authenticated with check (auth.uid() = user_id);
create policy routines_update on public.routines for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy routines_delete on public.routines for delete to authenticated using (auth.uid() = user_id);

create trigger routines_touch_updated_at
  before update on public.routines
  for each row execute function public.touch_updated_at();

create table public.routine_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_id uuid not null references public.routines (id) on delete cascade,
  position smallint not null check (position between 1 and 8),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  done_on text check (done_on is null or done_on ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (routine_id, position)
);

create index routine_steps_user on public.routine_steps (user_id);

alter table public.routine_steps enable row level security;
revoke all on table public.routine_steps from public, anon;
grant select, insert, update, delete on table public.routine_steps to authenticated;

create policy routine_steps_select on public.routine_steps for select to authenticated using (auth.uid() = user_id);
create policy routine_steps_insert on public.routine_steps for insert to authenticated with check (auth.uid() = user_id);
create policy routine_steps_update on public.routine_steps for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy routine_steps_delete on public.routine_steps for delete to authenticated using (auth.uid() = user_id);

create trigger routine_steps_touch_updated_at
  before update on public.routine_steps
  for each row execute function public.touch_updated_at();

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain text not null check (domain in ('personal', 'habits', 'family', 'couple', 'wellbeing', 'work', 'leisure')),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_user on public.goals (user_id, domain);

alter table public.goals enable row level security;
revoke all on table public.goals from public, anon;
grant select, insert, update, delete on table public.goals to authenticated;

create policy goals_select on public.goals for select to authenticated using (auth.uid() = user_id);
create policy goals_insert on public.goals for insert to authenticated with check (auth.uid() = user_id);
create policy goals_update on public.goals for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy goals_delete on public.goals for delete to authenticated using (auth.uid() = user_id);

create trigger goals_touch_updated_at
  before update on public.goals
  for each row execute function public.touch_updated_at();

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index habits_user on public.habits (user_id);

alter table public.habits enable row level security;
revoke all on table public.habits from public, anon;
grant select, insert, update, delete on table public.habits to authenticated;

create policy habits_select on public.habits for select to authenticated using (auth.uid() = user_id);
create policy habits_insert on public.habits for insert to authenticated with check (auth.uid() = user_id);
create policy habits_update on public.habits for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy habits_delete on public.habits for delete to authenticated using (auth.uid() = user_id);

create trigger habits_touch_updated_at
  before update on public.habits
  for each row execute function public.touch_updated_at();

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  date_key text not null check (date_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  created_at timestamptz not null default now(),
  unique (habit_id, date_key)
);

alter table public.habit_logs enable row level security;
revoke all on table public.habit_logs from public, anon;
grant select, insert, delete on table public.habit_logs to authenticated;

create policy habit_logs_select on public.habit_logs for select to authenticated using (auth.uid() = user_id);
create policy habit_logs_insert on public.habit_logs for insert to authenticated with check (auth.uid() = user_id);
create policy habit_logs_delete on public.habit_logs for delete to authenticated using (auth.uid() = user_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date_key text not null check (date_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  content text not null check (char_length(btrim(content)) between 1 and 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date_key)
);

alter table public.reviews enable row level security;
revoke all on table public.reviews from public, anon;
grant select, insert, update, delete on table public.reviews to authenticated;

create policy reviews_select on public.reviews for select to authenticated using (auth.uid() = user_id);
create policy reviews_insert on public.reviews for insert to authenticated with check (auth.uid() = user_id);
create policy reviews_update on public.reviews for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy reviews_delete on public.reviews for delete to authenticated using (auth.uid() = user_id);

create trigger reviews_touch_updated_at
  before update on public.reviews
  for each row execute function public.touch_updated_at();
