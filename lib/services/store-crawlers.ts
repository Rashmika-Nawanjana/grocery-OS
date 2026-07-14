import type { StorePrice } from '@/lib/types';
import { fetchPolaWholesalePrice, polaEstimateFromSupermarkets } from '@/lib/services/pola-prices';

export interface StorePriceSource {
  price: number;
  url: string;
  provider: 'firecrawl' | 'scrape.do' | 'fetch';
  note?: string;
  matchScore?: number;
  unitHint?: string;
}

export interface StoreCrawlResult {
  keells?: StorePriceSource;
  cargills?: StorePriceSource;
  pola?: StorePriceSource & { note?: string };
}

interface StoreConfig {
  id: 'keells' | 'cargills' | 'anyprice';
  label: string;
  buildSearchUrls: (item: string) => string[];
}

const STORE_CONFIGS: StoreConfig[] = [
  {
    id: 'keells',
    label: 'Keells Super',
    buildSearchUrls: (item) => [
      `https://www.keellssuper.com/search?search=${encodeURIComponent(item)}`,
      `https://www.keellssuper.com/search?searchTerm=${encodeURIComponent(item)}`,
    ],
  },
  {
    id: 'cargills',
    label: 'Cargills Online',
    buildSearchUrls: (item) => [
      `https://cargillsonline.com/search?q=${encodeURIComponent(item)}`,
      `https://cargillsonline.com/Web/search?search=${encodeURIComponent(item)}`,
    ],
  },
  {
    id: 'anyprice',
    label: 'AnyPrice.lk (aggregator)',
    buildSearchUrls: (item) => [
      `https://anyprice.lk/search?q=${encodeURIComponent(item)}`,
      `https://anyprice.lk/shops/cargillsonline/products?search=${encodeURIComponent(item)}`,
    ],
  },
];

export interface CrawlOptions {
  timeoutMs?: number;
}

export interface PriceMatch {
  price: number;
  score: number;
  unitHint?: string;
}

const MIN_MATCH_SCORE = 0.42;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !['the', 'and', 'per', 'for', 'with', 'from'].includes(t));
}

/** Score how well a text window matches the grocery query (0–1). */
export function scoreNameMatch(windowText: string, query: string): number {
  const windowTokens = new Set(tokenize(windowText));
  const queryTokens = tokenize(query);
  if (!queryTokens.length || !windowTokens.size) return 0;

  let hits = 0;
  for (const t of queryTokens) {
    if (windowTokens.has(t)) {
      hits += 1;
      continue;
    }
    // partial stem (tomato / tomatoes)
    const stem = t.replace(/s$/, '');
    if ([...windowTokens].some((w) => w === stem || w.startsWith(stem) || stem.startsWith(w))) {
      hits += 0.7;
    }
  }
  const coverage = hits / queryTokens.length;
  // Penalize huge windows that barely mention the item
  const density = hits / Math.max(windowTokens.size, 1);
  return Math.min(1, coverage * 0.75 + Math.min(density * 4, 0.25));
}

function detectUnitHint(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/\b(per\s*)?kg\b|\b1\s*kg\b|\bkilogram/.test(lower)) return 'per kg';
  if (/\b(per\s*)?g\b|\b100\s*g\b|\b250\s*g\b/.test(lower)) return 'per 100g pack';
  if (/\blitre|\bliter|\bml\b|\b400\s*ml\b/.test(lower)) return /\b400\s*ml\b/.test(lower) ? 'per 400ml pack' : 'per litre';
  if (/\bloaf\b/.test(lower)) return 'per loaf';
  if (/\bjar\b/.test(lower)) return 'per jar';
  if (/\bcan\b|\btin\b/.test(lower)) return 'per can';
  if (/\b(each|pcs?|piece|item|egg)\b/.test(lower)) return 'per item';
  return undefined;
}

/**
 * Find a product price that actually matches the query — reject weak/random page prices.
 */
