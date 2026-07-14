import type { Recipe, StorePrice, WeatherCondition, PlanCurationMeta } from '@/lib/types';
import { isExoticRecipe, isPantryMealSuggestionIntent, isDecidedCookIntent, mentionsHomeInventory, recipeMatchesUserPrompt } from '@/lib/orchestrator/meal-intent';
import { cheapestStore } from '@/lib/services/scraper';
import { lineTotalForIngredient, safeLkr, safeQuantity } from '@/lib/services/price-units';

export type PlanPrimaryAction = PlanCurationMeta['primaryAction'];

export interface RecipeRankEntry {
  name: string;
  shopCostLkr: number;
  homeCount: number;
  score: number;
  included: boolean;
  reason: string;
}

export type { PlanCurationMeta };

function findPriceRow(name: string, prices: StorePrice[]): StorePrice | undefined {
  const key = name.toLowerCase();
  return prices.find(
    (p) => p.itemName.toLowerCase().includes(key) || key.includes(p.itemName.toLowerCase().split(' ')[0])
  );
}

export function estimateRecipeShopCost(recipe: Recipe, prices: StorePrice[]): number {
  let total = 0;
  const seen = new Set<string>();
  for (const ing of recipe.ingredients) {
    if (ing.source === 'inventory') continue;
    const key = ing.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const row = findPriceRow(ing.name, prices);
    const store = row ? cheapestStore(row) : 'Pola';
    const qty = safeQuantity(ing.amount, ing.unit);
    total += lineTotalForIngredient(row, store, qty, ing.unit);
  }
  return safeLkr(total);
}

/** Sri Lanka local time (UTC+5:30). */
export function inferMealPeriod(now = new Date()): PlanCurationMeta['mealPeriod'] {
  const slMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + 5 * 60 + 30;
  const slHour = Math.floor((slMinutes % (24 * 60)) / 60);
  if (slHour >= 5 && slHour < 11) return 'breakfast';
  if (slHour >= 11 && slHour < 15) return 'lunch';
  return 'dinner';
}

function describeWeather(weather: WeatherCondition): string {
  const rain = weather.rainMm > 0 ? `, ${weather.rainMm}mm rain` : '';
  return `${weather.condition} ${weather.temperature}°C${rain}`;
}

function isWarmMeal(recipe: Recipe): boolean {
  const text = `${recipe.name} ${recipe.ingredients.map((i) => i.name).join(' ')}`.toLowerCase();
  return /\b(soup|curry|stew|dhal|rice|kottu|broth|shchi|chakchouka)\b/i.test(text);
}

function isLightMeal(recipe: Recipe): boolean {
  const text = `${recipe.name} ${recipe.ingredients.map((i) => i.name).join(' ')}`.toLowerCase();
  return /\b(sandwich|salad|roti|hoppers|idli|toast|fruit)\b/i.test(text);
}

function weatherFitScore(recipe: Recipe, weather: WeatherCondition): number {
  const rainy = weather.condition === 'monsoon' || weather.condition === 'rainy' || weather.rainMm >= 3;
  const hot = weather.temperature >= 30;
  if (rainy && isWarmMeal(recipe)) return 20;
  if (hot && isLightMeal(recipe)) return 15;
  if (rainy && isLightMeal(recipe)) return -10;
  return 0;
}

function timeFitScore(recipe: Recipe, period: PlanCurationMeta['mealPeriod']): number {
  const text = `${recipe.name}`.toLowerCase();
  if (period === 'breakfast' && /\b(breakfast|egg|toast|sandwich|hoppers|idli)\b/i.test(text)) return 15;
  if (period === 'lunch' && /\b(rice|curry|kottu|fried)\b/i.test(text)) return 10;
  if (period === 'dinner' && /\b(curry|rice|soup|stew|dinner)\b/i.test(text)) return 10;
  if (period === 'breakfast' && /\b(soup|shchi|stew)\b/i.test(text)) return -15;
  return 0;
}

function slLocalMealScore(recipe: Recipe): number {
  const text = `${recipe.name} ${recipe.ingredients.map((i) => i.name).join(' ')}`.toLowerCase();
  if (isExoticRecipe(recipe)) return -50;
  if (/\b(dhal|rice|kottu|hoppers|pol|sambol|fish curry|chicken curry|fried rice|egg curry|brinjal|wambatu)\b/i.test(text)) return 25;
  if (/\b(baingan|shchi|celery|sour cream|adobo|foo young|gohan|mirin|shaoxing)\b/i.test(text)) return -40;
  return 0;
}

