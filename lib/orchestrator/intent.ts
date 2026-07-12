import { extractItemsFromPrompt, isPriceLookupRequest } from '@/lib/agents/price-query';
import { isPreparedFoodOrderIntent, isDineOutIntent, normalizeOrderTypos } from '@/lib/orchestrator/meal-intent';
import { resolvePresentationPlan, type OrchestratorOutputMode } from '@/lib/orchestrator/output-mode';
import { isMealRoutinePlanRequest, isRoutineComparisonFollowUp, routineCatalogItems, detectSandwichFillingVariant } from '@/lib/orchestrator/meal-routine';
import type { OrchestrationRequest, UserScenario } from '@/lib/types';

const ALL_AGENT_IDS = [
  'inventory-rag',
  'dietary-guard',
  'recipe-compiler',
  'price-catalog',
  'route-optimizer',
  'sensory-decay',
  'crisis-agent',
] as const;

export const SCENARIO_AGENTS: Record<UserScenario, string[]> = {
  decided_menu: ['inventory-rag', 'dietary-guard', 'recipe-compiler', 'price-catalog', 'route-optimizer', 'sensory-decay'],
  needs_suggestions: ['inventory-rag', 'dietary-guard', 'recipe-compiler', 'price-catalog', 'route-optimizer', 'sensory-decay', 'crisis-agent'],
  shopping_trip: ['inventory-rag', 'price-catalog', 'route-optimizer', 'crisis-agent'],
};

export interface IntentResult {
  scenario: UserScenario;
  agentsToRun: string[];
  decidedItems?: string[];
  reasoning: string;
}

export function isMealIntent(prompt: string): boolean {
  if (isPriceLookupRequest(prompt)) return false;
  return /\b(eat|cook|make|prepare|hungry|meal|recipe|dinner|lunch|breakfast|tonight|fried\s*rice|curry|dhal|rice)\b/i.test(
    prompt
  );
}

export function isWeatherQuestion(prompt: string): boolean {
  return /\b(weather|monsoon|rain(?:y|ing)?|temperature|humid|forecast|spoil|spoiling|spoilage|hot today|how hot|how cold)\b/i.test(
    prompt
  );
}

export function isCrisisNewsQuestion(prompt: string): boolean {
  return /\b(flood|storm|cyclone|strike|protest|curfew|crisis|warning|news|headline|alert|emergency|disaster)\b/i.test(
    prompt
  );
}

export function isEnvironmentOnlyQuestion(prompt: string): boolean {
  const env = isWeatherQuestion(prompt) || isCrisisNewsQuestion(prompt);
  if (!env) return false;
  const shopping =
    /\b(shopping|shop for|grocery list|compare prices|buy now|going shopping)\b/i.test(prompt) ||
    isPriceLookupRequest(prompt);
  return !isMealIntent(prompt) && !shopping && !isGroceryOrderFollowUp(prompt);
}

export function environmentAgentsForPrompt(prompt: string): string[] {
  const agents: string[] = [];
  if (isWeatherQuestion(prompt)) agents.push('sensory-decay');
  if (isCrisisNewsQuestion(prompt)) agents.push('crisis-agent');
  return agents;
}

export function isDecidedMealIntent(prompt: string): boolean {
  const lower = normalizeOrderTypos(prompt);
  if (isPreparedFoodOrderIntent(prompt)) return false;
  return (
    /\b(fried\s*rice|kottu|kothu|already decided|want to (eat|make|cook)|cook .+ tonight|eat .+ tonight|make .+ tonight)\b/i.test(
      lower
    ) || (isMealIntent(prompt) && /\b(fried\s*rice|kottu|kothu|rice and|dhal curry|chicken fry)\b/i.test(lower))
  );
}

export function isGroceryOrderFollowUp(prompt: string): boolean {
  if (isDineOutIntent(prompt)) return false;
  const normalized = prompt.toLowerCase().replace(/\boder\b/g, 'order');
  return /\b(order|checkout|pick up|buy now|place order|get ingredients|shop for|order like|order tonight|grocery order|buy the|shop for this)\b/i.test(
    normalized
  );
}

