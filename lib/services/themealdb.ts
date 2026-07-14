import type { Recipe, InventoryItem } from '@/lib/types';

const API_KEY = process.env.THEMEALDB_API_KEY || '1';
const BASE = `https://www.themealdb.com/api/json/v1/${API_KEY}`;

interface MealDbMeal {
  idMeal: string;
  strMeal: string;
  strMealThumb?: string;
  strCategory?: string;
  strArea?: string;
  strInstructions?: string;
  strIngredient1?: string;
  strMeasure1?: string;
  [key: string]: string | undefined;
}

async function mealDbFetch(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  return res.json();
}

function parseMeasure(measure?: string): { amount: number; unit: string } {
  if (!measure?.trim()) return { amount: 1, unit: 'portion' };
  const raw = measure.trim();
  const m = raw.match(/^([\d./]+)\s*(.*)$/);
  if (!m) return { amount: 1, unit: raw || 'portion' };
  const numPart = m[1];
  let amount = 1;
  if (numPart.includes('/')) {
    const [a, b] = numPart.split('/').map(Number);
    amount = b ? a / b : 1;
  } else {
    amount = parseFloat(numPart) || 1;
  }
  const unit = (m[2] || 'portion').trim() || 'portion';
  return { amount, unit };
}

export function mealToRecipe(meal: MealDbMeal): Recipe {
  const ingredients: Recipe['ingredients'] = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (name?.trim()) {
      const { amount, unit } = parseMeasure(measure);
      ingredients.push({ name: name.trim(), amount, unit, source: 'shopping' });
    }
  }
  const instructions = (meal.strInstructions || 'Prepare and cook as directed.')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  const area = meal.strArea ? ` · ${meal.strArea}` : '';
  const thumb = meal.strMealThumb?.trim();

  return {
    id: meal.idMeal,
    name: meal.strMeal,
    imageUrl: thumb || undefined,
    ingredients,
    instructions: instructions.length ? instructions : ['Cook according to TheMealDB recipe.'],
    prepTimeMin: 15,
    cookTimeMin: 25,
    assignedCook: 'Family cook',
    reasonForSelection: `From TheMealDB${area}${meal.strCategory ? ` (${meal.strCategory})` : ''}.`,
    dietaryTags: ['TheMealDB', meal.strArea || '', meal.strCategory || ''].filter(Boolean),
    nutritionalInfo: { calories: 350, protein: '20g', sugar: '5g', fat: '12g' },
  };
}

export async function lookupMealById(id: string): Promise<Recipe | null> {
  try {
    const data = (await mealDbFetch(`/lookup.php?i=${encodeURIComponent(id)}`)) as {
      meals?: MealDbMeal[];
    } | null;
    const meal = data?.meals?.[0];
    return meal ? mealToRecipe(meal) : null;
  } catch {
    return null;
  }
}

export async function searchMealsByName(term: string, limit = 4): Promise<Recipe[]> {
  if (!term.trim()) return [];
  try {
    const data = (await mealDbFetch(`/search.php?s=${encodeURIComponent(term)}`)) as {
      meals?: MealDbMeal[] | null;
    } | null;
    const meals = data?.meals || [];
    return meals.slice(0, limit).map(mealToRecipe);
  } catch {
    return [];
  }
}

/** Alias used by older callers. */
export async function searchMeals(query: string): Promise<Recipe[]> {
  return searchMealsByName(extractFoodTerm(query), 4);
}

export async function searchMealsByIngredient(ingredient: string, limit = 3): Promise<Recipe[]> {
  const key = ingredient.trim().toLowerCase().replace(/\s+/g, '_');
  if (!key) return [];
  try {
    const data = (await mealDbFetch(`/filter.php?i=${encodeURIComponent(key)}`)) as {
      meals?: { idMeal: string; strMeal: string; strMealThumb?: string }[] | null;
    } | null;
    const meals = data?.meals || [];
    const full: Recipe[] = [];
    for (const m of meals.slice(0, limit)) {
      const detail = await lookupMealById(m.idMeal);
      if (detail) {
        if (!detail.imageUrl && m.strMealThumb) detail.imageUrl = m.strMealThumb;
        full.push(detail);
      }
    }
    return full;
  } catch {
    return [];
  }
}

export async function searchMealsByArea(area: string, limit = 4): Promise<Recipe[]> {
  try {
    const data = (await mealDbFetch(`/filter.php?a=${encodeURIComponent(area)}`)) as {
      meals?: { idMeal: string; strMealThumb?: string }[] | null;
    } | null;
    const meals = data?.meals || [];
    const full: Recipe[] = [];
    for (const m of meals.slice(0, limit)) {
      const detail = await lookupMealById(m.idMeal);
      if (detail) full.push(detail);
    }
    return full;
  } catch {
    return [];
  }
}

