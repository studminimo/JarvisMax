-- Abonnements Web Push et rappels préparés pour le site ajouté à l’écran d’accueil.
-- Chaque ligne n’est lisible que par son propriétaire.
-- L’envoi est fait par la fonction reminders, qui passe par la clé service.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 12 and 2000),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from public, anon;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated
  using (auth.uid() = user_id);

create policy push_subscriptions_insert on public.push_subscriptions
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated
  using (auth.uid() = user_id);

create policy push_subscriptions_update on public.push_subscriptions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.scheduled_pushes (
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_key text not null check (char_length(notification_key) between 1 and 180),
  fire_at timestamptz not null,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  sent_at timestamptz,
  primary key (user_id, notification_key)
);

create index scheduled_pushes_due on public.scheduled_pushes (fire_at) where sent_at is null;

alter table public.scheduled_pushes enable row level security;
revoke all on table public.scheduled_pushes from public, anon;
grant select, insert, delete on table public.scheduled_pushes to authenticated;

create policy scheduled_pushes_select on public.scheduled_pushes
  for select to authenticated
  using (auth.uid() = user_id);

create policy scheduled_pushes_insert on public.scheduled_pushes
  for insert to authenticated
  with check (auth.uid() = user_id and sent_at is null);

create policy scheduled_pushes_delete on public.scheduled_pushes
  for delete to authenticated
  using (auth.uid() = user_id and sent_at is null);
