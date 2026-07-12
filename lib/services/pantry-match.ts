import type { InventoryItem, Recipe } from '@/lib/types';

const ALIASES: Record<string, string[]> = {
  rice: ['rice', 'white rice', 'basmati'],
  egg: ['egg', 'eggs', 'farm eggs'],
  onion: ['onion', 'onions', 'red onion'],
  oil: ['oil', 'coconut oil', 'vegetable oil'],
  dhal: ['dhal', 'dal', 'lentil', 'mysoor'],
  tomato: ['tomato', 'tomatoes'],
  chicken: ['chicken'],
  fish: ['fish', 'seafood', 'sea fish'],
  carrot: ['carrot', 'carrots'],
  garlic: ['garlic'],
  ginger: ['ginger'],
  soy: ['soy', 'soya'],
};

export function inventoryMatchesIngredient(inv: InventoryItem, ingredientName: string): boolean {
  const ing = ingredientName.toLowerCase();
  const item = inv.item.toLowerCase();

  if (item.includes(ing) || ing.includes(item.split(' ').pop() || '')) return true;

  for (const [, aliases] of Object.entries(ALIASES)) {
    const ingHit = aliases.some((a) => ing.includes(a));
    const itemHit = aliases.some((a) => item.includes(a));
    if (ingHit && itemHit) return true;
  }
  return false;
}

export function applyPantryToRecipes(recipes: Recipe[], inventory: InventoryItem[]): Recipe[] {
  return recipes.map((recipe) => {
    const ingredients = recipe.ingredients.map((ing) => {
      const home = inventory.find((inv) => inventoryMatchesIngredient(inv, ing.name));
      return home ? { ...ing, source: 'inventory' as const } : { ...ing, source: 'shopping' as const };
    });
    const homeCount = ingredients.filter((i) => i.source === 'inventory').length;
    return {
      ...recipe,
      ingredients,
      reasonForSelection:
        homeCount > 0
          ? `${recipe.reasonForSelection} Uses ${homeCount} item(s) from your home pantry.`
          : recipe.reasonForSelection,
    };
  });
}

/** Rank pantry items most relevant to the user's meal prompt. */
export function rankInventoryForPrompt(prompt: string, inventory: InventoryItem[]): InventoryItem[] {
  if (!inventory.length) return [];

  const lower = prompt.toLowerCase();
  const dishKeywords: string[] = [];

  if (/fried\s*rice|rice/i.test(lower)) {
    dishKeywords.push('rice', 'egg', 'onion', 'oil', 'carrot', 'garlic', 'ginger', 'soy');
  }
  if (/dhal|dal|lentil|parippu/i.test(lower)) {
    dishKeywords.push('dhal', 'dal', 'lentil', 'onion', 'oil', 'rice');
  }
  if (/curry|chicken/i.test(lower)) {
    dishKeywords.push('chicken', 'onion', 'oil', 'tomato', 'rice');
  }
  if (/fish/i.test(lower)) dishKeywords.push('fish', 'oil', 'onion', 'rice');

  if (!dishKeywords.length) {
    for (const k of ['rice', 'egg', 'onion', 'oil', 'dhal', 'tomato', 'chicken', 'fish']) {
      if (lower.includes(k)) dishKeywords.push(k);
    }
  }

  const scored = inventory.map((item) => {
    const itemLower = item.item.toLowerCase();
    let score = 0;
    for (const kw of dishKeywords) {
      if (itemLower.includes(kw)) score += 2;
    }
    if (item.expiryDays <= 7) score += 1;
    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const relevant = scored.filter((s) => s.score > 0).map((s) => s.item);
  return relevant.length ? relevant : inventory;
}
