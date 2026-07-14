import type { StorePrice } from '@/lib/types';
import { googlePriceSearchUrl } from '@/lib/data-sources';
import { crawlSupermarketPrices, mergeStoreCrawlIntoPrice } from '@/lib/services/store-crawlers';
import { isPiecePricedUnit, isPlausibleStorePrice } from '@/lib/services/price-units';
import { planLog, planWarn } from '@/lib/plan-logger';
import { getCachedPrice, getRecentCachedPrices, upsertPriceCache } from '@/lib/supabase/price-cache';

const BASE_CATALOG: StorePrice[] = [
  { itemName: 'White Rice', keellsPrice: 240, cargillsPrice: 235, polaPrice: 220, unit: 'per kg' },
  { itemName: 'Fresh Tomatoes', keellsPrice: 380, cargillsPrice: 395, polaPrice: 320, unit: 'per kg' },
  { itemName: 'Mysoor Dhal', keellsPrice: 420, cargillsPrice: 410, polaPrice: 390, unit: 'per kg' },
  { itemName: 'Red Onions', keellsPrice: 480, cargillsPrice: 490, polaPrice: 410, unit: 'per kg' },
  { itemName: 'Chicken Breast', keellsPrice: 1450, cargillsPrice: 1400, polaPrice: 1350, unit: 'per kg' },
  { itemName: 'Farm Eggs', keellsPrice: 42, cargillsPrice: 45, polaPrice: 38, unit: 'per item' },
  { itemName: 'Carrots', keellsPrice: 450, cargillsPrice: 480, polaPrice: 380, unit: 'per kg' },
  { itemName: 'Coconut Oil', keellsPrice: 650, cargillsPrice: 660, polaPrice: 600, unit: 'per litre' },
  { itemName: 'Sea Fish', keellsPrice: 1800, cargillsPrice: 1850, polaPrice: 1650, unit: 'per kg' },
  { itemName: 'Bananas', keellsPrice: 180, cargillsPrice: 190, polaPrice: 150, unit: 'per kg' },
  { itemName: 'Bread Loaf', keellsPrice: 185, cargillsPrice: 180, polaPrice: 165, unit: 'per loaf' },
  { itemName: 'Peanut Butter', keellsPrice: 890, cargillsPrice: 850, polaPrice: 780, unit: 'per jar' },
  { itemName: 'Jam', keellsPrice: 480, cargillsPrice: 460, polaPrice: 420, unit: 'per jar' },
  { itemName: 'Canned Tuna', keellsPrice: 340, cargillsPrice: 325, polaPrice: 295, unit: 'per can' },
  { itemName: 'Cooking Oil', keellsPrice: 650, cargillsPrice: 660, polaPrice: 600, unit: 'per litre' },
  { itemName: 'Chilli Powder', keellsPrice: 380, cargillsPrice: 370, polaPrice: 340, unit: 'per 100g pack' },
  { itemName: 'Turmeric Powder', keellsPrice: 320, cargillsPrice: 310, polaPrice: 280, unit: 'per 100g pack' },
  { itemName: 'Salt', keellsPrice: 85, cargillsPrice: 90, polaPrice: 75, unit: 'per kg' },
  { itemName: 'Curry Leaves', keellsPrice: 120, cargillsPrice: 130, polaPrice: 100, unit: 'per 100g pack' },
  { itemName: 'Green Chilies', keellsPrice: 420, cargillsPrice: 440, polaPrice: 380, unit: 'per kg' },
  { itemName: 'Garlic', keellsPrice: 1200, cargillsPrice: 1150, polaPrice: 1050, unit: 'per kg' },
  { itemName: 'Ginger', keellsPrice: 500, cargillsPrice: 480, polaPrice: 450, unit: 'per kg' },
  { itemName: 'Coconut Milk', keellsPrice: 280, cargillsPrice: 270, polaPrice: 250, unit: 'per 400ml pack' },
  { itemName: 'Curry Powder', keellsPrice: 180, cargillsPrice: 175, polaPrice: 160, unit: 'per 100g pack' },
];

const CACHE_TTL_MS = 20 * 60 * 1000;
const DEFAULT_CRAWL_TIMEOUT_MS = 12_000;

const priceCache = new Map<string, { price: StorePrice; expiresAt: number }>();

export interface FetchPricesOptions {
  prompt?: string;
  crawlTimeoutMs?: number;
  skipCrawl?: boolean;
}

function cacheKey(item: string): string {
  return `v4:${item.toLowerCase().trim()}`;
}

function getCached(item: string): StorePrice | null {
  const hit = priceCache.get(cacheKey(item));
  if (!hit || hit.expiresAt < Date.now()) return null;
  return hit.price;
}

function setCached(item: string, price: StorePrice): void {
  priceCache.set(cacheKey(item), { price, expiresAt: Date.now() + CACHE_TTL_MS });
}

function crawlConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY?.trim() || process.env.SCRAPE_DO_TOKEN?.trim());
}

export function wantsLiveStoreCrawl(prompt?: string): boolean {
  if (!prompt) return false;
  return /\b(live|keells|keels|cargills|sync fresh|store crawl|crawl|actual price|real price|from the store)\b/i.test(
    prompt
  );
}

async function timebox<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  const result = await Promise.race([promise, timeout]);
  clearTimeout(timer!);
  return result as T | null;
}

function extractPricesFromText(text: string, itemName: string, catalog?: StorePrice): Partial<StorePrice> | null {
  const prices = [...text.matchAll(/(?:rs\.?|lkr)\s*([\d,]+(?:\.\d+)?)/gi)].map((m) =>
    parseFloat(m[1].replace(/,/g, ''))
  );
  if (!prices.length) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  const unit = catalog?.unit || 'per kg';
  // Single web estimate — do NOT invent true per-store shelves from ratios
  const estimate = Math.round(mid);
  return {
    itemName,
    keellsPrice: estimate,
    cargillsPrice: estimate,
    polaPrice: Math.round(estimate * 0.9),
    unit,
  };
}

async function searchSerpPrices(item: string, catalog?: StorePrice): Promise<Partial<StorePrice> | null> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return null;
  try {
    const q = encodeURIComponent(`${item} price Sri Lanka supermarket LKR Keells OR Cargills`);
    const url = `https://serpapi.com/search.json?q=${q}&api_key=${key}&num=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const snippets = [
      data.answer_box?.snippet,
      ...(data.organic_results || []).map((r: { snippet?: string; title?: string }) => `${r.title || ''} ${r.snippet || ''}`),
    ]
      .filter(Boolean)
      .join(' ');
    // Require the item name (or stem) to appear near prices
    const stem = item.toLowerCase().split(/\s+/)[0].replace(/s$/, '');
    if (!snippets.toLowerCase().includes(stem)) return null;
    return extractPricesFromText(snippets, item, catalog);
  } catch {
    return null;
  }
}

/** Stricter catalog match — token overlap, reject weak hits. */
function scoreCatalogMatch(query: string, catalogName: string): number {
  const q = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
  const n = catalogName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (!q.length || !n.length) return 0;
  if (catalogName.toLowerCase() === query.toLowerCase()) return 1;
  if (catalogName.toLowerCase().includes(query.toLowerCase()) || query.toLowerCase().includes(catalogName.toLowerCase())) {
    return 0.85;
  }
  let hits = 0;
  for (const t of q) {
    const stem = t.replace(/s$/, '');
    if (n.some((w) => w === t || w === stem || w.startsWith(stem) || stem.startsWith(w))) hits += 1;
  }
  return hits / q.length;
}

function findCatalogMatch(item: string): StorePrice | undefined {
  let best: { score: number; row: StorePrice } | null = null;
  for (const row of BASE_CATALOG) {
    const score = scoreCatalogMatch(item, row.itemName);
    if (!best || score > best.score) best = { score, row };
  }
  // Require a solid match — avoid "oil" → random coconut oil from one shared token alone when score low
  if (!best || best.score < 0.5) return undefined;
  return best.row;
}

function fromCatalog(item: string, base: StorePrice): StorePrice {
  return { ...base, itemName: item, sourceType: 'catalog', sourceUrl: googlePriceSearchUrl(item) };
}

function unavailablePrice(item: string): StorePrice {
  return {
    itemName: item,
    keellsPrice: 0,
    cargillsPrice: 0,
    polaPrice: 0,
    unit: 'per kg',
    sourceType: 'unavailable',
    sourceUrl: googlePriceSearchUrl(item),
  };
}

function fromSerp(item: string, serp: Partial<StorePrice>, base?: StorePrice): StorePrice {
  return {
    ...(base || {}),
    ...serp,
    itemName: item,
    keellsPrice: serp.keellsPrice!,
    cargillsPrice: serp.cargillsPrice ?? serp.keellsPrice!,
    polaPrice: serp.polaPrice ?? Math.round(serp.keellsPrice! * 0.9),
    unit: serp.unit || base?.unit || 'per kg',
    // Web snippet estimate — not a verified store shelf price
    sourceType: 'serpapi',
    sourceUrl: googlePriceSearchUrl(item),
  };
}

async function persistIfLive(price: StorePrice): Promise<void> {
  // Persist verified store / wholesale lookups only — not catalog or web estimates
  if (price.sourceType === 'store_crawl' || price.sourceType === 'pola_wholesale' || price.sourceType === 'firecrawl') {
    await upsertPriceCache(price);
  }
}

async function fetchPriceForItem(
  item: string,
  options?: FetchPricesOptions
): Promise<{ price: StorePrice; live: boolean }> {
  const cached = getCached(item);
  if (cached) {
    planLog('prices', `cache hit — ${item} (${cached.sourceType})`);
    const live = cached.sourceType === 'store_crawl' || cached.sourceType === 'pola_wholesale';
    return { price: { ...cached, itemName: item }, live };
  }

  const base = findCatalogMatch(item);
  const catalogPrice = base ? fromCatalog(item, base) : null;
  const timeout = options?.crawlTimeoutMs ?? DEFAULT_CRAWL_TIMEOUT_MS;
  const explicitLive = wantsLiveStoreCrawl(options?.prompt);
  const canCrawl = crawlConfigured() && !options?.skipCrawl;

  const skipSerpForPieceCatalog = Boolean(catalogPrice && isPiecePricedUnit(catalogPrice.unit) && !explicitLive);
  const serpPromise = skipSerpForPieceCatalog ? Promise.resolve(null) : searchSerpPrices(item, base);
  const shouldTryCrawl = canCrawl && (explicitLive || !catalogPrice);
  const crawlPromise = shouldTryCrawl
    ? timebox(crawlSupermarketPrices(item, { timeoutMs: timeout }), timeout + 500)
    : Promise.resolve(null);

  const [serp, crawlResult] = await Promise.all([serpPromise, crawlPromise]);

  if (crawlResult) {
    const crawled = mergeStoreCrawlIntoPrice(item, base ?? null, crawlResult);
    if (crawled) {
      planLog('prices', `store crawl — ${item} → Keells ${crawled.keellsPrice} / Cargills ${crawled.cargillsPrice}`);
      setCached(item, crawled);
      await persistIfLive(crawled);
      return { price: crawled, live: true };
    }
    planWarn('prices', `store crawl empty — ${item}`);
  }

  if (serp?.keellsPrice) {
    const price = fromSerp(item, serp, base);
    if (catalogPrice && !isPlausibleStorePrice(price, base)) {
      planWarn('prices', `serpapi rejected for ${item} (LKR ${price.polaPrice}) — using catalog`);
      setCached(item, catalogPrice);
      return { price: catalogPrice, live: false };
    }
    planLog('prices', `serpapi web-estimate — ${item} → ~LKR ${price.keellsPrice} (${price.unit})`);
    setCached(item, price);
    await persistIfLive(price);
    // SerpAPI is an estimate, not a verified store crawl
    return { price, live: false };
  }

  if (canCrawl && !shouldTryCrawl) {
    const lateCrawl = await timebox(crawlSupermarketPrices(item, { timeoutMs: timeout }), timeout + 500);
    if (lateCrawl) {
      const crawled = mergeStoreCrawlIntoPrice(item, base ?? null, lateCrawl);
      if (crawled) {
        setCached(item, crawled);
        await persistIfLive(crawled);
        return { price: crawled, live: true };
      }
    }
  }

  const dbCached = await getCachedPrice(item);
  if (dbCached && (dbCached.keellsPrice || dbCached.cargillsPrice || dbCached.polaPrice)) {
    planLog('prices', `supabase cache — ${item}`);
    setCached(item, dbCached);
    return { price: { ...dbCached, itemName: item }, live: false };
  }

  if (catalogPrice) {
    planLog('prices', `catalog — ${item} → Keells ${catalogPrice.keellsPrice}`);
    setCached(item, catalogPrice);
    return { price: catalogPrice, live: false };
  }

  planWarn('prices', `no live price — ${item} (configure crawl/SerpAPI keys)`);
  return { price: unavailablePrice(item), live: false };
}

export async function fetchPricesForItems(
  items: string[],
  options?: FetchPricesOptions
): Promise<{ prices: StorePrice[]; liveCount: number }> {
  const unique = [...new Set(items.map((i) => i.trim()).filter(Boolean))];
  if (!unique.length) {
    const cached = await getRecentCachedPrices(20);
    return { prices: cached.length ? cached : BASE_CATALOG, liveCount: 0 };
  }

  planLog('prices', `fetch ${unique.length} item(s) in parallel`, {
    items: unique,
    liveCrawl: wantsLiveStoreCrawl(options?.prompt),
  });

  const settled = await Promise.all(unique.map((item) => fetchPriceForItem(item, options)));
  let liveCount = 0;
  const prices = settled.map(({ price, live }) => {
    if (live) liveCount++;
    return price;
  });

  return { prices, liveCount };
}

export async function getFullCatalog(): Promise<StorePrice[]> {
  const cached = await getRecentCachedPrices(20);
  return cached.length ? cached : BASE_CATALOG;
}

export function cheapestStore(price: StorePrice): 'Keells' | 'Cargills' | 'Pola' {
  const stores = [
    { name: 'Keells' as const, p: price.keellsPrice },
    { name: 'Cargills' as const, p: price.cargillsPrice },
    { name: 'Pola' as const, p: price.polaPrice },
  ].filter((s) => s.p > 0);
  if (!stores.length) return 'Pola';
  return stores.sort((a, b) => a.p - b.p)[0].name;
}
