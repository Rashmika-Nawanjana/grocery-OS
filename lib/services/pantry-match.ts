import type { InventoryItem, Recipe } from '@/lib/types';
import { embedText, cosineSimilarity } from '@/lib/services/embeddings';

/** Fast lexical overlap — used only as a boost on top of vector similarity. */
function lexicalOverlap(a: string, b: string): number {
  const at = a
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const bt = new Set(
    b
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
  if (!at.length || !bt.size) return 0;
  let hits = 0;
  for (const t of at) {
    if ([...bt].some((w) => w === t || w.includes(t) || t.includes(w))) hits += 1;
  }
  return hits / at.length;
}

/**
 * Match a recipe ingredient to a pantry item via embedding similarity.
 * Falls back to lexical overlap when embeddings are weak.
 */
export async function bestInventoryMatchForIngredient(
  ingredientName: string,
  inventory: InventoryItem[],
  inventoryEmbeddings?: Map<string, number[]>
): Promise<{ item: InventoryItem; score: number } | null> {
  if (!inventory.length || !ingredientName.trim()) return null;

  const queryEmb = await embedText(`grocery ingredient: ${ingredientName}`);
  let best: { item: InventoryItem; score: number } | null = null;

  for (const inv of inventory) {
    let emb = inventoryEmbeddings?.get(inv.id);
    if (!emb) {
      emb = (await embedText(`home pantry item: ${inv.item}`)) || undefined;
      if (emb && inventoryEmbeddings) inventoryEmbeddings.set(inv.id, emb);
    }

    const lex = lexicalOverlap(ingredientName, inv.item);
    const vec = queryEmb && emb ? cosineSimilarity(queryEmb, emb) : 0;
    // Blend — vector primary, lexical catches obvious "Rice Flour" ↔ "rice flour"
    const score = Math.max(vec, lex * 0.95) + lex * 0.05;

    if (!best || score > best.score) best = { item: inv, score };
  }

  // Require a solid match — avoid random pantry hits
  if (!best || best.score < 0.42) return null;
  return best;
}

export async function inventoryMatchesIngredientAsync(
  inv: InventoryItem,
  ingredientName: string
): Promise<boolean> {
  const match = await bestInventoryMatchForIngredient(ingredientName, [inv]);
  return Boolean(match && match.score >= 0.42);
}

/** Sync lexical fallback for callers that cannot await (prefer async path). */
export function inventoryMatchesIngredient(inv: InventoryItem, ingredientName: string): boolean {
  return lexicalOverlap(ingredientName, inv.item) >= 0.5;
}

export async function applyPantryToRecipes(
  recipes: Recipe[],
  inventory: InventoryItem[]
): Promise<Recipe[]> {
  if (!recipes.length) return recipes;
  if (!inventory.length) {
    return recipes.map((recipe) => ({
      ...recipe,
      ingredients: recipe.ingredients.map((ing) => ({ ...ing, source: 'shopping' as const })),
    }));
  }

  const embCache = new Map<string, number[]>();
  // Prefetch pantry embeddings once per request
  await Promise.all(
    inventory.map(async (inv) => {
      const emb = await embedText(`home pantry item: ${inv.item}`);
      if (emb) embCache.set(inv.id, emb);
    })
  );

  return Promise.all(
    recipes.map(async (recipe) => {
      const ingredients = await Promise.all(
        recipe.ingredients.map(async (ing) => {
          const match = await bestInventoryMatchForIngredient(ing.name, inventory, embCache);
          return match
            ? { ...ing, source: 'inventory' as const }
            : { ...ing, source: 'shopping' as const };
        })
      );
      const homeCount = ingredients.filter((i) => i.source === 'inventory').length;
      return {
        ...recipe,
        ingredients,
        reasonForSelection:
          homeCount > 0
            ? `${recipe.reasonForSelection} Uses ${homeCount} item(s) from your home pantry (vector RAG match).`
            : recipe.reasonForSelection,
      };
    })
  );
}

/**
 * Rank pantry for a prompt using vector embeddings (no hardcoded dish keyword lists).
 * Prefer `searchInventoryRAG` when userId is available; this is the in-memory fallback.
 */
export async function rankInventoryForPrompt(
  prompt: string,
  inventory: InventoryItem[]
): Promise<InventoryItem[]> {
  if (!inventory.length) return [];

  const queryEmb = await embedText(`meal planning pantry needs: ${prompt}`);
  if (!queryEmb) {
    // Already RAG-ordered inventory from getInventoryForQuery — keep head order
    return inventory;
  }

  const scored = await Promise.all(
    inventory.map(async (item) => {
      const emb = await embedText(`home pantry item: ${item.item}`);
      const vec = emb ? cosineSimilarity(queryEmb, emb) : 0;
      const perishBoost = item.expiryDays <= 7 ? 0.05 : 0;
      return { item, score: vec + perishBoost };
    })
  );

  scored.sort((a, b) => b.score - a.score);
  const relevant = scored.filter((s) => s.score > 0.35).map((s) => s.item);
  return relevant.length ? relevant : inventory;
}
