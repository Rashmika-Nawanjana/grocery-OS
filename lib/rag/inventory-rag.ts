import type { InventoryItem } from '@/lib/types';
import { embedText, cosineSimilarity } from '@/lib/services/embeddings';
import { createClient } from '@/lib/supabase/server';

export const DUMMY_INVENTORY: Omit<InventoryItem, 'id'>[] = [
  { item: 'White Rice', quantity: 500, unit: 'g', expiryDays: 30, lastAdded: '2026-06-18' },
  { item: 'Fresh Tomatoes', quantity: 2, unit: 'pcs', expiryDays: 7, lastAdded: '2026-06-19' },
  { item: 'Mysoor Dhal', quantity: 1000, unit: 'g', expiryDays: 60, lastAdded: '2026-06-15' },
  { item: 'Red Onions', quantity: 4, unit: 'pcs', expiryDays: 14, lastAdded: '2026-06-17' },
  { item: 'Fresh Sea Fish', quantity: 200, unit: 'g', expiryDays: 2, lastAdded: '2026-06-20' },
  { item: 'Farm Eggs', quantity: 6, unit: 'pcs', expiryDays: 12, lastAdded: '2026-06-19' },
  { item: 'Coconut Oil', quantity: 500, unit: 'ml', expiryDays: 180, lastAdded: '2026-06-10' },
];

export function buildRagContent(item: Omit<InventoryItem, 'id'>, homeArea = 'Colombo'): string {
  return [
    `Home pantry item: ${item.item}`,
    `Quantity: ${item.quantity} ${item.unit}`,
    `Shelf life remaining: ${item.expiryDays} days`,
    `Last stocked: ${item.lastAdded}`,
    `Category: grocery ingredient for home cooking`,
    `Location: home pantry, ${homeArea}`,
  ].join('. ');
}

export async function embedInventoryItem(item: Omit<InventoryItem, 'id'>): Promise<{
  rag_content: string;
  embedding: number[] | null;
}> {
  const rag_content = buildRagContent(item);
  const embedding = await embedText(rag_content);
  return { rag_content, embedding };
}

interface InventoryRow {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  expiry_days: number;
  last_added: string;
  rag_content?: string;
  embedding?: number[];
}

function rowToItem(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    item: row.item,
    quantity: Number(row.quantity),
    unit: row.unit,
    expiryDays: row.expiry_days,
    lastAdded: row.last_added?.split('T')[0] || '',
  };
}

export async function searchInventoryRAG(
  userId: string,
  query: string,
  limit = 5
): Promise<{ items: InventoryItem[]; scores: number[] }> {
  const supabase = await createClient();
  const queryEmbedding = await embedText(query);
  if (!queryEmbedding) {
    const { data } = await supabase.from('inventory').select('*').eq('user_id', userId);
    return { items: (data || []).map(rowToItem), scores: [] };
  }

  // Try pgvector RPC first
  try {
    const { data, error } = await supabase.rpc('match_inventory', {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_threshold: 0.45,
      match_count: limit,
    });
    if (!error && data?.length) {
      return {
        items: data.map((row: InventoryRow) => rowToItem(row)),
        scores: data.map((row: { similarity: number }) => row.similarity),
      };
    }
  } catch {
    /* fall through to JS similarity */
  }

  // JS fallback using jsonb embeddings
  const { data: rows } = await supabase
    .from('inventory')
    .select('*')
    .eq('user_id', userId);

  if (!rows?.length) return { items: [], scores: [] };

  const scored = rows
    .map((row) => {
      const emb = row.embedding as number[] | null;
      const score = emb ? cosineSimilarity(queryEmbedding, emb) : 0;
      return { row, score };
    })
    .filter((s) => s.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    items: scored.map((s) => rowToItem(s.row)),
    scores: scored.map((s) => s.score),
  };
}

export async function seedInventoryWithRAG(userId: string, force = false): Promise<InventoryItem[]> {
  const supabase = await createClient();

  const { count } = await supabase
    .from('inventory')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (count && count > 0 && !force) {
    const { data } = await supabase.from('inventory').select('*').eq('user_id', userId);
    return (data || []).map(rowToItem);
  }

  if (force) {
    await supabase.from('inventory').delete().eq('user_id', userId);
  }

  const rows = [];
  for (const item of DUMMY_INVENTORY) {
    const { rag_content, embedding } = await embedInventoryItem(item);
    rows.push({
      user_id: userId,
      item: item.item,
      quantity: item.quantity,
      unit: item.unit,
      expiry_days: item.expiryDays,
      last_added: item.lastAdded,
      rag_content,
      embedding,
      ...(embedding ? { embedding_vector: embedding } : {}),
    });
  }

  const { data, error } = await supabase.from('inventory').insert(rows).select('*');
  if (error) {
    // Retry without embedding_vector if pgvector column missing
    const fallbackRows = rows.map(({ embedding_vector: _, ...rest }) => rest);
    const { data: fallbackData } = await supabase.from('inventory').insert(fallbackRows).select('*');
    return (fallbackData || []).map(rowToItem);
  }

  return (data || []).map(rowToItem);
}

export async function upsertInventoryWithRAG(userId: string, items: InventoryItem[]): Promise<void> {
  const supabase = await createClient();
  await supabase.from('inventory').delete().eq('user_id', userId);

  if (!items.length) return;

  const rows = [];
  for (const item of items) {
    const { rag_content, embedding } = await embedInventoryItem(item);
    rows.push({
      user_id: userId,
      item: item.item,
      quantity: item.quantity,
      unit: item.unit,
      expiry_days: item.expiryDays,
      last_added: item.lastAdded || new Date().toISOString(),
      rag_content,
      embedding,
      ...(embedding ? { embedding_vector: embedding } : {}),
    });
  }

  const { error } = await supabase.from('inventory').insert(rows);
  if (error) {
    const fallbackRows = rows.map(({ embedding_vector: _, ...rest }) => rest);
    await supabase.from('inventory').insert(fallbackRows);
  }
}
