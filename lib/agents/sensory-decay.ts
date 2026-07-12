import type { AgentContext, AgentExecutionLog, SpoilageAlert } from '@/lib/types';
import type { WeatherCondition } from '@/lib/types';
import { fetchWeather } from '@/lib/services/weather';
import { homeAreaFromContext } from '@/lib/services/location';
import { computeSpoilageAlerts } from '@/lib/services/spoilage';

export async function runSensoryDecay(
  ctx: AgentContext,
  weather?: WeatherCondition
): Promise<{ log: AgentExecutionLog; weather: WeatherCondition; alerts: SpoilageAlert[] }> {
  const log: AgentExecutionLog = {
    agentId: 'sensory-decay',
    agentName: 'Agent 5: Sensory Decay',
    status: 'active',
    message: 'Fetching live weather and computing spoilage from pantry expiry data...',
  };

  const liveWeather = weather || (await fetchWeather(homeAreaFromContext(ctx.memoryContext)));
  const alerts = computeSpoilageAlerts(ctx.inventory, liveWeather);

  log.status = alerts.length ? 'success' : 'warn';
  log.message = alerts.length
    ? `Weather: ${liveWeather.condition}, ${liveWeather.temperature}°C, rain ${liveWeather.rainMm}mm. ${alerts.length} pantry item(s) tracked for spoilage.`
    : `Weather: ${liveWeather.condition}, ${liveWeather.temperature}°C. No perishable pantry items — add inventory with expiry days in Supabase.`;
  log.details = { alerts, location: liveWeather.location, pantryItems: ctx.inventory.length, source: liveWeather.source };

  return { log, weather: liveWeather, alerts };
}
