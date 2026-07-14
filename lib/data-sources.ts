import type { CrisisAlert, DataSource, Recipe, StorePrice, WeatherCondition } from '@/lib/types';

const THEMEALDB = 'https://www.themealdb.com';
const VERTEX_DOC = 'https://cloud.google.com/vertex-ai/generative-ai/docs';
const OPENWEATHER = 'https://openweathermap.org/city/1248991';
const NEWS_API = 'https://newsapi.org';

export function googlePriceSearchUrl(item: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${item} price Sri Lanka supermarket LKR`)}`;
}

export function collectOrchestrationSources(input: {
  agentsRun: string[];
  prices: StorePrice[];
  recipes: Recipe[];
  weather: WeatherCondition;
  crisis: CrisisAlert;
  priceLiveCount: number;
  supabaseUrl?: string;
}): DataSource[] {
  const sources: DataSource[] = [];
  const seen = new Set<string>();

  const add = (s: DataSource) => {
    const key = `${s.agentId}:${s.label}:${s.url || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    sources.push(s);
  };

  if (input.agentsRun.includes('inventory-rag')) {
    add({
      agentId: 'inventory-rag',
      agentName: 'Agent 1: Home Inventory RAG',
      label: 'Supabase pantry (pgvector rank + keyword relevance)',
      url: input.supabaseUrl || undefined,
      kind: 'database',
    });
  }

  if (input.agentsRun.includes('recipe-compiler')) {
    add({
      agentId: 'recipe-compiler',
      agentName: 'Agent 2: Recipe Compiler',
      label: 'TheMealDB recipe API (search + ingredient + area)',
      url: `${THEMEALDB}/api/json/v1/1/`,
      kind: 'api',
    });
    add({
      agentId: 'recipe-compiler',
      agentName: 'Agent 2: Recipe Compiler',
      label: 'Vertex AI Gemini — pick best TheMealDB meals for pantry',
      url: VERTEX_DOC,
      kind: 'ai',
    });
    for (const r of input.recipes) {
      if (r.id && /^\d+$/.test(r.id)) {
        add({
          agentId: 'recipe-compiler',
          agentName: 'Agent 2: Recipe Compiler',
          label: `Recipe: ${r.name}`,
          url: `${THEMEALDB}/meal/${r.id}`,
          kind: 'api',
        });
      }
    }
  }

  if (input.agentsRun.includes('price-catalog')) {
    add({
      agentId: 'price-catalog',
      agentName: 'Agent 7: Price Catalog',
      label: `PlanGro static catalog (baseline) — ${input.prices.length} items`,
      kind: 'catalog',
    });
    if (input.priceLiveCount > 0) {
      add({
        agentId: 'price-catalog',
        agentName: 'Agent 7: Price Catalog',
        label: `Supermarket crawlers (Keells / Cargills) — ${input.priceLiveCount} live lookup(s)`,
        url: 'https://www.keellssuper.com/',
        kind: 'scrape',
      });
    }
    for (const p of input.prices) {
      if (p.storeSources?.keells) {
        add({
          agentId: 'price-catalog',
          agentName: 'Agent 7: Price Catalog',
          label: `${p.itemName} @ Keells — LKR ${p.storeSources.keells.price}`,
          url: p.storeSources.keells.url,
          kind: 'scrape',
        });
      }
      if (p.storeSources?.cargills) {
        add({
          agentId: 'price-catalog',
          agentName: 'Agent 7: Price Catalog',
          label: `${p.itemName} @ Cargills — LKR ${p.storeSources.cargills.price}`,
          url: p.storeSources.cargills.url,
          kind: 'scrape',
        });
      }
      if (p.storeSources?.pola) {
        add({
          agentId: 'price-catalog',
          agentName: 'Agent 7: Price Catalog',
          label: `${p.itemName} @ Pola (est.) — LKR ${p.storeSources.pola.price}`,
          url: p.storeSources.pola.url,
          kind: 'catalog',
        });
      }
      if (!p.storeSources) {
        add({
          agentId: 'price-catalog',
          agentName: 'Agent 7: Price Catalog',
          label: `${p.itemName} (${p.sourceType || 'catalog'}) — Keells LKR ${p.keellsPrice}, Pola LKR ${p.polaPrice}`,
          url: p.sourceUrl || googlePriceSearchUrl(p.itemName),
          kind: p.sourceType === 'catalog' || p.sourceType === 'estimate' ? 'catalog' : 'scrape',
        });
      }
    }
  }

  if (input.agentsRun.includes('sensory-decay')) {
    add({
      agentId: 'sensory-decay',
      agentName: 'Agent 5: Sensory Decay',
      label: `OpenWeather ${input.weather.location || 'Colombo'} + Supabase pantry expiry — ${input.weather.condition}, ${input.weather.temperature}°C`,
      url: OPENWEATHER,
      kind: 'api',
    });
    if (input.supabaseUrl) {
      add({
        agentId: 'sensory-decay',
        agentName: 'Agent 5: Sensory Decay',
        label: 'Pantry expiry_days (Supabase inventory)',
        url: `${input.supabaseUrl.replace(/\/$/, '')}/project/default/editor`,
        kind: 'database',
      });
    }
  }

  if (input.agentsRun.includes('crisis-agent')) {
    add({
      agentId: 'crisis-agent',
      agentName: 'Agent 7: Crisis Intelligence',
      label: 'NewsAPI — Sri Lanka crisis headlines',
      url: NEWS_API,
      kind: 'api',
    });
    for (const h of input.crisis.newsHeadlines?.slice(0, 3) || []) {
      add({
        agentId: 'crisis-agent',
        agentName: 'Agent 7: Crisis Intelligence',
        label: `Headline: ${h.slice(0, 80)}${h.length > 80 ? '…' : ''}`,
        kind: 'api',
      });
    }
  }

  if (input.agentsRun.includes('dietary-guard')) {
    add({
      agentId: 'dietary-guard',
      agentName: 'Agent 6: Dietary Guard',
      label: 'Household allergies & restrictions (Supabase family_members) + Open Food Facts',
      url: input.supabaseUrl || VERTEX_DOC,
      kind: 'ai',
    });
  }

  if (input.agentsRun.includes('route-optimizer')) {
    add({
      agentId: 'route-optimizer',
      agentName: 'Agent 3: Route Optimizer',
      label: 'Route heuristics + crisis/traffic context (no live GPS API)',
      kind: 'catalog',
    });
  }

  if (input.agentsRun.includes('places-search')) {
    add({
      agentId: 'places-search',
      agentName: 'Google Maps Places',
      label: 'SerpAPI Google Maps — local businesses & price ranges',
      url: 'https://serpapi.com/google-maps-api',
      kind: 'api',
    });
  }

  add({
    agentId: 'orchestrator',
    agentName: 'Agent 4: Orchestrator',
    label: 'Vertex AI Gemini intent + summary (chat reply text)',
    url: VERTEX_DOC,
    kind: 'ai',
  });

  return sources;
}

export function sourcesForAgent(sources: DataSource[], agentId: string): DataSource[] {
  return sources.filter((s) => s.agentId === agentId);
}
