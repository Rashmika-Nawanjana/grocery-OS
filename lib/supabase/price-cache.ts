import type { StorePrice } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function rowToPrice(row: {
  item_name: string;
  keells_price: number | null;
  cargills_price: number | null;
  pola_price: number | null;
  unit: string;
  source_type: string;
  source_url: string | null;
  store_sources: StorePrice['storeSources'] | null;
  fetched_at: string;
}): StorePrice {
  return {
    itemName: row.item_name,
    keellsPrice: Number(row.keells_price ?? 0),
    cargillsPrice: Number(row.cargills_price ?? 0),
    polaPrice: Number(row.pola_price ?? 0),
    unit: row.unit,
    sourceType: row.source_type as StorePrice['sourceType'],
    sourceUrl: row.source_url ?? undefined,
    storeSources: row.store_sources ?? undefined,
  };
}

export async function getCachedPrice(itemName: string): Promise<StorePrice | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('price_cache')
    .select('*')
    .ilike('item_name', itemName)
    .maybeSingle();

  if (error?.code === '42P01' || !data) return null;
  const age = Date.now() - new Date(data.fetched_at).getTime();
  if (age > MAX_AGE_MS) return null;
  return rowToPrice(data);
}

export async function getRecentCachedPrices(limit = 20): Promise<StorePrice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('price_cache')
    .select('*')
    .order('fetched_at', { ascending: false })
    .limit(limit);

  if (error?.code === '42P01' || !data?.length) return [];
  return data.map(rowToPrice);
}

export async function upsertPriceCache(price: StorePrice): Promise<void> {
  if (!price.keellsPrice && !price.cargillsPrice && !price.polaPrice) return;
  const supabase = await createClient();
  const { error } = await supabase.from('price_cache').upsert(
    {
      item_name: price.itemName,
      keells_price: price.keellsPrice,
      cargills_price: price.cargillsPrice,
      pola_price: price.polaPrice,
      unit: price.unit,
      source_type: price.sourceType || 'store_crawl',
      source_url: price.sourceUrl ?? null,
      store_sources: price.storeSources ?? {},
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'item_name' }
  );
  if (error?.code === '42P01') return;
}
