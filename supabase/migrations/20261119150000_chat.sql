-- Conversation et mémoire d’un compte. Chaque ligne n’est lisible que par son propriétaire.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_user_updated on public.conversations (user_id, updated_at desc);

alter table public.conversations enable row level security;

revoke all on table public.conversations from public, anon;
grant select, insert, update, delete on table public.conversations to authenticated;

create policy conversations_select on public.conversations
  for select to authenticated
  using (auth.uid() = user_id);

create policy conversations_insert on public.conversations
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy conversations_update on public.conversations
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy conversations_delete on public.conversations
  for delete to authenticated
  using (auth.uid() = user_id);

create trigger conversations_touch_updated_at
  before update on public.conversations
  for each row
  execute function public.touch_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(btrim(content)) between 1 and 4000),
  tool_result text not null default '' check (tool_result in ('', 'ok', 'error', 'question')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index messages_user_created on public.messages (user_id, created_at);

alter table public.messages enable row level security;

revoke all on table public.messages from public, anon;
grant select, insert, update, delete on table public.messages to authenticated;

create policy messages_select on public.messages
  for select to authenticated
  using (auth.uid() = user_id);

create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.conversations
      where conversations.id = conversation_id and conversations.user_id = auth.uid()
    )
  );

create policy messages_update on public.messages
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.conversations
      where conversations.id = conversation_id and conversations.user_id = auth.uid()
    )
  );

create policy messages_delete on public.messages
  for delete to authenticated
  using (auth.uid() = user_id);

create trigger messages_touch_updated_at
  before update on public.messages
  for each row
  execute function public.touch_updated_at();

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 400),
  category text not null check (category in ('preference', 'fact', 'person', 'health', 'finance', 'private')),
  sensitive boolean not null,
  origin text not null check (origin in ('user', 'confirmed_suggestion')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (category in ('health', 'finance', 'private') and sensitive)
    or (category in ('preference', 'fact', 'person') and not sensitive)
  )
);

create index memories_user on public.memories (user_id);

alter table public.memories enable row level security;

revoke all on table public.memories from public, anon;
grant select, insert, update, delete on table public.memories to authenticated;

create policy memories_select on public.memories
  for select to authenticated
  using (auth.uid() = user_id);

create policy memories_insert on public.memories
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy memories_update on public.memories
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy memories_delete on public.memories
  for delete to authenticated
  using (auth.uid() = user_id);

create trigger memories_touch_updated_at
  before update on public.memories
  for each row
  execute function public.touch_updated_at();