function extractFoodTerm(query: string): string {
  const lower = query.toLowerCase();
  if (/string\s*hoppers|idiyappam/.test(lower)) return 'string hoppers';
  if (/hoppers|appa/.test(lower)) return 'hoppers';
  if (/fried\s*rice/.test(lower)) return 'fried rice';
  if (/chicken\s*curry/.test(lower)) return 'chicken curry';
  if (/biryani|biriyani/.test(lower)) return 'biryani';
  if (/kottu|kothu/.test(lower)) return 'chicken';
  if (/dhal|dal|parippu/.test(lower)) return 'lentil';
  const foods = [
    'chicken',
    'rice',
    'egg',
    'lentil',
    'fish',
    'curry',
    'beef',
    'potato',
    'tomato',
    'prawn',
    'salmon',
    'pasta',
  ];
  for (const f of foods) if (lower.includes(f)) return f;
  const words = lower.split(/\W+/).filter((w) => w.length > 3);
  return words.find((w) => !/tonight|should|dinner|lunch|breakfast|budget|people/.test(w)) || 'chicken';
}

/** Map pantry item names → TheMealDB filter ingredients. */
function pantryToMealDbIngredients(inventory: InventoryItem[]): string[] {
  const map: Array<{ re: RegExp; ingredient: string }> = [
    { re: /chicken/i, ingredient: 'chicken' },
    { re: /\beggs?\b|farm egg/i, ingredient: 'eggs' },
    { re: /rice/i, ingredient: 'rice' },
    { re: /dhal|dal|lentil|mysoor/i, ingredient: 'lentils' },
    { re: /tomato/i, ingredient: 'tomato' },
    { re: /onion/i, ingredient: 'onion' },
    { re: /potato/i, ingredient: 'potato' },
    { re: /carrot/i, ingredient: 'carrot' },
    { re: /fish|salmon|tuna/i, ingredient: 'salmon' },
    { re: /beef/i, ingredient: 'beef' },
    { re: /garlic/i, ingredient: 'garlic' },
    { re: /ginger/i, ingredient: 'ginger' },
    { re: /coconut/i, ingredient: 'coconut milk' },
  ];
  const out: string[] = [];
  for (const item of inventory) {
    for (const { re, ingredient } of map) {
      if (re.test(item.item) && !out.includes(ingredient)) out.push(ingredient);
    }
  }
  return out.slice(0, 4);
}

function dedupeRecipes(recipes: Recipe[]): Recipe[] {
  const seen = new Set<string>();
  return recipes.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

/**
 * Primary recipe fetch for meal planning — TheMealDB first (name + pantry ingredients + area).
 * When `nameOnly` is true (decided dish), never widen via pantry/area — avoids Corba-for-hoppers.
 */
export async function fetchRecipesFromMealDb(opts: {
  prompt: string;
  inventory: InventoryItem[];
  limit?: number;
  /** Only search by dish name — skip pantry ingredient + area fan-out. */
  nameOnly?: boolean;
}): Promise<Recipe[]> {
  const limit = opts.limit ?? 6;
  const term = extractFoodTerm(opts.prompt);

  if (opts.nameOnly) {
    const byName = await searchMealsByName(term, limit);
    return byName.slice(0, limit);
  }

  const pantryIngredients = pantryToMealDbIngredients(opts.inventory);

  const batches = await Promise.all([
    searchMealsByName(term, 4),
    ...pantryIngredients.slice(0, 2).map((ing) => searchMealsByIngredient(ing, 2)),
    // Indian area often closest to SL home cooking on TheMealDB
    /curry|dhal|dal|rice|chicken|tonight|dinner|eat/i.test(opts.prompt)
      ? searchMealsByArea('India', 3)
      : Promise.resolve([] as Recipe[]),
  ]);

  let recipes = dedupeRecipes(batches.flat());

  // Prefer meals that overlap pantry ingredients
  if (pantryIngredients.length && recipes.length > 1) {
    recipes = [...recipes].sort((a, b) => {
      const score = (r: Recipe) =>
        r.ingredients.filter((ing) =>
          pantryIngredients.some(
            (p) =>
              ing.name.toLowerCase().includes(p.split(' ')[0]) ||
              p.includes(ing.name.toLowerCase().split(' ')[0])
          )
        ).length;
      return score(b) - score(a);
    });
  }

  return recipes.slice(0, limit);
}

export function matchInventoryToRecipes(recipes: Recipe[], inventory: InventoryItem[]): Recipe[] {
  return recipes.map((recipe) => {
    const ingredients = recipe.ingredients.map((ing) => {
      const home = inventory.find(
        (inv) =>
          inv.item.toLowerCase().includes(ing.name.toLowerCase()) ||
          ing.name.toLowerCase().includes(inv.item.toLowerCase().split(' ')[0])
      );
      return home ? { ...ing, source: 'inventory' as const } : ing;
    });
    const inventoryUsed = ingredients.filter((i) => i.source === 'inventory').length;
    return {
      ...recipe,
      ingredients,
      reasonForSelection: `${recipe.reasonForSelection} Uses ${inventoryUsed} item(s) from home inventory.`,
    };
  });
}
