import type { StorePrice } from '@/lib/types';
import { fetchPolaWholesalePrice, polaEstimateFromSupermarkets } from '@/lib/services/pola-prices';

export interface StorePriceSource {
  price: number;
  url: string;
  provider: 'firecrawl' | 'scrape.do' | 'fetch';
  note?: string;
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
      `https://www.keellssuper.com/`,
    ],
  },
  {
    id: 'cargills',
    label: 'Cargills Online',
    buildSearchUrls: (item) => [
      `https://cargillsonline.com/search?q=${encodeURIComponent(item)}`,
      `https://cargillsonline.com/Web/search?search=${encodeURIComponent(item)}`,
      `https://cargillsonline.com/`,
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

/** Extract the most likely product price near the search term in page text. */
export function extractPriceNearItem(text: string, item: string): number | null {
  const normalizedItem = item.toLowerCase().replace(/s$/, '');
  const allPrices = [...text.matchAll(/(?:Rs\.?|LKR)\s*([\d,]+(?:\.\d{2})?)/gi)]
    .map((m) => parseFloat(m[1].replace(/,/g, '')))
    .filter((p) => p >= 15 && p <= 25000);

  if (!allPrices.length) return null;

  const lower = text.toLowerCase();
  const idx = lower.indexOf(normalizedItem);
  if (idx >= 0) {
    const window = text.slice(Math.max(0, idx - 120), idx + 350);
    const near = [...window.matchAll(/(?:Rs\.?|LKR)\s*([\d,]+(?:\.\d{2})?)/gi)]
      .map((m) => parseFloat(m[1].replace(/,/g, '')))
      .filter((p) => p >= 15 && p <= 25000);
    if (near.length) return near[0];
  }

  const sorted = [...allPrices].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 3)] ?? sorted[0];
}

async function crawlStore(
  config: StoreConfig,
  item: string,
  timeoutMs: number
): Promise<{ price: number; url: string; provider: StorePriceSource['provider'] } | null> {
  const url = config.buildSearchUrls(item)[0];
  const content = await fetchPage(url, timeoutMs);
  if (!content) return null;

  const price = extractPriceNearItem(content, item);
  if (!price) return null;

  const provider: StorePriceSource['provider'] = process.env.FIRECRAWL_API_KEY
    ? 'firecrawl'
    : process.env.SCRAPE_DO_TOKEN
      ? 'scrape.do'
      : 'fetch';
  return { price, url, provider };
}

function polaEstimate(keells?: number, cargills?: number): (StorePriceSource & { note?: string }) | undefined {
  return polaEstimateFromSupermarkets(keells, cargills);
}

/** Crawl Keells + Cargills (+ AnyPrice fallback) for a grocery item. */
export async function crawlSupermarketPrices(item: string, options?: CrawlOptions): Promise<StoreCrawlResult> {
  const result: StoreCrawlResult = {};
  const timeoutMs = options?.timeoutMs ?? 8000;

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

  if (!result.cargills && anypriceHit) {
    result.cargills = { ...anypriceHit, url: anypriceHit.url };
  }
  if (!result.keells && anypriceHit && anypriceHit.price) {
    result.keells = {
      price: Math.round(anypriceHit.price * 1.05),
      url: anypriceHit.url,
      provider: anypriceHit.provider,
    };
  }

  const polaLive = await fetchPolaWholesalePrice(item);
  if (polaLive) result.pola = polaLive;
  else {
    const pola = polaEstimate(result.keells?.price, result.cargills?.price);
    if (pola) result.pola = pola;
  }

  return result;
}

export function mergeStoreCrawlIntoPrice(
  item: string,
  base: Partial<StorePrice> | null,
  crawl: StoreCrawlResult
): StorePrice | null {
  if (!crawl.keells && !crawl.cargills) return null;

  const keellsPrice = crawl.keells?.price ?? base?.keellsPrice ?? 0;
  const cargillsPrice = crawl.cargills?.price ?? base?.cargillsPrice ?? 0;
  const polaPrice = crawl.pola?.price ?? base?.polaPrice ?? Math.round(Math.min(keellsPrice || 9999, cargillsPrice || 9999) * 0.88);

  const primaryUrl = crawl.keells?.url || crawl.cargills?.url || base?.sourceUrl;

  return {
    itemName: item,
    keellsPrice: keellsPrice || cargillsPrice,
    cargillsPrice: cargillsPrice || keellsPrice,
    polaPrice: polaPrice || Math.min(keellsPrice, cargillsPrice),
    unit: base?.unit || 'per kg',
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
