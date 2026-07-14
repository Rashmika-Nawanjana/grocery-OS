import type { AgentContext, AgentExecutionLog, InventoryItem } from '@/lib/types';
import { rankInventoryForPrompt } from '@/lib/services/pantry-match';

/**
 * Rank home pantry for the current prompt.
 * Matching/spoilage still use full `ctx.inventory`; `relevantItems` is the
 * prompt-facing subset for recipe-compiler + summary.
 */
export function runInventoryRAG(ctx: AgentContext): {
  log: AgentExecutionLog;
  items: InventoryItem[];
  relevantItems: InventoryItem[];
} {
  const pantryFirst = ctx.mealMode === 'cook_pantry';
  let relevantItems = rankInventoryForPrompt(ctx.prompt, ctx.inventory);

  // Prefer perishables when cooking from pantry — use what expires first.
  if (pantryFirst && relevantItems.length) {
    relevantItems = [...relevantItems].sort((a, b) => a.expiryDays - b.expiryDays);
  }

  // Cap prompt-facing list so Gemini is not flooded; keep full inventory for matching.
  const promptCap = pantryFirst ? 10 : 8;
  if (relevantItems.length > promptCap) {
    relevantItems = relevantItems.slice(0, promptCap);
  }

  const log: AgentExecutionLog = {
    agentId: 'inventory-rag',
    agentName: 'Agent 1: Home Inventory RAG',
    status: 'success',
    message: `Indexed ${ctx.inventory.length} pantry items. ${relevantItems.length} prioritized for this request.`,
    details: {
      allItems: ctx.inventory.map((i) => `${i.item} (${i.quantity}${i.unit})`),
      relevantItems: relevantItems.map((i) => `${i.item} (${i.quantity}${i.unit}, ${i.expiryDays}d)`),
      mealMode: ctx.mealMode ?? null,
      promptCap,
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
