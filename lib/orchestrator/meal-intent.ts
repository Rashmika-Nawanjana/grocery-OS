/** Shared meal-intent helpers — what the user actually wants vs what agents assume. */

import { wantsLocalPlacesSearch } from '@/lib/services/google-maps-places';

const PREPARED_DISHES =
  /\b(kottu|kothu|kottu\s*roti|fried\s*rice|hoppers|appa|string\s*hopper|roti|biriyani|biryani|rice\s*and\s*curry)\b/i;

export function normalizeOrderTypos(prompt: string): string {
  return prompt.toLowerCase().replace(/\boder\b/g, 'order').replace(/\bkottun\b/g, 'kottu');
}

/** User wants prepared food delivered / from a restaurant — not grocery ingredients. */
export function isPreparedFoodOrderIntent(prompt: string): boolean {
  const lower = normalizeOrderTypos(prompt);

  if (/\b(ingredients|grocery list|supermarket|shop for|pick up groceries|buy ingredients)\b/i.test(lower)) {
    return false;
  }
  if (/\b(cook|make|prepare|recipe for)\b/i.test(lower) && !/\border\b/i.test(lower)) {
    return false;
  }

  if (/\b(planning to|plan to|going to|want to|would like to)\s+order\b/i.test(lower) && PREPARED_DISHES.test(lower)) {
    return true;
  }

  if (/\border\b/i.test(lower) && PREPARED_DISHES.test(lower)) {
    return true;
  }

  return false;
}

/** User wants restaurants / takeaway — not a grocery shop run. */
export function isDineOutIntent(prompt: string): boolean {
  if (isPreparedFoodOrderIntent(prompt)) return true;

  const lower = normalizeOrderTypos(prompt);
  if (/\b(ingredients|grocery list|supermarket|shop for|pick up groceries)\b/i.test(lower) && !/\brestaurant/i.test(lower)) {
    return false;
  }
  if (wantsLocalPlacesSearch(lower)) return true;

  return (
    /\b(order|want\s+to\s+order|order\s+instead|get\s+delivery)\b/i.test(lower) &&
    /\b(restaurant|restaurants|takeaway|delivery|eat\s+out|dine|pickme|uber\s+eats|food\s+spot)\b/i.test(lower)
  );
}

/** Dishes the user named for ordering or cooking. */
export function extractNamedDishes(prompt: string): string[] {
  const lower = normalizeOrderTypos(prompt);
  if (/kottu|kothu/i.test(lower) && /fried\s*rice/i.test(lower)) {
    return ['kottu roti', 'fried rice'];
  }
  const dishes: string[] = [];
  if (/kottu|kothu/i.test(lower)) dishes.push('kottu roti');
  if (/fried\s*rice/i.test(lower)) dishes.push('fried rice');
  if (/hoppers|appa/i.test(lower)) dishes.push('hoppers');
  if (/dhal|dal/i.test(lower)) dishes.push('dhal curry');
  if (/biriyani|biryani/i.test(lower)) dishes.push('biryani');
  if (/chicken\s*curry/i.test(lower)) dishes.push('chicken curry');
  if (/rice\s*and\s*curry/i.test(lower)) dishes.push('rice and curry');
  if (/rice/i.test(lower) && /chicken/i.test(lower)) {
    if (!dishes.includes('chicken curry')) dishes.push('chicken curry');
  }
  return dishes;
}

/** User explicitly named what to cook tonight — curation must not swap it for something else. */
export function isDecidedCookIntent(prompt: string): boolean {
  if (isPreparedFoodOrderIntent(prompt)) return false;
  const lower = normalizeOrderTypos(prompt);
  return (
    /\b(want to eat|i want to eat|eat .+ tonight|cook .+ tonight|make .+ tonight)\b/i.test(lower) ||
    /\b(rice and|chicken curry|fish curry|dhal curry|fried rice|kottu)\b/i.test(lower)
  );
}

