import type { AgentContext, AgentExecutionLog, TrafficCondition } from '@/lib/types';

export async function runRouteOptimizer(
  ctx: AgentContext,
  crisisHeadlines?: string[]
): Promise<{ log: AgentExecutionLog; traffic: TrafficCondition }> {
  const log: AgentExecutionLog = {
    agentId: 'route-optimizer',
    agentName: 'Agent 3: Route Optimizer',
    status: 'active',
    message: 'Analyzing traffic conditions and store routes...',
  };

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
      /* use defaults */
    }
  }

  const preferred = ctx.preferredStores?.[0];
  const preferredStore =
    preferred && /keells/i.test(preferred)
      ? 'Keells Super'
      : preferred && /cargills/i.test(preferred)
        ? 'Cargills Food City'
        : preferred && /pola/i.test(preferred)
          ? 'Pola (cheapest)'
          : null;

  const traffic: TrafficCondition = {
    route: preferredStore
      ? `Home → ${preferredStore}`
      : 'Ratmalana (Home) → Keells Colombo 7',
    status: congestion,
    estimatedTimeMin: blocked ? 110 : congestion === 'congested' ? 75 : 25,
    fuelAdjustedCostLkr: blocked ? 680 : congestion === 'congested' ? 450 : 220,
    alternativeRoute: 'Ratmalana via Attidiya → Cargills Battaramulla',
    alternativeTimeMin: 35,
    recommendedStore:
      blocked || congestion === 'congested'
        ? 'Cargills Battaramulla'
        : preferredStore || 'Pola (cheapest)',
  };

  log.status = 'success';
  log.message =
    traffic.status === 'clear'
      ? `Routes clear. ${traffic.recommendedStore} recommended${preferredStore ? ' (from your preferred stores)' : ' for best prices'}.`
      : `Traffic ${traffic.status}. Redirect to ${traffic.recommendedStore} (saves ~LKR ${traffic.fuelAdjustedCostLkr - 220} fuel).`;
  log.details = traffic;

  return { log, traffic };
}
