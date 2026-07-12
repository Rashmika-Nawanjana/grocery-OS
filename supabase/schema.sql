-- Run in Supabase SQL Editor

create extension if not exists vector;

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  item text not null,
  quantity numeric not null default 0,
  unit text not null default 'g',
  expiry_days integer not null default 7,
  last_added timestamptz not null default now(),
  rag_content text,
  embedding jsonb,
  embedding_vector vector(768),
  created_at timestamptz not null default now()
);

create table if not exists family_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  age integer not null default 0,
  preferences jsonb not null default '[]',
  allergies jsonb not null default '[]',
  dietary_restrictions jsonb not null default '[]',
  favorite_ingredients jsonb not null default '[]',
  schedule jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table inventory enable row level security;
alter table family_members enable row level security;

create policy "Users manage own inventory" on inventory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own family" on family_members
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists inventory_user_idx on inventory(user_id);
create index if not exists family_user_idx on family_members(user_id);

-- See rag-schema.sql for match_inventory() function
