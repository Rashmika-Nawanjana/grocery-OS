import type { StorePriceSource } from '@/lib/services/store-crawlers';
import { extractPriceNearItem } from '@/lib/services/store-crawlers';

/** Pola = open-air wholesale / village market in Sri Lanka — typically below supermarket shelf prices. */

async function scrapePage(url: string): Promise<string | null> {
  const token = process.env.SCRAPE_DO_TOKEN?.trim();
  if (token) {
    try {
      const apiUrl = `https://api.scrape.do?token=${encodeURIComponent(token)}&url=${encodeURIComponent(url)}&render=true`;
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(45_000) });
      if (res.ok) return await res.text();
    } catch {
      /* try firecrawl */
    }
  }
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown'], waitFor: 3000 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.markdown || data.markdown || null;
  } catch {
    return null;
  }
}

async function searchSerpPolaPrice(item: string): Promise<StorePriceSource | null> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return null;
  try {
    const q = encodeURIComponent(`${item} wholesale price pola market Dambulla Sri Lanka LKR per kg`);
    const res = await fetch(`https://serpapi.com/search.json?q=${q}&api_key=${key}&num=8`);
    if (!res.ok) return null;
    const data = await res.json();
    const text = [
      data.answer_box?.snippet,
      ...(data.organic_results || []).map((r: { snippet?: string; title?: string }) => `${r.title} ${r.snippet}`),
    ]
      .filter(Boolean)
      .join(' ');

    const prices = [...text.matchAll(/(?:rs\.?|lkr)\s*([\d,]+(?:\.\d+)?)/gi)]
      .map((m) => parseFloat(m[1].replace(/,/g, '')))
      .filter((p) => p >= 15 && p <= 25000);

    if (!prices.length) return null;
    const wholesale = Math.min(...prices);
    return {
      price: Math.round(wholesale),
      url: `https://www.google.com/search?q=${q}`,
      provider: 'fetch',
      note: 'Pola/wholesale from market search (SerpAPI)',
    };
  } catch {
    return null;
  }
}

/** Attempt live pola / wholesale price before supermarket-derived estimate. */
export async function fetchPolaWholesalePrice(item: string): Promise<(StorePriceSource & { note?: string }) | null> {
  const anypriceUrl = `https://anyprice.lk/search?q=${encodeURIComponent(`${item} wholesale`)}`;
  const content = await scrapePage(anypriceUrl);
  if (content) {
    const price = extractPriceNearItem(content, item);
    if (price) {
      return {
        price,
        url: anypriceUrl,
        provider: process.env.SCRAPE_DO_TOKEN ? 'scrape.do' : 'firecrawl',
        note: 'Pola/wholesale via AnyPrice.lk aggregator',
      };
    }
  }

  return searchSerpPolaPrice(item);
}

export function polaEstimateFromSupermarkets(
  keells?: number,
  cargills?: number
): (StorePriceSource & { note?: string }) | undefined {
  const base = [keells, cargills].filter((p): p is number => typeof p === 'number' && p > 0);
  if (!base.length) return undefined;
  const min = Math.min(...base);
  return {
    price: Math.round(min * 0.88),
    url: 'https://www.cbsl.gov.lk/en/statistics/economic-indicators/consumer-price-indices',
    provider: 'fetch',
    note: 'Estimated pola (~12% below nearest supermarket — no wholesale feed matched)',
  };
}