/** Boost score when recipe name matches something the user asked for. */
export function recipeMatchesUserPrompt(recipe: { name: string }, prompt: string): boolean {
  const lower = normalizeOrderTypos(prompt);
  const name = recipe.name.toLowerCase();
  if (/chicken\s*curry/i.test(lower) && /chicken.*curry|curry.*chicken/i.test(name)) return true;
  if (/biriyani|biryani/i.test(lower) && /biriyani|biryani/i.test(name)) return true;
  if (/kottu|kothu/i.test(lower) && /kottu|kothu/i.test(name)) return true;
  if (/fried\s*rice/i.test(lower) && /fried\s*rice/i.test(name)) return true;
  if (/dhal|dal/i.test(lower) && /dhal|dal/i.test(name)) return true;
  if (/\brice\b/i.test(lower) && /steamed|white rice|^rice$/i.test(name) && !/fried|biriyani/i.test(name)) {
    return true;
  }
  if (/fish\s*curry/i.test(lower) && /fish.*curry/i.test(name)) return true;
  return false;
}

/** Rough cook-at-home cost for dine-out comparison when no shop list exists. */
export function estimateCookCostForDish(contextDish?: string): number {
  if (!contextDish) return 1200;
  const lower = contextDish.toLowerCase();
  if (/biriyani|biryani/.test(lower)) return 1800;
  if (/kottu/.test(lower)) return 900;
  if (/fried rice/.test(lower)) return 700;
  if (/chicken curry/.test(lower)) return 1100;
  if (/rice and/.test(lower)) return 1000;
  return 1200;
}

/** "What should we eat" using home stock — not random international DB recipes. */
export function isPantryMealSuggestionIntent(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return (
    /\b(what should we eat|what should i eat|what to eat|what can we (make|cook|eat)|what can i (make|cook|eat))\b/i.test(
      lower
    ) ||
    /\b(considering what i have|based on (my|our) (pantry|inventory|home)|from (home|pantry)|use (home|pantry))\b/i.test(
      lower
    ) ||
    /\bafter (doing )?(some )?grocery shopping\b/i.test(lower)
  );
}

export function mentionsHomeInventory(prompt: string): boolean {
  return /\b(home inventory|use inventory|from pantry|at home|already have|what i have|use home|pantry|from home|considering what i have)\b/i.test(
    prompt
  );
}

/** TheMealDB / imported recipes that don't fit a Sri Lankan family dinner. */
export function isExoticRecipe(recipe: {
  name: string;
  ingredients: { name: string }[];
  dietaryTags?: string[];
}): boolean {
  const text = `${recipe.name} ${recipe.ingredients.map((i) => i.name).join(' ')}`.toLowerCase();
  if (recipe.dietaryTags?.includes('Imported Recipe')) {
    if (/\b(dhal|rice|kottu|curry|hoppers|sambol|pol|fried rice)\b/i.test(text)) return false;
    return true;
  }
  return /\b(shaoxing|oyster sauce|adobo|foo young|gohan|sushi|mirin|mung bean|kosher|beef stock|eggplant adobo|crispy eggplant|japanese|chinese five|pickle juice|seafood rice|spanish)\b/i.test(
    text
  );
}

export function isSriLankanLocalRecipe(recipe: { name: string; ingredients: { name: string }[] }): boolean {
  const text = `${recipe.name} ${recipe.ingredients.map((i) => i.name).join(' ')}`.toLowerCase();
  return /\b(dhal|dal|rice|kottu|kothu|hoppers|sambol|pol|curry|fried rice|egg curry|chicken curry|fish curry|roti|paratha|wambatu|brinjal|brinjals|gotu kola)\b/i.test(
    text
  );
}

export function extractFamilySize(prompt: string): number | undefined {
  const m = prompt.match(/\bfor\s+(\d+)\s+people\b/i);
  if (m) return parseInt(m[1], 10);
  return undefined;
}
