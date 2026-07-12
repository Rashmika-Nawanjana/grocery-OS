import type { CrisisAlert, TrafficCondition } from '@/lib/types';
import { fetchWeather } from '@/lib/services/weather';
import { fetchCrisisNews } from '@/lib/services/news';

async function fetchTrafficSnapshot(crisisHeadlines?: string[]): Promise<TrafficCondition> {
  const key = process.env.SERPAPI_KEY;
  let blocked = false;
  let congestion: TrafficCondition['status'] = 'clear';

  if (key) {
    try {
      const q = encodeURIComponent('Colombo traffic Galle Road Keells congestion Sri Lanka');
      const res = await fetch(`https://serpapi.com/search.json?q=${q}&api_key=${key}&num=3`);
      if (res.ok) {
        const data = await res.json();
        const text = [
          data.answer_box?.snippet,
          ...(data.organic_results || []).map((r: { snippet?: string }) => r.snippet),
          ...(crisisHeadlines || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        blocked = text.includes('blocked') || text.includes('flooded') || text.includes('closed');
        congestion = blocked ? 'blocked' : text.includes('congest') || text.includes('jam') ? 'congested' : 'clear';
      }
    } catch {
      /* use defaults below */
    }
  }

  return {
    route: 'Colombo metro — home to supermarkets',
    status: congestion,
    estimatedTimeMin: blocked ? 110 : congestion === 'congested' ? 75 : 25,
    fuelAdjustedCostLkr: blocked ? 680 : congestion === 'congested' ? 450 : 220,
    alternativeRoute: congestion !== 'clear' ? 'Via Attidiya → Cargills Battaramulla' : undefined,
    alternativeTimeMin: congestion !== 'clear' ? 35 : undefined,
    recommendedStore: blocked || congestion === 'congested' ? 'Cargills Battaramulla' : 'Pola (cheapest)',
  };
}

export async function fetchDashboardEnv() {
  const crisis = await fetchCrisisNews('Sri Lanka Colombo');
  const [weather, traffic] = await Promise.all([
    fetchWeather(),
    fetchTrafficSnapshot(crisis.newsHeadlines),
  ]);

  return {
    weather,
    traffic,
    crisis,
    fetchedAt: new Date().toISOString(),
  };
}

export type DashboardEnvPayload = Awaited<ReturnType<typeof fetchDashboardEnv>>;