function rankRecipes(
  recipes: Recipe[],
  prices: StorePrice[],
  budgetLkr: number,
  weather: WeatherCondition,
  period: PlanCurationMeta['mealPeriod'],
  prompt: string
): Array<{ recipe: Recipe; shopCost: number; homeCount: number; score: number; reason: string }> {
  const budget = Math.max(1, safeLkr(budgetLkr));
  return recipes
    .map((recipe) => {
      const shopCost = estimateRecipeShopCost(recipe, prices);
      const homeCount = recipe.ingredients.filter((i) => i.source === 'inventory').length;
      const budgetFit = Math.max(0, 120 - (shopCost / budget) * 100);
      const score =
        budgetFit +
        homeCount * 22 +
        weatherFitScore(recipe, weather) +
        timeFitScore(recipe, period) +
        slLocalMealScore(recipe) +
        (recipeMatchesUserPrompt(recipe, prompt) ? 200 : 0);
      const reason =
        shopCost <= budget
          ? `Fits LKR ${budget} budget`
          : homeCount >= 2
            ? `Uses ${homeCount} pantry items`
            : shopCost <= budget * 1.5
              ? 'Slightly over budget'
              : 'Too expensive for tonight';
      return { recipe, shopCost, homeCount, score, reason };
    })
    .sort((a, b) => b.score - a.score);
}

function decideShowCount(
  ranked: ReturnType<typeof rankRecipes>,
  budgetLkr: number,
  weather: WeatherCondition,
  period: PlanCurationMeta['mealPeriod'],
  pantrySuggestion = false,
  cookEffort?: 'quick' | 'normal',
  mealMode?: 'cook_pantry' | 'cook_shop' | 'order' | 'eat_out'
): { primaryAction: PlanPrimaryAction; maxShow: number; headline: string } {
  const budget = Math.max(1, safeLkr(budgetLkr));
  const best = ranked[0];
  if (!best) {
    return { primaryAction: 'order_out', maxShow: 0, headline: 'No recipes compiled' };
  }

  const ratio = best.shopCost / budget;
  const rainy = weather.condition === 'monsoon' || weather.condition === 'rainy' || weather.rainMm >= 3;
  const quick = cookEffort === 'quick';
  const forcedCook = mealMode === 'cook_pantry' || mealMode === 'cook_shop';

  if (ratio <= 1.15) {
    const affordable = ranked.filter((r) => r.shopCost <= budget * 1.2);
    const cap = quick ? 1 : pantrySuggestion ? 2 : 3;
    return {
      primaryAction: 'cook_at_home',
      maxShow: Math.min(cap, Math.max(1, affordable.length)),
      headline: pantrySuggestion
        ? `Best from your pantry — ${Math.min(cap, affordable.length)} Sri Lankan option(s) for dinner`
        : quick
          ? `Quick cook — ${affordable[0]?.recipe.name || 'one light meal'} fits your LKR ${budget} budget`
          : `Cook at home — ${affordable.length || 1} option(s) fit your LKR ${budget} budget`,
    };
  }

  if (ratio <= 1.8) {
    return {
      primaryAction: mealMode === 'cook_pantry' ? 'pantry_only' : 'grocery_shop',
      maxShow: 1,
      headline: `Best option: ${best.recipe.name} (~LKR ${best.shopCost}) — small shop needed`,
    };
  }

  if (best.homeCount >= 2 && ratio <= 3) {
    return {
      primaryAction: 'pantry_only',
      maxShow: 1,
      headline: `Pantry-first: ${best.recipe.name} — you have most ingredients at home`,
    };
  }

  if (rainy && best.shopCost <= budget * 2 && isWarmMeal(best.recipe)) {
    return {
      primaryAction: 'grocery_shop',
      maxShow: 1,
      headline: `Rainy ${weather.temperature}°C — one warm meal (${best.recipe.name}) if you shop lightly`,
    };
  }

  if (period === 'breakfast' && ranked.some((r) => r.shopCost <= budget && isLightMeal(r.recipe))) {
    const light = ranked.find((r) => r.shopCost <= budget && isLightMeal(r.recipe))!;
    return {
      primaryAction: 'cook_at_home',
      maxShow: 1,
      headline: `${period}: ${light.recipe.name} fits breakfast and budget`,
    };
  }

  if (forcedCook) {
    return {
      primaryAction: mealMode === 'cook_pantry' ? 'pantry_only' : 'grocery_shop',
      maxShow: 1,
      headline: `Cook choice: ${best.recipe.name} (~LKR ${best.shopCost}) — best fit under your constraints`,
    };
  }

  return {
    primaryAction: 'order_out',
    maxShow: ratio <= 2.5 && best.homeCount >= 1 ? 1 : 0,
    headline:
      maxShowLabel(ratio, budget, best) ||
      `Order out — cooking ${best.recipe.name} needs ~LKR ${best.shopCost} (budget LKR ${budget})`,
  };
}

