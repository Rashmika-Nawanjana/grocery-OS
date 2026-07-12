-- Run in Supabase SQL Editor (extends base schema)

create extension if not exists vector;

-- RAG columns for semantic home inventory search
alter table inventory add column if not exists rag_content text;
alter table inventory add column if not exists embedding jsonb;
alter table inventory add column if not exists embedding_vector vector(768);

create index if not exists inventory_embedding_idx on inventory using ivfflat (embedding_vector vector_cosine_ops) with (lists = 100);

-- Semantic search via pgvector (optional — app also has JS fallback)
create or replace function match_inventory(
  query_embedding vector(768),
  match_user_id uuid,
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  id uuid,
  item text,
  quantity numeric,
  unit text,
  expiry_days integer,
  last_added timestamptz,
  rag_content text,
  similarity float
)
language sql stable
as $$
  select
    i.id,
    i.item,
    i.quantity,
    i.unit,
    i.expiry_days,
    i.last_added,
    i.rag_content,
    1 - (i.embedding_vector <=> query_embedding) as similarity
  from inventory i
  where i.user_id = match_user_id
    and i.embedding_vector is not null
    and 1 - (i.embedding_vector <=> query_embedding) > match_threshold
  order by i.embedding_vector <=> query_embedding
  limit match_count;
$$;
