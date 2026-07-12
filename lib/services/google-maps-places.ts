import type { LocalBusiness } from '@/lib/types';
import { planLog, planWarn } from '@/lib/plan-logger';

const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { places: LocalBusiness[]; expiresAt: number }>();

/** Default map center when no area is in the prompt (Negombo — common PlanGro demo area). */
const DEFAULT_LL = '@7.2083,79.8358,14z';

export function wantsLocalPlacesSearch(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return (
    /\b(ordering out|order out|food delivery|takeaway|restaurant delivery|pickme food|uber eats)\b/i.test(
      lower
    ) ||
    /\b(restaurant|restaurants|eat\s+out|dining|nearby\s+food|google\s*maps|places|caf[eé]|lunch\s+spot|dinner\s+spot)\b/i.test(
      lower
    ) ||
    /\b(where\s+to\s+eat|best\s+food\s+in|food\s+in\s+|places\s+in\s+|near\s+me)\b/i.test(lower)
  );
}

export function buildPlacesSearchQuery(prompt: string, homeArea?: string): string {
  const lower = prompt.toLowerCase();

  const inMatch = prompt.match(
    /\b(?:in|near|around|at)\s+([A-Za-z][A-Za-z\s'-]{2,28}?)(?:\?|,|\.|$|\s+(?:for|with|under|below))/i
  );
  const location = inMatch?.[1]?.trim() || homeArea?.trim() || 'Negombo, Sri Lanka';

  if (/\bcafe|coffee\b/i.test(lower)) return `cafes ${location}`;
  if (/\bsupermarket|grocery|keells|cargills\b/i.test(lower)) return `supermarkets ${location}`;
  if (/\bhotel\b/i.test(lower)) return `hotels ${location}`;
  if (/\b(bakery|bakeries)\b/i.test(lower)) return `bakeries ${location}`;

  return `restaurants ${location}`;
}

function parseLkrPriceRange(price?: string): { minLkr?: number; maxLkr?: number } {
  if (!price) return {};
  const normalized = price.replace(/,/g, '');
  const range = normalized.match(/(?:rs\.?|lkr)?\s*(\d+)\s*[–\-—to]+\s*(\d+)/i);
  if (range) return { minLkr: parseInt(range[1], 10), maxLkr: parseInt(range[2], 10) };
  const single = normalized.match(/(?:rs\.?|lkr)\s*(\d+)/i);
  if (single) {
    const v = parseInt(single[1], 10);
    return { minLkr: v, maxLkr: v };
  }
  return {};
}

function mapsUrl(title: string, address?: string): string {
  const q = encodeURIComponent([title, address].filter(Boolean).join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

interface SerpLocalResult {
  title?: string;
  place_id?: string;
  rating?: number;
  reviews?: number;
  price?: string;
  type?: string;
  types?: string[];
  address?: string;
  open_state?: string;
  hours?: string;
  phone?: string;
  website?: string;
  thumbnail?: string;
  gps_coordinates?: { latitude: number; longitude: number };
  service_options?: { dine_in?: boolean; takeout?: boolean; delivery?: boolean };
  place_id_search?: string;
}

function normalizePlace(row: SerpLocalResult, index: number): LocalBusiness | null {
  if (!row.title) return null;
  const { minLkr, maxLkr } = parseLkrPriceRange(row.price);
  const services: string[] = [];
  if (row.service_options?.dine_in) services.push('Dine-in');
  if (row.service_options?.takeout) services.push('Takeaway');
  if (row.service_options?.delivery) services.push('Delivery');

  return {
    name: row.title,
    rating: row.rating,
    reviewCount: row.reviews,
    priceLabel: row.price,
    priceMinLkr: minLkr,
    priceMaxLkr: maxLkr,
    category: row.type || row.types?.[0],
    address: row.address,
    openState: row.open_state || row.hours,
    phone: row.phone,
    website: row.website,
    thumbnailUrl: row.thumbnail,
    services,
    placeId: row.place_id,
    mapsUrl: mapsUrl(row.title, row.address),
    sourceUrl: row.place_id_search,
    rank: index + 1,
  };
}

export interface SearchPlacesOptions {
  prompt: string;
  homeArea?: string;
  maxResults?: number;
  /** Skip prompt parsing — use this Google Maps query directly. */
  queryOverride?: string;
}

export interface SearchPlacesResult {
  places: LocalBusiness[];
  query: string;
  source: 'serpapi_google_maps' | 'cache' | 'unavailable';
}

export async function searchGoogleMapsPlaces(options: SearchPlacesOptions): Promise<SearchPlacesResult> {
  const query = options.queryOverride?.trim() || buildPlacesSearchQuery(options.prompt, options.homeArea);
  const maxResults = options.maxResults ?? 8;
  const cacheKey = query.toLowerCase();

  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now()) {
    planLog('places', `cache hit — "${query}" (${hit.places.length} places)`);
    return { places: hit.places.slice(0, maxResults), query, source: 'cache' };
  }

  const key = process.env.SERPAPI_KEY?.trim();
  if (!key) {
    planWarn('places', 'SERPAPI_KEY missing — Google Maps places search unavailable');
    return { places: [], query, source: 'unavailable' };
  }

  try {
    const params = new URLSearchParams({
      engine: 'google_maps',
      q: query,
      type: 'search',
      hl: 'en',
      google_domain: 'google.com',
      api_key: key,
    });
    if (process.env.GOOGLE_MAPS_LL?.trim()) {
      params.set('ll', process.env.GOOGLE_MAPS_LL.trim());
    } else {
      params.set('ll', DEFAULT_LL);
    }

    planLog('places', `Google Maps search — "${query}"`);
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      planWarn('places', `SerpAPI HTTP ${res.status} for "${query}"`);
      return { places: [], query, source: 'unavailable' };
    }

    const data = (await res.json()) as { local_results?: SerpLocalResult[]; error?: string };
    if (data.error) {
      planWarn('places', `SerpAPI error: ${data.error}`);
      return { places: [], query, source: 'unavailable' };
    }

    const places = (data.local_results ?? [])
      .map((row, i) => normalizePlace(row, i))
      .filter((p): p is LocalBusiness => Boolean(p))
      .slice(0, maxResults);

    planLog(
      'places',
      `Found ${places.length} place(s)`,
      places.slice(0, 3).map((p) => `${p.name} — ${p.priceLabel || 'no price'}`)
    );

    cache.set(cacheKey, { places, expiresAt: Date.now() + CACHE_TTL_MS });
    return { places, query, source: 'serpapi_google_maps' };
  } catch (err) {
    planWarn('places', `Search failed: ${err instanceof Error ? err.message : String(err)}`);
    return { places: [], query, source: 'unavailable' };
  }
}
