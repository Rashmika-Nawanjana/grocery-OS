import type { AgentContext, AgentExecutionLog, InventoryItem } from '@/lib/types';
import { rankInventoryForPrompt } from '@/lib/services/pantry-match';

export function runInventoryRAG(ctx: AgentContext): {
  log: AgentExecutionLog;
  items: InventoryItem[];
  relevantItems: InventoryItem[];
} {
  const relevantItems = rankInventoryForPrompt(ctx.prompt, ctx.inventory);

  const log: AgentExecutionLog = {
    agentId: 'inventory-rag',
    agentName: 'Agent 1: Home Inventory RAG',
    status: 'success',
    message: `Indexed ${ctx.inventory.length} pantry items. ${relevantItems.length} match your request.`,
    details: {
      allItems: ctx.inventory.map((i) => `${i.item} (${i.quantity}${i.unit})`),
      relevantItems: relevantItems.map((i) => `${i.item} (${i.quantity}${i.unit})`),
    },
  };

  const perishables = ctx.inventory.filter((i) => i.expiryDays <= 7);
  if (perishables.length) {
    log.message += ` ${perishables.length} perishable(s) expiring soon — prioritize in meal plan.`;
  }

  if (relevantItems.length) {
    log.message += ` Best pantry matches: ${relevantItems.slice(0, 4).map((i) => i.item).join(', ')}.`;
  } else if (!ctx.inventory.length) {
    log.status = 'warn';
    log.message = 'No home inventory on file — add items in Inventory tab or log in to sync Supabase pantry.';
  }

  return { log, items: ctx.inventory, relevantItems };
}
