import type { AgentContext, AgentExecutionLog, InventoryItem } from '@/lib/types';
import { searchInventoryRAG } from '@/lib/rag/inventory-rag';
import { rankInventoryForPrompt } from '@/lib/services/pantry-match';

/**
 * Rank home pantry for the current prompt via vector RAG.
 * Matching/spoilage still use full `ctx.inventory`; `relevantItems` is the
 * prompt-facing subset for recipe-compiler + summary.
 */
export async function runInventoryRAG(ctx: AgentContext): Promise<{
  log: AgentExecutionLog;
  items: InventoryItem[];
  relevantItems: InventoryItem[];
}> {
  const pantryFirst = ctx.mealMode === 'cook_pantry';
  const promptCap = pantryFirst ? 10 : 8;
  const query = ctx.userPrompt || ctx.prompt;
  let relevantItems: InventoryItem[] = [];
  let via: 'pgvector' | 'embed' | 'ordered' = 'ordered';

  if (ctx.userId && query.trim()) {
    const { items: hits, scores } = await searchInventoryRAG(ctx.userId, query, promptCap + 4);
    if (hits.length) {
      relevantItems = hits;
      via = 'pgvector';
      // Merge perishables that vector search may have under-ranked
      const hitIds = new Set(hits.map((i) => i.id));
      const perishables = ctx.inventory.filter((i) => i.expiryDays <= 7 && !hitIds.has(i.id));
      relevantItems = [...relevantItems, ...perishables];
    }
  }

  if (!relevantItems.length && ctx.inventory.length) {
    // Inventory from getInventoryForQuery is already vector-ranked at the head
    relevantItems = await rankInventoryForPrompt(query, ctx.inventory);
    via = 'embed';
  }

  if (pantryFirst && relevantItems.length) {
    relevantItems = [...relevantItems].sort((a, b) => a.expiryDays - b.expiryDays);
  }

  if (relevantItems.length > promptCap) {
    relevantItems = relevantItems.slice(0, promptCap);
  }

  const log: AgentExecutionLog = {
    agentId: 'inventory-rag',
    agentName: 'Agent 1: Home Inventory RAG',
    status: 'success',
    message: `Indexed ${ctx.inventory.length} pantry items via ${via} RAG. ${relevantItems.length} prioritized for this request.`,
    details: {
      via,
      allItems: ctx.inventory.map((i) => `${i.item} (${i.quantity}${i.unit})`),
      relevantItems: relevantItems.map((i) => `${i.item} (${i.quantity}${i.unit}, ${i.expiryDays}d)`),
      mealMode: ctx.mealMode ?? null,
      promptCap,
      userId: ctx.userId ? 'set' : null,
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
