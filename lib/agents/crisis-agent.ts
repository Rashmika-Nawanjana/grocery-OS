import type { AgentContext, AgentExecutionLog, CrisisAlert } from '@/lib/types';
import { fetchCrisisNews } from '@/lib/services/news';
import { homeAreaFromContext, newsLocationLabel } from '@/lib/services/location';

export async function runCrisisAgent(ctx: AgentContext): Promise<{ log: AgentExecutionLog; crisis: CrisisAlert }> {
  const log: AgentExecutionLog = {
    agentId: 'crisis-agent',
    agentName: 'Agent 7: Crisis Intelligence',
    status: 'active',
    message: 'Scanning live news feeds for alerts relevant to your question...',
  };

  const homeArea = homeAreaFromContext(ctx.memoryContext);
  const location = newsLocationLabel(homeArea);
  const question = ctx.userPrompt || ctx.prompt;
  const crisis = await fetchCrisisNews(location, question);

  log.status = crisis.type === 'none' ? 'success' : 'warn';
  log.message =
    crisis.source === 'unconfigured'
      ? 'NewsAPI key missing — set NEWS_API_KEY for live crisis headlines.'
      : crisis.type === 'none'
        ? `No matching crisis alert in live news (${location}).`
        : `${crisis.type.toUpperCase()} alert (${crisis.severity}): ${crisis.warningText}`;
  log.details = { headlines: crisis.newsHeadlines, recommendation: crisis.shoppingRecommendation, location };

  return { log, crisis };
}