export function wantsNewRecipes(prompt: string): boolean {
  return /\bsuggest\b|\binstead\b|\bchange\b|\bswap\b|\bdifferent\b|\bother\b|\bwhat else\b/i.test(prompt);
}

export function shouldReusePreviousRecipes(req: OrchestrationRequest): boolean {
  return Boolean(
    req.isFollowUp &&
      req.previousRecipes?.length &&
      isGroceryOrderFollowUp(req.prompt) &&
      !wantsNewRecipes(req.prompt)
  );
}

export function detectScenarioFallback(prompt: string, req?: OrchestrationRequest): IntentResult {
  if (isEnvironmentOnlyQuestion(prompt)) {
    const agents = environmentAgentsForPrompt(prompt);
    return {
      scenario: 'shopping_trip',
      agentsToRun: agents.length ? agents : ['sensory-decay', 'crisis-agent'],
      reasoning: 'Live weather and/or news lookup for your question',
    };
  }

  if (
    req &&
    isRoutineComparisonFollowUp(prompt, {
      isFollowUp: req.isFollowUp,
      previousRecipes: req.previousRecipes,
      hadMealRoutine: Boolean(req.previousMealPlan?.mealRoutineMeta),
    })
  ) {
    const variant = detectSandwichFillingVariant(prompt);
    return {
      scenario: 'decided_menu',
      agentsToRun: ['inventory-rag', 'recipe-compiler', 'price-catalog', 'sensory-decay'],
      decidedItems: routineCatalogItems(prompt, variant),
      reasoning: 'Routine comparison — rebuild plan with alternate filling and show savings',
    };
  }

  if (isMealRoutinePlanRequest(prompt)) {
    return {
      scenario: 'decided_menu',
      agentsToRun: ['inventory-rag', 'recipe-compiler', 'price-catalog', 'sensory-decay'],
      decidedItems: routineCatalogItems(prompt),
      reasoning: 'Recurring meal routine — quantities, pricing, and shopping frequency',
    };
  }

  if (isPriceLookupRequest(prompt)) {
    return {
      scenario: 'shopping_trip',
      agentsToRun: ['inventory-rag', 'price-catalog'],
      decidedItems: extractItemsFromPrompt(prompt),
      reasoning: 'Direct grocery price lookup',
    };
  }

  const lower = prompt.toLowerCase();

  if (isDineOutIntent(prompt)) {
    return {
      scenario: 'shopping_trip',
      agentsToRun: ['sensory-decay'],
      reasoning: 'Dine-out — find nearby restaurants, skip grocery planning',
    };
  }

  if (isGroceryOrderFollowUp(prompt)) {
    return {
      scenario: 'shopping_trip',
      agentsToRun: ['inventory-rag', 'price-catalog', 'route-optimizer'],
      reasoning: 'User wants to order or shop for groceries',
    };
  }

  if (lower.includes('buy') || lower.includes('shopping') || lower.includes('shop for') || lower.includes('grocery list')) {
    return { scenario: 'shopping_trip', agentsToRun: SCENARIO_AGENTS.shopping_trip, reasoning: 'Shopping intent detected' };
  }

  if (isDecidedMealIntent(prompt)) {
    return {
      scenario: 'decided_menu',
      agentsToRun: SCENARIO_AGENTS.decided_menu,
      reasoning: 'User already named or decided what to eat',
    };
  }

  if (isMealIntent(prompt)) {
    return {
      scenario: 'needs_suggestions',
      agentsToRun: SCENARIO_AGENTS.needs_suggestions.filter((a) => a !== 'crisis-agent'),
      reasoning: 'User wants meal help — run full meal planning agents',
    };
  }

  return { scenario: 'needs_suggestions', agentsToRun: SCENARIO_AGENTS.needs_suggestions, reasoning: 'General request — meal suggestion pipeline' };
}

