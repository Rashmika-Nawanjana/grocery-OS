import type { AgentContext, AgentExecutionLog, StorePrice } from '@/lib/types';
import { fetchPricesForItems, getFullCatalog, wantsLiveStoreCrawl } from '@/lib/services/scraper';
import { extractItemsFromPrompt, isPriceLookupRequest } from '@/lib/agents/price-query';

export { extractItemsFromPrompt, isPriceLookupRequest } from '@/lib/agents/price-query';

export async function runPriceCatalog(
  ctx: AgentContext,
  itemNames?: string[]
): Promise<{ log: AgentExecutionLog; prices: StorePrice[]; liveCount: number }> {
  const log: AgentExecutionLog = {
    agentId: 'price-catalog',
    agentName: 'Agent 7: Price Catalog',
    status: 'active',
    message: 'Comparing prices across Keells, Cargills, and Pola...',
  };

  let items: string[] = [];

  const promptItems = extractItemsFromPrompt(ctx.prompt);

  if (isPriceLookupRequest(ctx.prompt) && promptItems.length) {
    items = promptItems;
    log.message = `Price lookup for: ${items.join(', ')}`;
  } else if (ctx.scenario === 'decided_menu' && (ctx.decidedItems?.length || itemNames?.length)) {
    items = ctx.decidedItems || itemNames || [];
    log.message = `Looking up prices for decided items: ${items.join(', ')}`;
  } else if (ctx.scenario === 'shopping_trip') {
    items = itemNames?.length ? itemNames : promptItems;
    log.message = `Building shopping price catalog for: ${items.join(', ') || 'full basket'}`;
  } else {
    items = itemNames?.length ? itemNames : promptItems;
    if (!items.length) items = ['rice', 'dhal', 'chicken', 'tomatoes', 'eggs', 'onions'];
    log.message = `Finding prices for suitable products: ${items.join(', ')}`;
  }

  const { prices, liveCount } = items.length
    ? await fetchPricesForItems(items, { prompt: ctx.prompt })
    : { prices: await getFullCatalog(), liveCount: 0 };

  log.status = liveCount > 0 ? 'success' : prices.some((p) => p.sourceType !== 'unavailable') ? 'warn' : 'warn';
  const liveNote = wantsLiveStoreCrawl(ctx.prompt)
    ? `${liveCount} live store crawl${liveCount === 1 ? '' : 's'} (Keells/Cargills/pola wholesale).`
    : liveCount > 0
      ? `${liveCount} live store crawl${liveCount === 1 ? '' : 's'}.`
      : 'No live store crawls — catalog/web estimates used. Say "live Keells prices", tap Sync, or set FIRECRAWL/SCRAPE_DO.';
  log.message = `Indexed ${prices.length} items. ${liveNote} Best pola savings on ${prices.filter((p) => p.polaPrice > 0 && p.polaPrice <= p.cargillsPrice && p.polaPrice <= p.keellsPrice).length} items.`;
  log.details = { itemCount: prices.length, items };

  return { log, prices, liveCount };
}
