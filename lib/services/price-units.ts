import type { StorePrice } from '@/lib/types';

/** Max plausible Pola unit prices — rejects bad SerpAPI / crawl outliers. */
const PLAUSIBLE_MAX_POLA: Record<string, number> = {
  bread: 350,
  'bread loaf': 350,
  'peanut butter': 1200,
  jam: 700,
  tuna: 500,
  'canned tuna': 500,
  salt: 250,
  chilli: 600,
  turmeric: 500,
  'curry leaves': 300,
  'green chilies': 800,
  rice: 600,
  egg: 80,
  eggs: 80,
};

export function isPiecePricedUnit(unit?: string): boolean {
  if (!unit) return false;
  return /per loaf|per jar|per can|per item|per pack|per bottle/i.test(unit);
}

export function storeUnitPrice(row: StorePrice, store: 'Keells' | 'Cargills' | 'Pola'): number {
  const p = store === 'Keells' ? row.keellsPrice : store === 'Cargills' ? row.cargillsPrice : row.polaPrice;
  return Number.isFinite(p) ? p : 0;
}

/** Coerce Gemini/recipe amounts — undefined or non-numeric values become sensible defaults. */
export function safeQuantity(amount: unknown, unit?: string): number {
  const n = typeof amount === 'number' ? amount : parseFloat(String(amount ?? ''));
  if (Number.isFinite(n) && n > 0) return n;
  const u = (unit || '').toLowerCase();
  if (u === 'g' || u === 'ml') return 100;
  if (u === 'kg' || u === 'l') return 0.25;
  if (u === 'pcs' || u === 'cloves') return 1;
  if (u === 'tbsp' || u === 'tsp') return 1;
  return 1;
}

export function lineTotalForIngredient(
  priceRow: StorePrice | undefined,
  store: 'Keells' | 'Cargills' | 'Pola',
  amount: number,
  unit: string
): number {
  const qty = safeQuantity(amount, unit);
  if (!priceRow) return Math.max(50, Math.round(qty * 2));
  const unitPrice = storeUnitPrice(priceRow, store);
  if (!unitPrice) return Math.max(50, Math.round(qty * 2));
  if (unit === 'pcs' || unit === 'cloves' || isPiecePricedUnit(priceRow.unit)) {
    if (isPiecePricedUnit(priceRow.unit)) {
      return Math.round(unitPrice * Math.max(1, qty));
    }
    // Produce counted as pcs but priced per kg (onion, chili, etc.)
    return Math.max(25, Math.round(unitPrice * 0.08 * Math.max(1, qty)));
  }
  if (unit === 'g' || unit === 'ml') return Math.max(30, Math.round((unitPrice / 1000) * Math.max(qty, 50)));
  if (unit === 'kg' || unit === 'l') return Math.round(unitPrice * qty);
  if (unit === 'tbsp' || unit === 'tsp') return Math.max(25, Math.round(unitPrice * 0.015 * Math.max(1, qty)));
  if (/^(cloves?|leaves?|sprigs?|inch|pinch|small|medium|large|slice|slices)$/i.test(unit)) {
    return Math.max(15, Math.round(unitPrice * 0.003 * Math.max(1, qty)));
  }
  if (/portion|servings?/i.test(unit)) {
    return Math.max(25, Math.round(unitPrice * 0.04 * Math.max(1, qty)));
  }
  return Math.max(40, Math.round(unitPrice * 0.08 * Math.max(1, qty)));
}

export function safeLkr(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function maxPlausibleForItem(itemName: string, catalog?: StorePrice): number {
  const lower = itemName.toLowerCase();
  for (const [key, max] of Object.entries(PLAUSIBLE_MAX_POLA)) {
    if (lower.includes(key)) return max;
  }
  if (catalog) return Math.round(catalog.polaPrice * 2.5);
  return 5000;
}

/** Reject Serp/crawl prices that look like per-kg averages applied to jars/loaves/cans. */
export function isPlausibleStorePrice(candidate: StorePrice, catalog?: StorePrice): boolean {
  const max = maxPlausibleForItem(candidate.itemName, catalog);
  const pola = candidate.polaPrice;
  if (pola <= 0 || pola > max) return false;
  if (catalog && isPiecePricedUnit(catalog.unit) && pola > catalog.polaPrice * 2.2) return false;
  return true;
}

export function preferCatalogOverLive(catalog: StorePrice, live: StorePrice): StorePrice {
  if (isPlausibleStorePrice(live, catalog)) return live;
  return { ...catalog, sourceType: catalog.sourceType || 'catalog' };
}

export type PriceSourceKind = NonNullable<StorePrice['sourceType']>;

/** Short badge label for price provenance in the UI. */
export function priceSourceBadge(sourceType?: StorePrice['sourceType']): {
  label: string;
  className: string;
} | null {
  switch (sourceType) {
    case 'store_crawl':
    case 'firecrawl':
      return {
        label: 'live crawl',
        className: 'bg-[#DCFCE7] text-[#14532D] border-[#BBF7D0]',
      };
    case 'pola_wholesale':
      return {
        label: 'pola wholesale',
        className: 'bg-[#DCFCE7] text-[#14532D] border-[#BBF7D0]',
      };
    case 'serpapi':
      return {
        label: 'web estimate',
        className: 'bg-amber-50 text-amber-900 border-amber-200',
      };
    case 'estimate':
      return {
        label: 'estimate',
        className: 'bg-amber-50 text-amber-900 border-amber-200',
      };
    case 'catalog':
      return {
        label: 'catalog',
        className: 'bg-stone-100 text-stone-600 border-stone-200',
      };
    case 'unavailable':
      return {
        label: 'unavailable',
        className: 'bg-stone-100 text-stone-500 border-stone-200',
      };
    default:
      return null;
  }
}