export function enrichAgents(intent: IntentResult, prompt: string): IntentResult {
  const agents = new Set(intent.agentsToRun.filter((a) => ALL_AGENT_IDS.includes(a as (typeof ALL_AGENT_IDS)[number])));

  if (isPriceLookupRequest(prompt)) {
    agents.add('price-catalog');
    agents.add('inventory-rag');
    agents.delete('recipe-compiler');
    agents.delete('route-optimizer');
    agents.delete('crisis-agent');
    return { ...intent, scenario: 'shopping_trip', agentsToRun: [...agents] };
  }

  if (isMealRoutinePlanRequest(prompt)) {
    agents.add('inventory-rag');
    agents.add('recipe-compiler');
    agents.add('price-catalog');
    agents.add('sensory-decay');
    agents.delete('route-optimizer');
    agents.delete('crisis-agent');
    agents.delete('dietary-guard');
    return {
      ...intent,
      scenario: 'decided_menu',
      decidedItems: routineCatalogItems(prompt, detectSandwichFillingVariant(prompt)),
      agentsToRun: [...agents],
      reasoning: 'Recurring meal routine — build shopping quantities and schedule',
    };
  }

  if (isDineOutIntent(prompt)) {
    agents.delete('recipe-compiler');
    agents.delete('price-catalog');
    agents.delete('route-optimizer');
    agents.delete('dietary-guard');
    agents.delete('crisis-agent');
    agents.add('sensory-decay');
    return {
      ...intent,
      scenario: 'shopping_trip',
      agentsToRun: [...agents],
      reasoning: 'Dine-out — find nearby restaurants, skip grocery planning',
    };
  }

  if (isMealIntent(prompt)) {
    agents.add('inventory-rag');
    agents.add('recipe-compiler');
    agents.add('price-catalog');
    agents.add('dietary-guard');
    agents.add('sensory-decay');
    agents.add('route-optimizer');
    if (isWeatherQuestion(prompt)) agents.add('sensory-decay');
    if (isCrisisNewsQuestion(prompt)) agents.add('crisis-agent');
    else if (!/\b(flood|storm|crisis|strike|curfew|warning)\b/i.test(prompt)) agents.delete('crisis-agent');
    const scenario = isDecidedMealIntent(prompt) ? 'decided_menu' : intent.scenario === 'shopping_trip' ? 'needs_suggestions' : intent.scenario;
    return { ...intent, scenario, agentsToRun: [...agents] };
  }

  if (intent.scenario === 'shopping_trip') {
    agents.add('price-catalog');
    agents.add('inventory-rag');
  }

  if (isWeatherQuestion(prompt)) agents.add('sensory-decay');
  if (isCrisisNewsQuestion(prompt)) agents.add('crisis-agent');

  if (isEnvironmentOnlyQuestion(prompt)) {
    agents.delete('recipe-compiler');
    agents.delete('dietary-guard');
    agents.delete('price-catalog');
    agents.delete('route-optimizer');
    agents.delete('inventory-rag');
    for (const id of environmentAgentsForPrompt(prompt)) agents.add(id);
    return { ...intent, scenario: 'shopping_trip', agentsToRun: [...agents] };
  }

  if (agents.size < 2 && !isEnvironmentOnlyQuestion(prompt)) {
    agents.add('inventory-rag');
    agents.add('price-catalog');
  }

  return { ...intent, agentsToRun: [...agents] };
}