export function extractMatchedProductPrice(text: string, item: string): PriceMatch | null {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 4);

  const candidates: PriceMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const window = [lines[i - 1], lines[i], lines[i + 1], lines[i + 2]].filter(Boolean).join(' ');
    if (!/(?:Rs\.?|LKR|රු)/i.test(window)) continue;

    const score = scoreNameMatch(window, item);
    if (score < MIN_MATCH_SCORE) continue;

    const prices = [...window.matchAll(/(?:Rs\.?|LKR|රු)\s*([\d,]+(?:\.\d{1,2})?)/gi)]
      .map((m) => parseFloat(m[1].replace(/,/g, '')))
      .filter((p) => p >= 15 && p <= 50000);
    if (!prices.length) continue;

    // Prefer the first price after the item mention when possible
    const lower = window.toLowerCase();
    const q = item.toLowerCase().split(/\s+/)[0];
    const idx = lower.indexOf(q.replace(/s$/, ''));
    let price = prices[0];
    if (idx >= 0) {
      const after = window.slice(idx);
      const afterPrices = [...after.matchAll(/(?:Rs\.?|LKR|රු)\s*([\d,]+(?:\.\d{1,2})?)/gi)]
        .map((m) => parseFloat(m[1].replace(/,/g, '')))
        .filter((p) => p >= 15 && p <= 50000);
      if (afterPrices.length) price = afterPrices[0];
    }

    candidates.push({
      price,
      score,
      unitHint: detectUnitHint(window),
    });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || a.price - b.price);
  return candidates[0].score >= MIN_MATCH_SCORE ? candidates[0] : null;
}

/** @deprecated use extractMatchedProductPrice — kept for callers expecting a number */
export function extractPriceNearItem(text: string, item: string): number | null {
  return extractMatchedProductPrice(text, item)?.price ?? null;
}

async function scrapeWithFirecrawl(url: string, timeoutMs: number): Promise<string | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown'], waitFor: 1200 }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.markdown || data.markdown || null;
  } catch {
    return null;
  }
}

