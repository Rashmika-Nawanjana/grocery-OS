import type { AgentContext, AgentExecutionLog, Recipe } from '@/lib/types';
import { safeQuantity } from '@/lib/services/price-units';
import { searchMeals, searchMealsByIngredient, matchInventoryToRecipes } from '@/lib/services/themealdb';
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
  isSriLankanLocalRecipe,
  mentionsHomeInventory,
  recipeMatchesUserPrompt,
} from '@/lib/orchestrator/meal-intent';
import {
  assignCook,
  buildFriedRiceFromPantry,
  buildLocalPantrySuggestions,
  fallbackRecipe,
} from '@/lib/agents/local-recipes';

export async function runRecipeCompiler(ctx: AgentContext): Promise<{ log: AgentExecutionLog; recipes: Recipe[] }> {
  const log: AgentExecutionLog = {
    agentId: 'recipe-compiler',
    agentName: 'Agent 2: Recipe Compiler',
    status: 'active',
    message: 'Searching recipes via TheMealDB + home inventory RAG...',
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

  const pantryFirst = isPantryMealSuggestionIntent(userPrompt) || mentionsHomeInventory(userPrompt);
  const decidedCook = isDecidedCookIntent(userPrompt);
  const namedDishes = extractNamedDishes(userPrompt);
  const servings = extractFamilySize(userPrompt) ?? 4;

  let recipes: Recipe[] = [];

  if (decidedCook || pantryFirst || namedDishes.length) {
    recipes = buildLocalPantrySuggestions(ctx, userPrompt);
    log.message = decidedCook
      ? 'Building recipes for your requested dishes...'
      : 'Building Sri Lankan recipes from home inventory...';
  }

  const userRequestedLocal =
    decidedCook &&
    recipes.length > 0 &&
    recipes.some((r) => recipeMatchesUserPrompt(r, userPrompt));

  if (!userRequestedLocal && (!recipes.length || !pantryFirst)) {
    recipes = await searchMeals(userPrompt);
    if (!recipes.length && /fried\s*rice/i.test(userPrompt)) {
      recipes = [buildFriedRiceFromPantry(ctx)];
    }
    if (!recipes.length && /kottu|kothu/i.test(userPrompt)) {
      recipes = buildLocalPantrySuggestions(ctx, userPrompt);
    }
  }

  if (!recipes.length && !pantryFirst) {
    const homeItem = ctx.inventory[0]?.item?.split(' ').pop() || 'chicken';
    recipes = await searchMealsByIngredient(homeItem.toLowerCase());
  }

  recipes = matchInventoryToRecipes(recipes, ctx.inventory);
  recipes = recipes.filter((r) => !isExoticRecipe(r));

  const priorRecipes = ctx.previousRecipes?.length
    ? `\nKeep building on these dishes from earlier in the chat: ${ctx.previousRecipes.map((r) => r.name).join(', ')}. Do not replace them unless the user asks for new ideas.`
    : '';

  const familySizeNote = servings ? `\nServe ${servings} people.` : '';
  const pantryNote = pantryFirst
    ? '\nUser wants dinner ideas FROM HOME PANTRY — only Sri Lankan family meals (dhal, rice, egg curry, brinjal, fried rice, kottu). NO Chinese/Japanese/Western fusion. Max 2 recipes.'
    : '';

  if (!userRequestedLocal) {
    const aiRecipes = await geminiJson<{ recipes: Recipe[] }>(
      `User wants: "${userPrompt}"\nBudget: LKR ${ctx.budgetLkr}\nHome inventory: ${JSON.stringify(ctx.inventory)}\nFamily: ${JSON.stringify(ctx.family.map((f) => f.name))}\nExisting recipes: ${recipes.map((r) => r.name).join(', ')}${priorRecipes}${familySizeNote}${pantryNote}\nExclude fish/seafood if prompt says no fish.`,
      `You are a Sri Lankan meal planner for families in Colombo/Negombo. Return JSON with recipes array (max ${pantryFirst ? 2 : 3} recipes). Each recipe: id, name, ingredients[{name,amount,unit,source}], instructions (max 4 short steps), prepTimeMin, cookTimeMin, assignedCook, reasonForSelection, dietaryTags[], nutritionalInfo{calories,protein,sugar,fat}. Prefer home inventory (source: inventory). If user named a dish (kottu, fried rice), build THAT dish only with Sri Lankan ingredients. NEVER suggest Chinese/Japanese/European dishes (no shaoxing, adobo, foo young, gohan). Keep JSON compact.`
    );

    if (aiRecipes?.recipes?.length) {
      const max = pantryFirst ? 2 : 3;
      recipes = aiRecipes.recipes.slice(0, max).map(normalizeRecipe).filter((r) => !isExoticRecipe(r));
    }
  }

  recipes = applyPantryToRecipes(matchInventoryToRecipes(recipes, ctx.inventory), ctx.inventory)
    .map(normalizeRecipe)
    .filter((r) => !isExoticRecipe(r));

  if (!recipes.length) {
    recipes = buildLocalPantrySuggestions(ctx, userPrompt);
  }
  if (!recipes.length) {
    recipes = [/fried\s*rice/i.test(userPrompt) ? buildFriedRiceFromPantry(ctx) : fallbackRecipe(ctx)];
  }

  recipes = recipes.filter((r) => isSriLankanLocalRecipe(r) || !isExoticRecipe(r)).slice(0, pantryFirst ? 2 : 3);

  const cook = assignCook(ctx);
  recipes = recipes.map((r) => ({ ...r, assignedCook: r.assignedCook === 'Family cook' ? cook : r.assignedCook }));

  log.status = 'success';
  log.message = `Compiled ${recipes.length} Sri Lankan recipe(s). ${recipes.filter((r) => r.ingredients.some((i) => i.source === 'inventory')).length} use home inventory.`;
  log.details = { recipeNames: recipes.map((r) => r.name) };

  return { log, recipes };
}

function normalizeRecipe(recipe: Recipe): Recipe {
  const prep = Number(recipe.prepTimeMin);
  const cook = Number(recipe.cookTimeMin);
  return {
    ...recipe,
    prepTimeMin: Number.isFinite(prep) ? Math.min(120, Math.max(0, prep)) : 15,
    cookTimeMin: Number.isFinite(cook) ? Math.min(120, Math.max(0, cook)) : 20,
    ingredients: recipe.ingredients.map((ing) => ({
      ...ing,
      amount: safeQuantity(ing.amount, ing.unit),
      unit: ing.unit || 'pcs',
    })),
  };
}
