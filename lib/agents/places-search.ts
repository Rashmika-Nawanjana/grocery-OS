import type { AgentContext, AgentExecutionLog, LocalBusiness } from '@/lib/types';
import { searchGoogleMapsPlaces, wantsLocalPlacesSearch } from '@/lib/services/google-maps-places';

export async function runPlacesSearch(
  ctx: AgentContext
): Promise<{ log: AgentExecutionLog; places: LocalBusiness[]; query: string }> {
  const log: AgentExecutionLog = {
    agentId: 'places-search',
    agentName: 'Google Maps Places',
    status: 'active',
    message: 'Searching Google Maps for nearby businesses and price ranges...',
  };

  if (!wantsLocalPlacesSearch(ctx.prompt)) {
    log.status = 'skipped';
    log.message = 'Not a local business / restaurant query.';
    return { log, places: [], query: '' };
  }

  const homeArea = ctx.memoryContext?.match(/home area:\s*([^\n]+)/i)?.[1]?.trim();
  const { places, query, source } = await searchGoogleMapsPlaces({
    prompt: ctx.prompt,
    homeArea,
  });

  if (!places.length) {
    log.status = source === 'unavailable' ? 'warn' : 'warn';
    log.message =
      source === 'unavailable'
        ? 'Google Maps search unavailable (check SERPAPI_KEY).'
        : `No places found for "${query}". Try a specific area, e.g. "restaurants in Negombo".`;
    return { log, places: [], query };
  }

  log.status = 'success';
  log.message = `Found ${places.length} place(s) via Google Maps — "${query}".`;
  log.details = { query, top: places.slice(0, 3).map((p) => p.name) };
  return { log, places, query };
}
