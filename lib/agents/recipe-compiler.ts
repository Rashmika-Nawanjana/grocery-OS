import type { AgentContext, AgentExecutionLog, Recipe } from '@/lib/types';
import { safeQuantity } from '@/lib/services/price-units';
import {
  fetchRecipesFromMealDb,
  matchInventoryToRecipes,
  searchMealsByName,
} from '@/lib/services/themealdb';
import { applyPantryToRecipes } from '@/lib/services/pantry-match';
import { geminiJson } from '@/lib/services/gemini';
import {
  buildSandwichRoutineRecipe,
  detectSandwichFillingVariant,
  extractRoutineDays,
  isMealRoutinePlanRequest,
  isRoutineComparisonFollowUp,
} from '@/lib/orchestrator/meal-routine';
import {
  extractFamilySize,
  extractNamedDishes,
  isDecidedCookIntent,
  isExoticRecipe,
  isPantryMealSuggestionIntent,
  isPreparedFoodOrderIntent,
  mentionsHomeInventory,
} from '@/lib/orchestrator/meal-intent';
import {
  assignCook,
  buildFriedRiceFromPantry,
  buildLocalPantrySuggestions,
  fallbackRecipe,
} from '@/lib/agents/local-recipes';
import {
  buyReadyComponents,
  cookComponents,
  describeMealComponentPlan,
  parseMealComponents,
} from '@/lib/orchestrator/meal-components';