function maxShowLabel(
  ratio: number,
  budget: number,
  best: { recipe: Recipe; shopCost: number; homeCount: number }
): string {
  if (ratio <= 2.5 && best.homeCount >= 1) {
    return `Borderline — showing 1 pantry-friendly option; ordering may still be cheaper than a full shop`;
  }
  return '';
}

export function curateMealPlan(input: {
  recipes: Recipe[];
  prices: StorePrice[];
  budgetLkr: number;
  weather: WeatherCondition;
  prompt: string;
  isMealRoutine: boolean;
  cookEffort?: 'quick' | 'normal';
  mealMode?: 'cook_pantry' | 'cook_shop' | 'order' | 'eat_out';
}): { recipes: Recipe[]; meta: PlanCurationMeta | undefined } {
  if (input.isMealRoutine) {
    return { recipes: input.recipes, meta: undefined };
  }

  const pantrySuggestion =
    input.mealMode === 'cook_pantry' ||
    isPantryMealSuggestionIntent(input.prompt) ||
    mentionsHomeInventory(input.prompt);
  const decidedCook = isDecidedCookIntent(input.prompt);

  const period = inferMealPeriod();
  const weatherContext = describeWeather(input.weather);

  // Decided dish: never keep a single mismatched MealDB recipe (e.g. Corba for hoppers)
  if (decidedCook) {
    const userMatched = input.recipes.filter(
      (r) => recipeMatchesUserPrompt(r, input.prompt) && !isExoticRecipe(r)
    );
    if (userMatched.length) {
      const ranked = rankRecipes(input.recipes, input.prices, input.budgetLkr, input.weather, period, input.prompt);
      const curated = userMatched.slice(0, Math.min(input.cookEffort === 'quick' ? 1 : 3, userMatched.length));
      const includedSet = new Set(curated.map((r) => r.id));
      return {
        recipes: curated,
        meta: {
          primaryAction: 'cook_at_home',
          mealPeriod: period,
          weatherContext,
          showCount: curated.length,
          hiddenCount: input.recipes.length - curated.length,
          recipeRankings: ranked.map((r) => ({
            name: r.recipe.name,
            shopCostLkr: r.shopCost,
            homeCount: r.homeCount,
            score: Math.round(r.score),
            included: includedSet.has(r.recipe.id),
            reason: includedSet.has(r.recipe.id) ? 'You asked for this dish' : 'Not part of your request',
          })),
          headline: `Your plan: ${curated.map((r) => r.name).join(' + ')}`,
        },
      };
    }
  }

  if (input.recipes.length <= 1) {
    return { recipes: input.recipes, meta: undefined };
  }

  let ranked = rankRecipes(input.recipes, input.prices, input.budgetLkr, input.weather, period, input.prompt).filter(
    (r) => !isExoticRecipe(r.recipe)
  );

  if (input.cookEffort === 'quick') {
    const light = ranked.filter((r) => isLightMeal(r.recipe) || r.recipe.prepTimeMin + r.recipe.cookTimeMin <= 35);
    if (light.length) ranked = [...light, ...ranked.filter((r) => !light.includes(r))];
  }

  const { primaryAction, maxShow, headline } = decideShowCount(
    ranked,
    input.budgetLkr,
    input.weather,
    period,
    pantrySuggestion,
    input.cookEffort,
    input.mealMode
  );

  const includedSet = new Set(ranked.slice(0, maxShow).map((r) => r.recipe.id));
  const recipeRankings: RecipeRankEntry[] = ranked.map((r, i) => ({
    name: r.recipe.name,
    shopCostLkr: r.shopCost,
    homeCount: r.homeCount,
    score: Math.round(r.score),
    included: includedSet.has(r.recipe.id),
    reason: i < maxShow ? r.reason : `Hidden — ${primaryAction === 'order_out' ? 'order out is better tonight' : r.reason}`,
  }));

  const curated = ranked.slice(0, maxShow).map((r) => r.recipe);

  return {
    recipes: curated,
    meta: {
      primaryAction,
      mealPeriod: period,
      weatherContext,
      showCount: curated.length,
      hiddenCount: input.recipes.length - curated.length,
      recipeRankings,
      headline,
    },
  };
}

export function formatCurationNote(meta: PlanCurationMeta): string {
  const lines: string[] = [];
  lines.push(`${meta.headline}`);
  lines.push(`${meta.mealPeriod.charAt(0).toUpperCase() + meta.mealPeriod.slice(1)} · Weather: ${meta.weatherContext}`);
  if (meta.hiddenCount > 0) {
    lines.push(`Hid ${meta.hiddenCount} other suggestion(s) — not a fit for budget, weather, or time of day.`);
  }
  const shown = meta.recipeRankings.filter((r) => r.included);
  if (shown.length) {
    lines.push('Showing:');
    shown.forEach((r) => lines.push(`• ${r.name} (~LKR ${r.shopCostLkr}) — ${r.reason}`));
  }
  return lines.join('\n');
}