export function pickFollowUpAgents(prompt: string, scenario: UserScenario): string[] {
  const agents = new Set<string>(['inventory-rag']);

  if (isDineOutIntent(prompt)) {
    agents.add('sensory-decay');
    return [...agents];
  }

  if (isGroceryOrderFollowUp(prompt)) {
    agents.add('price-catalog');
    agents.add('route-optimizer');
    return [...agents];
  }

  const lower = prompt.toLowerCase();
  if (lower.includes('price') || lower.includes('cheap') || lower.includes('store') || lower.includes('budget')) {
    agents.add('price-catalog');
  }
  if (lower.includes('route') || lower.includes('traffic') || lower.includes('blocked')) agents.add('route-optimizer');
  if (lower.includes('diet') || lower.includes('allerg') || lower.includes('diabetic')) agents.add('dietary-guard');
  if (lower.includes('spoil') || lower.includes('weather') || lower.includes('monsoon')) agents.add('sensory-decay');
  if (lower.includes('flood') || lower.includes('crisis') || lower.includes('storm')) agents.add('crisis-agent');
  if (lower.includes('recipe') || lower.includes('swap') || lower.includes('cook') || lower.includes('meal') || lower.includes('suggest')) {
    agents.add('recipe-compiler');
  }

  if (agents.size === 1) {
    return SCENARIO_AGENTS[scenario].filter((a) => a !== 'crisis-agent' || lower.includes('flood'));
  }
  return [...agents];
}

export function finalizeAgentPlan(
  intent: IntentResult,
  req: OrchestrationRequest
): { agentsToRun: Set<string>; scenario: UserScenario; reuseRecipes: boolean; runRecipeCompiler: boolean; presentationMode: OrchestratorOutputMode } {
  const presentation = resolvePresentationPlan(req);

  if (presentation.mode === 'dine_out') {
    const agents = new Set<string>(['sensory-decay']);
    return {
      agentsToRun: agents,
      scenario: 'shopping_trip',
      reuseRecipes: presentation.reusePreviousRecipes,
      runRecipeCompiler: false,
      presentationMode: 'dine_out',
    };
  }

  const reuseRecipes = shouldReusePreviousRecipes(req);
  let scenario = intent.scenario;
  const agents = new Set(intent.agentsToRun);

  if (reuseRecipes) {
    agents.delete('recipe-compiler');
    agents.add('inventory-rag');
    agents.add('price-catalog');
    agents.add('route-optimizer');
    if (req.previousScenario === 'needs_suggestions') scenario = 'decided_menu';
    return { agentsToRun: agents, scenario, reuseRecipes: true, runRecipeCompiler: false, presentationMode: 'grocery_order' };
  }

  if (
    req &&
    isRoutineComparisonFollowUp(req.prompt, {
      isFollowUp: req.isFollowUp,
      previousRecipes: req.previousRecipes,
      hadMealRoutine: Boolean(req.previousMealPlan?.mealRoutineMeta),
    })
  ) {
    agents.add('inventory-rag');
    agents.add('recipe-compiler');
    agents.add('price-catalog');
    agents.add('sensory-decay');
    agents.delete('route-optimizer');
    agents.delete('crisis-agent');
    agents.delete('dietary-guard');
    scenario = 'decided_menu';
    return { agentsToRun: agents, scenario, reuseRecipes: false, runRecipeCompiler: true, presentationMode: 'meal_plan' };
  }

  if (isMealRoutinePlanRequest(req.prompt) && !isPriceLookupRequest(req.prompt)) {
    agents.add('inventory-rag');
    agents.add('recipe-compiler');
    agents.add('price-catalog');
    agents.add('sensory-decay');
    agents.delete('route-optimizer');
    agents.delete('crisis-agent');
    scenario = 'decided_menu';
    return { agentsToRun: agents, scenario, reuseRecipes: false, runRecipeCompiler: true, presentationMode: 'meal_plan' };
  }

  if (isMealIntent(req.prompt) && !isPriceLookupRequest(req.prompt)) {
    agents.add('inventory-rag');
    agents.add('recipe-compiler');
    agents.add('price-catalog');
    agents.add('dietary-guard');
    agents.add('sensory-decay');
    agents.add('route-optimizer');
    if (isDecidedMealIntent(req.prompt)) scenario = 'decided_menu';
    else if (scenario === 'shopping_trip') scenario = 'needs_suggestions';
  }

  return {
    agentsToRun: agents,
    scenario,
    reuseRecipes: false,
    runRecipeCompiler: agents.has('recipe-compiler'),
    presentationMode: presentation.mode === 'price_lookup' ? 'price_lookup' : 'meal_plan',
  };
}