export async function runRecipeCompiler(ctx: AgentContext): Promise<{ log: AgentExecutionLog; recipes: Recipe[] }> {
  const log: AgentExecutionLog = {
    agentId: 'recipe-compiler',
    agentName: 'Agent 2: Recipe Compiler',
    status: 'active',
    message: 'Fetching recipes from TheMealDB…',
  };

  const userPrompt = ctx.userPrompt || ctx.prompt;
  const comparison = isRoutineComparisonFollowUp(userPrompt, {
    isFollowUp: ctx.isFollowUp,
    previousRecipes: ctx.previousRecipes,
    hadMealRoutine: Boolean(ctx.previousMealPlan?.mealRoutineMeta),
  });

  if (isMealRoutinePlanRequest(userPrompt) || comparison) {
    const days = extractRoutineDays(userPrompt, ctx.previousMealPlan?.mealRoutineMeta?.daysPlanned ?? 7);
    const variant = detectSandwichFillingVariant(userPrompt);
    const recipes = [buildSandwichRoutineRecipe(ctx, days, variant)];
    log.status = 'success';
    log.message = comparison
      ? `Built ${days}-day ${variant} comparison plan (${recipes[0].ingredients.filter((i) => i.source === 'shopping').length} items to buy).`
      : `Built ${days}-day sandwich breakfast routine (${recipes[0].ingredients.filter((i) => i.source === 'shopping').length} items to buy).`;
    log.details = { recipeNames: recipes.map((r) => r.name), daysPlanned: days, variant };
    return { log, recipes };
  }

  if (isPreparedFoodOrderIntent(userPrompt)) {
    log.status = 'skipped';
    log.message = 'Dine-out intent — recipe compiler skipped.';
    return { log, recipes: [] };
  }

  const mealComponents = ctx.mealComponents?.length
    ? ctx.mealComponents
    : parseMealComponents(userPrompt);
  const cookDishes = cookComponents(mealComponents);
  const buyReady = buyReadyComponents(mealComponents);
  const componentPlan = describeMealComponentPlan(mealComponents);

  const pantryFirst =
    ctx.mealMode === 'cook_pantry' ||
    isPantryMealSuggestionIntent(userPrompt) ||
    mentionsHomeInventory(userPrompt);
  const decidedCook = isDecidedCookIntent(userPrompt) || cookDishes.length > 0;
  const namedDishes =
    cookDishes.length > 0 ? cookDishes.map((c) => c.name) : extractNamedDishes(userPrompt);
  const servings = extractFamilySize(userPrompt) ?? 4;
  const pantryForPrompt =
    ctx.relevantPantry?.length ? ctx.relevantPantry : ctx.inventory.slice(0, 10);
  const maxRecipes = pantryFirst || ctx.cookEffort === 'quick' ? 2 : 3;

  // Search TheMealDB for COOK dishes only — never for bread/yoghurt/etc.
  const searchPrompt =
    namedDishes.length > 0
      ? namedDishes.join(' ')
      : userPrompt.replace(/\b(bread|loaf|buns?|yoghurt|yogurt|curd|butter|jam|papadam)\b/gi, ' ').trim() ||
        userPrompt;

  let recipes = await fetchRecipesFromMealDb({
    prompt: searchPrompt,
    inventory: ctx.inventory,
    limit: 8,
  });

  for (const dish of namedDishes.slice(0, 2)) {
    const extra = await searchMealsByName(dish, 2);
    recipes = [...extra, ...recipes];
  }

  const seen = new Set<string>();
  recipes = recipes.filter((r) => {
    if (seen.has(r.id) || isExoticRecipe(r)) return false;
    // Never pick a "bread loaf bake" style recipe when bread is buy-ready
    if (buyReady.some((b) => /bread/i.test(b.name)) && /\bbread\b/i.test(r.name) && !/curry|dhal|dal/i.test(r.name)) {
      return false;
    }
    seen.add(r.id);
    return true;
  });

  log.message =
    recipes.length > 0
      ? `TheMealDB returned ${recipes.length} meal(s)${componentPlan ? ` (${componentPlan})` : ''}. Matching to pantry…`
      : `TheMealDB had no hits${componentPlan ? ` — ${componentPlan}` : ''} — trying local pantry fallback…`;

  if (recipes.length) {
    const catalog = recipes.slice(0, 6).map((r) => ({
      id: r.id,
      name: r.name,
      imageUrl: r.imageUrl,
      area: r.dietaryTags.find((t) => t !== 'TheMealDB'),
      ingredients: r.ingredients.map((i) => i.name),
    }));

    const aiPick = await geminiJson<{ selectedIds: string[]; notes?: string }>(
      `User wants: "${userPrompt}"
Meal roles: ${componentPlan || 'none'}
COOK only these dishes (do not bake/make buy-ready items): ${namedDishes.join(', ') || 'best match'}
Buy ready (shopping list only, NOT recipes): ${buyReady.map((b) => b.name).join(', ') || 'none'}
Previously liked dishes (prefer if they fit): ${JSON.stringify(ctx.likedDishes ?? [])}
Budget: LKR ${ctx.budgetLkr}
Prioritized pantry: ${JSON.stringify(pantryForPrompt.map((i) => i.item))}
TheMealDB candidates (MUST pick from these ids only):
${JSON.stringify(catalog)}
Serve ~${servings} people.${pantryFirst ? ' Prefer meals that use pantry items.' : ''}${
        ctx.cookEffort === 'quick' ? ' Prefer quicker meals.' : ''
      }`,
      `Return JSON { selectedIds: string[] } with up to ${maxRecipes} TheMealDB meal ids for the COOK dishes only. Never select a bread-baking recipe when bread is listed as buy-ready. Prefer South Asian / home-style cooking for a Sri Lankan family.`
    );

    if (aiPick?.selectedIds?.length) {
      const byId = new Map(recipes.map((r) => [r.id, r]));
      const picked = aiPick.selectedIds
        .map((id) => byId.get(id))
        .filter((r): r is Recipe => Boolean(r))
        .slice(0, maxRecipes);
      if (picked.length) recipes = picked;
    } else {
      recipes = recipes.slice(0, maxRecipes);
    }
  }

  if (!recipes.length && cookDishes.length) {
    recipes = buildLocalPantrySuggestions(ctx, namedDishes.join(' ') || userPrompt);
    if (!recipes.length && /fried\s*rice/i.test(userPrompt)) {
      recipes = [buildFriedRiceFromPantry(ctx)];
    }
    if (!recipes.length) recipes = [fallbackRecipe(ctx)];
    log.message = `Used local pantry templates for cook dishes. ${recipes.length} recipe(s).`;
  } else if (!recipes.length && !cookDishes.length && buyReady.length) {
    // Only buy-ready items — no recipe needed
    log.status = 'success';
    log.message = `No cook dishes — shopping for ready items only: ${buyReady.map((b) => b.name).join(', ')}.`;
    log.details = { buyReady: buyReady.map((b) => b.name), mealComponents };
    return { log, recipes: [] };
  } else if (!recipes.length) {
    recipes = buildLocalPantrySuggestions(ctx, userPrompt);
    if (!recipes.length && /fried\s*rice/i.test(userPrompt)) {
      recipes = [buildFriedRiceFromPantry(ctx)];
    }
    if (!recipes.length) recipes = [fallbackRecipe(ctx)];
    log.message = `Used local pantry templates (TheMealDB unavailable). ${recipes.length} recipe(s).`;
  }

  // Attach buy-ready staples as shopping ingredients on the main recipe (or a side holder)
  if (buyReady.length) {
    const buyIngs = buyReady.map((b) => ({
      name: b.name,
      amount: b.buyQty ?? 1,
      unit: b.buyUnit ?? 'pcs',
      source: 'shopping' as const,
    }));
    if (recipes.length) {
      recipes = recipes.map((r, i) =>
        i === 0
          ? {
              ...r,
              ingredients: [...r.ingredients, ...buyIngs],
              reasonForSelection: `${r.reasonForSelection} Plus buy ready: ${buyReady.map((b) => b.name).join(', ')}.`,
            }
          : r
      );
    } else {
      recipes = [
        {
          id: 'buy_ready_sides',
          name: `Buy: ${buyReady.map((b) => b.name).join(' + ')}`,
          ingredients: buyIngs,
          instructions: buyReady.map((b) => `Buy ${b.name} from the shop — ${b.reason}`),
          prepTimeMin: 0,
          cookTimeMin: 0,
          assignedCook: 'Shop run',
          reasonForSelection: componentPlan || 'Ready-made sides only.',
          dietaryTags: ['Buy ready'],
          nutritionalInfo: { calories: 0, protein: '—', sugar: '—', fat: '—' },
        },
      ];
    }
  }

  recipes = applyPantryToRecipes(matchInventoryToRecipes(recipes, ctx.inventory), ctx.inventory)
    .map(normalizeRecipe)
    .filter((r) => !isExoticRecipe(r) || r.id === 'buy_ready_sides')
    .slice(0, Math.max(maxRecipes, buyReady.length ? 1 : maxRecipes));

  const cook = assignCook(ctx);
  recipes = recipes.map((r) => ({
    ...r,
    assignedCook: r.assignedCook === 'Family cook' ? cook : r.assignedCook,
  }));

  const fromMealDb = recipes.filter((r) => /^\d+$/.test(r.id)).length;
  const withImages = recipes.filter((r) => Boolean(r.imageUrl)).length;

  log.status = 'success';
  log.message = `Compiled ${recipes.length} recipe(s) — ${fromMealDb} from TheMealDB${withImages ? `, ${withImages} with photos` : ''}${
    buyReady.length ? `; buy ready: ${buyReady.map((b) => b.name).join(', ')}` : ''
  }. ${recipes.filter((r) => r.ingredients.some((i) => i.source === 'inventory')).length} use home inventory.`;
  log.details = {
    recipeNames: recipes.map((r) => r.name),
    imageUrls: recipes.map((r) => r.imageUrl).filter(Boolean),
    sources: recipes.map((r) => (/^\d+$/.test(r.id) ? 'TheMealDB' : 'local')),
    mealComponents,
    componentPlan,
    relevantPantry: (ctx.relevantPantry ?? []).slice(0, 8).map((i) => i.item),
    fullInventoryCount: ctx.inventory.length,
  };

  return { log, recipes };
}

function normalizeRecipe(recipe: Recipe): Recipe {
  const prep = Number(recipe.prepTimeMin);
  const cook = Number(recipe.cookTimeMin);
  return {
    ...recipe,
    imageUrl: recipe.imageUrl || undefined,
    prepTimeMin: Number.isFinite(prep) ? Math.min(120, Math.max(0, prep)) : 15,
    cookTimeMin: Number.isFinite(cook) ? Math.min(120, Math.max(0, cook)) : 20,
    ingredients: recipe.ingredients.map((ing) => ({
      ...ing,
      amount: safeQuantity(ing.amount, ing.unit),
      unit: ing.unit || 'pcs',
    })),
  };
}
