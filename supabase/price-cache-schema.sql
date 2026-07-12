-- Cached live grocery prices (written after successful crawls). Run in Supabase SQL Editor.

create table if not exists price_cache (
  id uuid primary key default gen_random_uuid(),
  item_name text not null unique,
  keells_price numeric,
  cargills_price numeric,
  pola_price numeric,
  unit text not null default 'per kg',
  source_type text not null default 'store_crawl',
  source_url text,
  store_sources jsonb default '{}',
  fetched_at timestamptz not null default now()
);

create index if not exists price_cache_fetched_idx on price_cache(fetched_at desc);
create index if not exists price_cache_item_idx on price_cache(lower(item_name));

alter table price_cache enable row level security;

create policy "Anyone can read price cache" on price_cache
  for select using (true);

create policy "Service role writes price cache" on price_cache
  for insert with check (true);

create policy "Service role updates price cache" on price_cache
  for update using (true);
