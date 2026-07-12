import { NextResponse } from 'next/server';
import { fetchPricesForItems } from '@/lib/services/scraper';
import { planError, planLog, planTimed } from '@/lib/plan-logger';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { items?: string[]; prompt?: string };
    const items = body.items?.length ? body.items : ['rice', 'eggs', 'onions', 'chicken', 'tomatoes'];
    planLog('api/scrape', `Manual price scrape — ${items.length} items`, items);
    const { prices, liveCount } = await planTimed('api/scrape', 'fetchPricesForItems', () =>
      fetchPricesForItems(items, { prompt: body.prompt ?? 'live sync fresh catalog' })
    );
    planLog('api/scrape', `Done — ${liveCount} live / ${prices.length} total`);
    return NextResponse.json({ success: true, prices, liveCount });
  } catch (error) {
    planError('api/scrape', 'Scrape failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: 'Scrape failed' }, { status: 500 });
  }
}