async function scrapeWithScrapeDo(url: string, timeoutMs: number): Promise<string | null> {
  const token = process.env.SCRAPE_DO_TOKEN?.trim();
  if (!token) return null;
  try {
    const apiUrl = `https://api.scrape.do?token=${encodeURIComponent(token)}&url=${encodeURIComponent(url)}&render=true`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(Math.min(timeoutMs, 20_000)) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchPage(url: string, timeoutMs: number): Promise<string | null> {
  const firecrawl = await scrapeWithFirecrawl(url, timeoutMs);
  if (firecrawl && firecrawl.length > 200) return firecrawl;

  const scrapeDo = await scrapeWithScrapeDo(url, timeoutMs);
  if (scrapeDo && scrapeDo.length > 200) return scrapeDo;
  return null;
}

/** Public scrape helper for recipe pages / non-store URLs. */
export async function fetchPageContent(url: string, timeoutMs = 12_000): Promise<string | null> {
  return fetchPage(url, timeoutMs);
}

function providerLabel(): StorePriceSource['provider'] {
  if (process.env.FIRECRAWL_API_KEY) return 'firecrawl';
  if (process.env.SCRAPE_DO_TOKEN) return 'scrape.do';
  return 'fetch';
}

async function crawlStore(
  config: StoreConfig,
  item: string,
  timeoutMs: number
): Promise<StorePriceSource | null> {
  const urls = config.buildSearchUrls(item).filter((u) => !u.match(/\/$/));
  let best: StorePriceSource | null = null;

  for (const url of urls.slice(0, 2)) {
    const content = await fetchPage(url, timeoutMs);
    if (!content) continue;

    const match = extractMatchedProductPrice(content, item);
    if (!match) continue;

    const hit: StorePriceSource = {
      price: match.price,
      url,
      provider: providerLabel(),
      matchScore: match.score,
      unitHint: match.unitHint,
      note: `matched ${(match.score * 100).toFixed(0)}%`,
    };

    if (!best || (hit.matchScore ?? 0) > (best.matchScore ?? 0)) {
      best = hit;
    }
    // Good enough — stop early
    if ((hit.matchScore ?? 0) >= 0.65) break;
  }

  return best;
}

function polaEstimate(keells?: number, cargills?: number): (StorePriceSource & { note?: string }) | undefined {
  return polaEstimateFromSupermarkets(keells, cargills);
}

/** Crawl Keells + Cargills (+ AnyPrice only as labeled aggregator fallback). */
export async function crawlSupermarketPrices(item: string, options?: CrawlOptions): Promise<StoreCrawlResult> {
  const result: StoreCrawlResult = {};
  const timeoutMs = options?.timeoutMs ?? 12_000;

  const keellsConfig = STORE_CONFIGS.find((s) => s.id === 'keells')!;
  const cargillsConfig = STORE_CONFIGS.find((s) => s.id === 'cargills')!;
  const anypriceConfig = STORE_CONFIGS.find((s) => s.id === 'anyprice')!;

  const [keellsHit, cargillsHit, anypriceHit] = await Promise.all([
    crawlStore(keellsConfig, item, timeoutMs),
    crawlStore(cargillsConfig, item, timeoutMs),
    crawlStore(anypriceConfig, item, timeoutMs),
  ]);

  if (keellsHit) result.keells = keellsHit;
  if (cargillsHit) result.cargills = cargillsHit;

  // AnyPrice only fills a missing store as aggregator — never invent Keells = AnyPrice × 1.05
  if (!result.cargills && anypriceHit) {
    result.cargills = {
      ...anypriceHit,
      note: `${anypriceHit.note || ''} · anyprice.lk aggregator`.trim(),
    };
  }
  if (!result.keells && anypriceHit && result.cargills) {
    // Leave Keells empty rather than fabricating — merge step handles single-store
  }

  const polaLive = await fetchPolaWholesalePrice(item);
  if (polaLive) result.pola = polaLive;
  else {
    const pola = polaEstimate(result.keells?.price, result.cargills?.price);
    if (pola) result.pola = { ...pola, note: pola.note || 'estimated ~12% below supermarket' };
  }

  return result;
}

export function mergeStoreCrawlIntoPrice(
  item: string,
  base: Partial<StorePrice> | null,
  crawl: StoreCrawlResult
): StorePrice | null {
  if (!crawl.keells && !crawl.cargills) return null;

  const keellsPrice = crawl.keells?.price ?? 0;
  const cargillsPrice = crawl.cargills?.price ?? 0;
  const polaPrice =
    crawl.pola?.price ??
    (keellsPrice || cargillsPrice
      ? Math.round(Math.min(keellsPrice || 99999, cargillsPrice || 99999) * 0.88)
      : 0);

  const unitHint = crawl.keells?.unitHint || crawl.cargills?.unitHint;
  const primaryUrl = crawl.keells?.url || crawl.cargills?.url || base?.sourceUrl;

  return {
    itemName: item,
    keellsPrice: keellsPrice || cargillsPrice,
    cargillsPrice: cargillsPrice || keellsPrice,
    polaPrice: polaPrice || Math.min(keellsPrice || cargillsPrice, cargillsPrice || keellsPrice),
    unit: unitHint || base?.unit || 'per kg',
    sourceType: 'store_crawl',
    sourceUrl: primaryUrl,
    storeSources: {
      ...(crawl.keells ? { keells: crawl.keells } : {}),
      ...(crawl.cargills ? { cargills: crawl.cargills } : {}),
      ...(crawl.pola ? { pola: crawl.pola } : {}),
    },
  };
}

export function storeSearchUrls(item: string): { keells: string; cargills: string } {
  return {
    keells: STORE_CONFIGS[0].buildSearchUrls(item)[0],
    cargills: STORE_CONFIGS[1].buildSearchUrls(item)[0],
  };
}
