-- Persistent user memory (preferences, learned facts) — run in Supabase SQL Editor

create table if not exists user_memory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_budget_lkr integer not null default 5000,
  preferred_stores jsonb not null default '[]',
  home_area text not null default 'Colombo',
  entries jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table user_memory enable row level security;

create policy "Users manage own memory" on user_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists user_memory_updated_idx on user_memory(updated_at desc);
