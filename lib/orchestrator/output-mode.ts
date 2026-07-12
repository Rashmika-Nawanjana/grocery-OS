import type { OrchestrationRequest, Recipe } from '@/lib/types';
import { wantsLocalPlacesSearch } from '@/lib/services/google-maps-places';
import { isPriceLookupRequest } from '@/lib/agents/price-query';
import { isGroceryOrderFollowUp, shouldReusePreviousRecipes } from '@/lib/orchestrator/intent';
import {
  extractNamedDishes,
  isDineOutIntent,
  isPreparedFoodOrderIntent,
  normalizeOrderTypos,
} from '@/lib/orchestrator/meal-intent';

export type OrchestratorOutputMode = 'meal_plan' | 'grocery_order' | 'dine_out' | 'price_lookup';

export interface PresentationPlan {
  mode: OrchestratorOutputMode;
  /** Recipes kept for context (places query, dish name) — may not be shown in UI. */
  contextRecipes: Recipe[];
  reusePreviousRecipes: boolean;
  showShoppingList: boolean;
  showRecipes: boolean;
  showPriceComparison: boolean;
  showPlaces: boolean;
  runRecipeCompiler: boolean;
  runPriceCatalog: boolean;
  contextDish?: string;
}

export { isDineOutIntent, isPreparedFoodOrderIntent };

export function extractDishFromContext(req: OrchestrationRequest): string | undefined {
  const fromRecipes = req.previousRecipes?.[0]?.name || req.previousMealPlan?.recipes?.[0]?.name;
  if (fromRecipes) return fromRecipes;

  const named = extractNamedDishes(req.prompt);
  if (named.length) return named.join(' & ');

  const history = req.conversationHistory ?? [];
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== 'user') continue;
    const m = msg.text.match(/\b(kottu|fried rice|dhal|curry|hoppers|biryani|roti)\b[^.?!]{0,40}/i);
    if (m) return m[0].trim();
  }
  return undefined;
}

export function resolvePresentationPlan(req: OrchestrationRequest): PresentationPlan {
  if (isPriceLookupRequest(req.prompt)) {
    return {
      mode: 'price_lookup',
      contextRecipes: [],
      reusePreviousRecipes: false,
      showShoppingList: false,
      showRecipes: false,
      showPriceComparison: true,
      showPlaces: false,
      runRecipeCompiler: false,
      runPriceCatalog: true,
    };
  }

  if (isDineOutIntent(req.prompt)) {
    const contextRecipes = req.previousRecipes?.length
      ? req.previousRecipes
      : req.previousMealPlan?.recipes ?? [];
    const namedDishes = extractNamedDishes(req.prompt);
    const contextDish =
      namedDishes.length > 1
        ? namedDishes.join(' & ')
        : namedDishes[0] || extractDishFromContext(req) || contextRecipes[0]?.name;
    return {
      mode: 'dine_out',
      contextRecipes,
      reusePreviousRecipes: contextRecipes.length > 0,
      showShoppingList: false,
      showRecipes: false,
      showPriceComparison: false,
      showPlaces: true,
      runRecipeCompiler: false,
      runPriceCatalog: false,
      contextDish,
    };
  }

  if (shouldReusePreviousRecipes(req)) {
    const contextRecipes = req.previousRecipes ?? [];
    return {
      mode: 'grocery_order',
      contextRecipes,
      reusePreviousRecipes: true,
      showShoppingList: true,
      showRecipes: true,
      showPriceComparison: true,
      showPlaces: false,
      runRecipeCompiler: false,
      runPriceCatalog: true,
      contextDish: contextRecipes[0]?.name,
    };
  }

  return {
    mode: 'meal_plan',
    contextRecipes: [],
    reusePreviousRecipes: false,
    showShoppingList: true,
    showRecipes: true,
    showPriceComparison: true,
    showPlaces: false,
    runRecipeCompiler: true,
    runPriceCatalog: true,
  };
}

/** Strip agents that are irrelevant for the resolved output mode. */
export function applyPresentationToAgents(agents: Set<string>, plan: PresentationPlan): void {
  if (plan.mode === 'dine_out') {
    agents.delete('recipe-compiler');
    agents.delete('price-catalog');
    agents.delete('route-optimizer');
    agents.delete('dietary-guard');
    agents.delete('crisis-agent');
    if (!agents.has('sensory-decay')) agents.add('sensory-decay');
    return;
  }

  if (plan.mode === 'grocery_order') {
    agents.delete('recipe-compiler');
    agents.add('inventory-rag');
    agents.add('price-catalog');
    agents.add('route-optimizer');
  }
}
