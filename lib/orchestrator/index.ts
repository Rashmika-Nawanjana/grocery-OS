import type {
  AgentContext,
  AgentExecutionLog,
  CrisisAlert,
  InventoryItem,
  MealPlanResponse,
  OrchestrationRequest,
  OrchestrationResult,
  Recipe,
  ShoppingListItem,
  SpoilageAlert,
  StorePrice,
  UserScenario,
  WeatherCondition,
  TrafficCondition,
  DietaryVerdict,
  LocalBusiness,
  BudgetDecisionMeta,
} from '@/lib/types';
import { geminiJson, intentSchema } from '@/lib/services/gemini';
import { buildOrchestratorSummary } from '@/lib/orchestrator/summary';
import { collectOrchestrationSources } from '@/lib/data-sources';
import { buildMemoryContext, mergeBudgetWithMemory, getMemoryPreference, prefersHomeInventory, likedDishNames } from '@/lib/memory/context';
import { runPriceCatalog, extractItemsFromPrompt, isPriceLookupRequest } from '@/lib/agents/price-catalog';
import { runRecipeCompiler } from '@/lib/agents/recipe-compiler';
import { runRouteOptimizer } from '@/lib/agents/route-optimizer';
import { runSensoryDecay } from '@/lib/agents/sensory-decay';
import { runDietaryGuard } from '@/lib/agents/dietary-guard';
import { runCrisisAgent } from '@/lib/agents/crisis-agent';
import { runInventoryRAG } from '@/lib/agents/inventory-rag';
import { searchGoogleMapsPlaces, wantsLocalPlacesSearch } from '@/lib/services/google-maps-places';
import { demoPlacesForDish } from '@/lib/services/demo-places';
import {
  evaluateBudgetDecision,
  shouldAutoFetchPlacesForBudget,
  buildMealPlacesPrompt,
  attachAffordablePlaces,
  alignBudgetWithCuration,
} from '@/lib/orchestrator/budget-decision';
import { curateMealPlan, inferMealPeriod } from '@/lib/orchestrator/meal-curation';
import { isDineOutIntent, resolvePresentationPlan } from '@/lib/orchestrator/output-mode';
import { cheapestStore } from '@/lib/services/scraper';
import { lineTotalForIngredient, isPiecePricedUnit, safeLkr, safeQuantity, storeUnitPrice } from '@/lib/services/price-units';
import { capFamilyForAgents } from '@/lib/family/cap-family';
import { spoilageRiskForItem } from '@/lib/services/spoilage';
import {
  type IntentResult,
  SCENARIO_AGENTS,
  detectScenarioFallback,
  enrichAgents,
  pickFollowUpAgents,
  finalizeAgentPlan,
  isCrisisNewsQuestion,
  isEnvironmentOnlyQuestion,
  isWeatherQuestion,
} from '@/lib/orchestrator/intent';
import {
  buildRoutineMeta,
  buildPlanComparisonMeta,
  extractRoutineDays,
  isMealRoutinePlanRequest,
  isRoutineComparisonFollowUp,
  routineCatalogItems,
  detectSandwichFillingVariant,
} from '@/lib/orchestrator/meal-routine';
import { earlyPriceItems, tryFastPathIntent } from '@/lib/orchestrator/fast-path';
import {
  describeMealComponentPlan,
  resolveMealComponents,
} from '@/lib/orchestrator/meal-components';
import { planAgentLog, planLog, planTimed, planWarn } from '@/lib/plan-logger';
import { fetchWeather } from '@/lib/services/weather';
import { fetchCrisisNews } from '@/lib/services/news';
import { homeAreaFromContext, newsLocationLabel } from '@/lib/services/location';
import { upsertAgentLog, type OrchestrationProgressCallback } from '@/lib/orchestrator/progress';
import { estimateCookCostForDish, mentionsHomeInventory } from '@/lib/orchestrator/meal-intent';

const ALL_AGENTS = ['orchestrator', 'inventory-rag', 'dietary-guard', 'recipe-compiler', 'price-catalog', 'route-optimizer', 'sensory-decay', 'crisis-agent'];

function buildAgentPrompt(req: OrchestrationRequest): string {
  const memoryBlock = buildMemoryContext(req.memory);
  const base = req.prompt;
  if (!req.conversationHistory?.length) {
    return memoryBlock ? `${memoryBlock}\n\n${base}` : base;
  }
  const history = req.conversationHistory
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
    .join('\n');
  const block = memoryBlock ? `${memoryBlock}\n\n` : '';
  return `${block}Conversation so far:\n${history}\n\nLatest user message: ${req.prompt}`;
}

function mentionsDietaryConstraints(prompt: string): boolean {
  return /diabetic|allerg|no fish|dietary|low.?carb|vegetarian|vegan|gluten/i.test(prompt);
}

async function classifyIntent(req: OrchestrationRequest, reqId?: string): Promise<IntentResult> {
  const scope = `orchestrator${reqId ? `:${reqId}` : ''}`;

  const fast = tryFastPathIntent(req);
  if (fast) {
    planLog(scope, 'Intent: fast-path (no Gemini)', {
      scenario: fast.scenario,
      agents: fast.agentsToRun,
      reasoning: fast.reasoning,
    });
    return fast;
  }

  planLog(scope, 'Intent: calling Gemini classifier…');

  if (req.isFollowUp && req.previousScenario) {
    const historyBlock = req.conversationHistory?.length
      ? `\nConversation:\n${req.conversationHistory.slice(-6).map((m) => `${m.role}: ${m.text}`).join('\n')}`
      : '';
    const ai = await geminiJson<IntentResult>(
      `Follow-up prompt: "${req.prompt}"\nPrevious scenario: ${req.previousScenario}${historyBlock}\nPrevious recipes: ${req.previousRecipes?.map((r) => r.name).join(', ') || 'none'}`,
      `This is a FOLLOW-UP. If user says "order" after choosing a meal, run price-catalog + route-optimizer + inventory-rag and KEEP the same dishes — do NOT run recipe-compiler unless they ask for new suggestions. Return agentsToRun from: inventory-rag, dietary-guard, recipe-compiler, price-catalog, route-optimizer, sensory-decay, crisis-agent.`,
      intentSchema
    );
    if (ai?.agentsToRun?.length) {
      planLog(scope, 'Intent: Gemini follow-up', { scenario: ai.scenario, agents: ai.agentsToRun });
      const base = {
        scenario: (ai.scenario as UserScenario) || req.previousScenario,
        agentsToRun: ai.agentsToRun.filter((a) => ALL_AGENTS.includes(a)),
        reasoning: ai.reasoning || 'Follow-up — minimal agent set',
        decidedItems: ai.decidedItems,
      };
      return enrichAgents(base, req.prompt);
    }
    planWarn(scope, 'Intent: Gemini follow-up empty — using pickFollowUpAgents');
    return enrichAgents(
      {
        scenario: req.previousScenario,
        agentsToRun: pickFollowUpAgents(req.prompt, req.previousScenario),
        reasoning: 'Follow-up — running contextually relevant agents only',
      },
      req.prompt
    );
  }

  const memoryHint = req.memory
    ? `\nUser memory: budget LKR ${req.memory.defaultBudgetLkr}, area ${req.memory.homeArea}, stores ${req.memory.preferredStores.join(', ') || 'none'}, avoids ${req.memory.entries.filter((e) => e.category === 'avoid').map((e) => e.value).join('; ') || 'none'}`
    : '';

  const ai = await geminiJson<IntentResult>(
    `Prompt: "${req.prompt}"\nIs follow-up: ${req.isFollowUp}\nPrevious scenario: ${req.previousScenario || 'none'}${memoryHint}`,
    `Classify user intent into one of: decided_menu (user knows what to eat, e.g. fried rice tonight), needs_suggestions (wants recipe ideas), shopping_trip (price lookup or grocery shopping only). For meal/cook/eat prompts ALWAYS include inventory-rag, recipe-compiler, price-catalog, dietary-guard, sensory-decay. Return agentsToRun from: inventory-rag, dietary-guard, recipe-compiler, price-catalog, route-optimizer, sensory-decay, crisis-agent.`,
    intentSchema
  );
  if (ai?.scenario && SCENARIO_AGENTS[ai.scenario as UserScenario]) {
    planLog(scope, 'Intent: Gemini classified', { scenario: ai.scenario, agents: ai.agentsToRun, reasoning: ai.reasoning });
    const base = {
      ...ai,
      scenario: ai.scenario as UserScenario,
      agentsToRun: ai.agentsToRun.filter((a) => ALL_AGENTS.includes(a) && a !== 'orchestrator'),
    };
    return enrichAgents(base, req.prompt);
  }
  planWarn(scope, 'Intent: Gemini invalid — using detectScenarioFallback');
  return enrichAgents(detectScenarioFallback(req.prompt, req), req.prompt);
}

function isFoodDeliveryRequest(prompt: string): boolean {
  return isDineOutIntent(prompt);
}

function shoppingLineTotal(
  priceRow: StorePrice | undefined,
  store: 'Keells' | 'Cargills' | 'Pola',
  amount: number,
  unit: string
): number {
  return lineTotalForIngredient(priceRow, store, amount, unit);
}

function buildShoppingList(
  recipes: Recipe[],
  prices: StorePrice[],
  weather: WeatherCondition,
  trafficStore?: string,
  spoilageAlerts: SpoilageAlert[] = [],
  preferredStores: string[] = []
): ShoppingListItem[] {
  const list: ShoppingListItem[] = [];
  const seen = new Set<string>();
  const prefer =
    preferredStores.find((s) => /keells|cargills|pola/i.test(s)) ||
    (trafficStore?.includes('Cargills')
      ? 'Cargills'
      : trafficStore?.includes('Keells')
        ? 'Keells'
        : undefined);

  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      if (ing.source === 'inventory') continue;
      const key = ing.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const priceRow = prices.find(
        (p) => p.itemName.toLowerCase().includes(key) || key.includes(p.itemName.toLowerCase().split(' ')[0])
      );
      let store: 'Keells' | 'Cargills' | 'Pola' = 'Pola';
      if (prefer && /cargills/i.test(prefer)) store = 'Cargills';
      else if (prefer && /keells/i.test(prefer)) store = 'Keells';
      else if (prefer && /pola/i.test(prefer)) store = 'Pola';
      else if (trafficStore?.includes('Cargills')) store = 'Cargills';
      else if (priceRow) store = cheapestStore(priceRow);

      const rawUnit = priceRow ? storeUnitPrice(priceRow, store) : 0.5;
      const unitPrice =
        ing.unit === 'pcs' || isPiecePricedUnit(priceRow?.unit)
          ? rawUnit
          : rawUnit / 1000;

      const qty = safeQuantity(ing.amount, ing.unit);
      const totalPrice = safeLkr(shoppingLineTotal(priceRow, store, qty, ing.unit), 50);

      const spoilageRisk = spoilageAlerts.length
        ? spoilageRiskForItem(ing.name, spoilageAlerts, weather)
        : weather.spoilageModifier < 0.7 && ['tomato', 'fish', 'leaf'].some((p) => key.includes(p))
          ? 'high'
          : 'medium';

      list.push({
        item: ing.name,
        requiredQty: qty,
        unit: ing.unit,
        store,
        unitPrice: safeLkr(unitPrice, 0),
        totalPrice,
        spoilageRisk,
      });
    }
  }
  return list;
}

function calcInventorySavings(recipes: Recipe[], prices: StorePrice[]): number {
  let savings = 0;
  for (const recipe of recipes) {
    for (const ing of recipe.ingredients.filter((i) => i.source === 'inventory')) {
      const price = prices.find((p) => p.itemName.toLowerCase().includes(ing.name.toLowerCase().split(' ')[0]));
      if (!price) continue;
      if (ing.unit === 'g' || ing.unit === 'ml') {
        savings += Math.round(price.polaPrice * (ing.amount / 1000));
      } else if (ing.unit === 'pcs') {
        savings += Math.round(price.polaPrice * ing.amount);
      } else {
        savings += Math.round(price.polaPrice * 0.25);
      }
    }
  }
  return savings;
}

function calcMultiStoreSavings(shoppingList: ShoppingListItem[], prices: StorePrice[]): number {
  let savings = 0;
  for (const item of shoppingList) {
    const key = item.item.toLowerCase();
    const row = prices.find(
      (p) => p.itemName.toLowerCase().includes(key) || key.includes(p.itemName.toLowerCase().split(' ')[0])
    );
    if (!row) continue;
    const keellsEstimate = estimateLineCost(row, item);
    savings += Math.max(0, keellsEstimate - item.totalPrice);
  }
  return Math.round(savings);
}

function estimateLineCost(row: StorePrice, item: ShoppingListItem): number {
  return lineTotalForIngredient(row, 'Keells', item.requiredQty, item.unit);
}

export async function runOrchestration(
  req: OrchestrationRequest,
  reqId?: string,
  onProgress?: OrchestrationProgressCallback
): Promise<OrchestrationResult> {
  const scope = `orchestrator${reqId ? `:${reqId}` : ''}`;
  const pipelineStart = Date.now();
  let logs: AgentExecutionLog[] = [];
  const emit = () => onProgress?.({ type: 'logs', logs: [...logs] });
  const budgetLkr = mergeBudgetWithMemory(req.budgetLkr, req.memory);
  let inventory = req.inventory ?? [];
  const family = capFamilyForAgents(req.family ?? []);
  const memoryContext = buildMemoryContext(req.memory);

  const isRoutineComparison = isRoutineComparisonFollowUp(req.prompt, {
    isFollowUp: req.isFollowUp,
    previousRecipes: req.previousRecipes,
    hadMealRoutine: Boolean(req.previousMealPlan?.mealRoutineMeta),
  });
  const isRoutine = isMealRoutinePlanRequest(req.prompt) || isRoutineComparison;

  const orchLog: AgentExecutionLog = {
    agentId: 'orchestrator',
    agentName: 'Agent 4: Orchestrator',
    status: 'active',
    message: 'Classifying user intent and selecting agents...',
  };
  logs = upsertAgentLog(logs, orchLog);
  emit();

  const intent = await classifyIntent(req, reqId);
  const plan = finalizeAgentPlan(intent, req);
  const presentation = resolvePresentationPlan(req);
  const agentsToRun = plan.agentsToRun;
  let scenario = plan.scenario;
  const reuseRecipes = plan.reuseRecipes || presentation.reusePreviousRecipes;
  const presentationMode = plan.presentationMode;

  const skipped = ALL_AGENTS.filter((a) => a !== 'orchestrator' && !agentsToRun.has(a));
  planLog(scope, `Plan ready — scenario=${scenario}, agents=[${[...agentsToRun].join(', ')}]`, {
    reuseRecipes,
    skipped,
    reasoning: intent.reasoning,
  });

  if (mentionsHomeInventory(req.prompt) || plan.runRecipeCompiler) {
    agentsToRun.add('inventory-rag');
  }
  if (mentionsDietaryConstraints(req.prompt) || (family.some((m) => m.dietaryRestrictions.length || m.allergies.length) && !isRoutine)) {
    agentsToRun.add('dietary-guard');
  }

  const agentPrompt = buildAgentPrompt(req);

  orchLog.status = 'success';
  orchLog.message = `Scenario: ${scenario}. Running ${agentsToRun.size} agents. ${reuseRecipes ? 'Reusing previous meal plan for order.' : intent.reasoning}`;
  orchLog.details = { ...intent, agentsToRun: [...agentsToRun] };
  logs = upsertAgentLog(logs, orchLog);
  emit();

  for (const agentId of skipped) {
    planAgentLog(agentId, 'skip', 'Not required for this scenario');
    logs = upsertAgentLog(logs, {
      agentId,
      agentName: agentLabel(agentId),
      status: 'skipped',
      message: 'Not required for this scenario.',
    });
  }
  emit();

  const mealRoleResolution = await resolveMealComponents(req.prompt, req.memory);
  const rememberedMealMode = getMemoryPreference(req.memory, 'default_meal_mode') as
    | 'cook_pantry'
    | 'cook_shop'
    | 'order'
    | 'eat_out'
    | undefined;
  const rememberedEffort = getMemoryPreference(req.memory, 'default_cook_effort') as
    | 'quick'
    | 'normal'
    | undefined;
  const effectiveMealMode =
    req.clarificationContext?.mealMode ||
    rememberedMealMode ||
    (prefersHomeInventory(req.memory) ? 'cook_pantry' : undefined);
  const effectiveCookEffort = req.clarificationContext?.cookEffort || rememberedEffort;

  let ctx: AgentContext = {
    prompt: agentPrompt,
    userPrompt: req.prompt,
    scenario,
    budgetLkr,
    inventory,
    family,
    decidedItems: intent.decidedItems,
    conversationHistory: req.conversationHistory,
    previousRecipes: req.previousRecipes,
    isFollowUp: req.isFollowUp,
    memoryContext,
    previousMealPlan: req.previousMealPlan,
    memoryEntries: req.memory?.entries,
    mealMode: effectiveMealMode,
    cookEffort: effectiveCookEffort,
    mealComponents: mealRoleResolution.components,
    likedDishes: likedDishNames(req.memory),
    preferredStores: req.memory?.preferredStores ?? [],
  };

  const mealComponentPlan = describeMealComponentPlan(ctx.mealComponents ?? []);
  if (mealComponentPlan) {
    planLog(scope, `Meal roles (${mealRoleResolution.source}): ${mealComponentPlan}`, {
      unsure: mealRoleResolution.unsure,
      mealMode: effectiveMealMode,
    });
  }

  let recipes: Recipe[] =
    presentation.mode === 'dine_out'
      ? (presentation.contextRecipes.length ? presentation.contextRecipes : [])
      : reuseRecipes
        ? (req.previousRecipes ?? [])
        : [];
  let prices: StorePrice[] = [];
  let weather: WeatherCondition = { condition: 'humid', temperature: 28, rainMm: 0, spoilageModifier: 0.85 };
  let traffic: TrafficCondition = { route: '', status: 'clear', estimatedTimeMin: 25, fuelAdjustedCostLkr: 220 };
  let crisis: CrisisAlert = { type: 'none', severity: 'none', affectedAreas: [], expectedDurationDays: 0, warningText: '' };
  let spoilageAlerts: SpoilageAlert[] = [];
  let dietaryVerdict: DietaryVerdict | undefined;
  let relevantPantry: InventoryItem[] = [];

  const preKnownItems = earlyPriceItems(req.prompt, req);
  const runPriceEarly =
    presentation.runPriceCatalog && agentsToRun.has('price-catalog') && preKnownItems.length > 0;
  if (runPriceEarly) {
    planLog(scope, `Wave 1: early price catalog in parallel — items=[${preKnownItems.join(', ')}]`);
  } else {
    planLog(scope, 'Wave 1: parallel agents starting…');
  }

  const earlyPricePromise = runPriceEarly
    ? runPriceCatalog({ ...ctx, prompt: agentPrompt, scenario, decidedItems: intent.decidedItems }, preKnownItems)
    : null;

  async function runAgent<T extends { log: AgentExecutionLog }>(
    agentId: string,
    shouldRun: boolean,
    label: string,
    fn: () => T | Promise<T>
  ): Promise<T | null> {
    if (!shouldRun) return null;
    planAgentLog(agentId, 'start', label);
    logs = upsertAgentLog(logs, {
      agentId,
      agentName: agentLabel(agentId),
      status: 'active',
      message: `${label}...`,
    });
    emit();
    const t0 = Date.now();
    try {
      const result = await Promise.resolve(fn());
      planAgentLog(agentId, 'success', `${label} (${Date.now() - t0}ms)`);
      logs = upsertAgentLog(logs, result.log);
      emit();
      return result;
    } catch (err) {
      planAgentLog(agentId, 'fail', `${label}: ${err instanceof Error ? err.message : String(err)}`);
      logs = upsertAgentLog(logs, {
        agentId,
        agentName: agentLabel(agentId),
        status: 'warn',
        message: err instanceof Error ? err.message : 'Agent failed',
      });
      emit();
      throw err;
    }
  }

  // Inventory RAG first so recipe-compiler gets ranked pantry (not a parallel race).
  const inventoryResult = await runAgent(
    'inventory-rag',
    agentsToRun.has('inventory-rag'),
    'Home inventory RAG',
    () => runInventoryRAG(ctx)
  );
  if (inventoryResult) {
    relevantPantry = inventoryResult.relevantItems;
    if (inventoryResult.items.length) inventory = inventoryResult.items;
    ctx = { ...ctx, inventory, relevantPantry };
    planLog(scope, `Pantry ranked for agents — relevant=${relevantPantry.length}, full=${inventory.length}`, {
      relevant: relevantPantry.slice(0, 6).map((i) => i.item),
    });
  }

  const [crisisResult, sensoryResult, dietaryResult, recipeResult, earlyPriceResult] =
    await Promise.all([
      runAgent('crisis-agent', agentsToRun.has('crisis-agent'), 'Crisis intelligence', () => runCrisisAgent(ctx)),
      runAgent('sensory-decay', agentsToRun.has('sensory-decay'), 'Weather & spoilage', () => runSensoryDecay(ctx)),
      runAgent('dietary-guard', agentsToRun.has('dietary-guard'), 'Dietary guard', () => runDietaryGuard(ctx)),
      runAgent(
        'recipe-compiler',
        agentsToRun.has('recipe-compiler') && plan.runRecipeCompiler && !reuseRecipes,
        'Recipe compiler',
        () => runRecipeCompiler(ctx)
      ),
      runAgent(
        'price-catalog',
        Boolean(earlyPricePromise),
        `Early price catalog (${preKnownItems.join(', ')})`,
        () => earlyPricePromise!
      ),
    ]);

  if (crisisResult) {
    crisis = crisisResult.crisis;
  }
  if (sensoryResult) {
    weather = sensoryResult.weather;
    spoilageAlerts = sensoryResult.alerts;
  }
  if (dietaryResult) {
    dietaryVerdict = dietaryResult.verdict;
  }
  if (recipeResult) {
    recipes = recipeResult.recipes;
  }

  ctx = { ...ctx, inventory, relevantPantry };

  const itemNames = recipes.flatMap((r) => r.ingredients.filter((i) => i.source === 'shopping').map((i) => i.name));
  const priceQueryItems = isPriceLookupRequest(req.prompt) ? extractItemsFromPrompt(req.prompt) : [];
  const routineVariant = detectSandwichFillingVariant(req.prompt);
  const routineItems = isRoutine ? routineCatalogItems(req.prompt, routineVariant) : [];
  const catalogItems =
    priceQueryItems.length ? priceQueryItems : routineItems.length ? routineItems : itemNames.length ? itemNames : intent.decidedItems;

  let priceLiveCount = 0;
  if (earlyPriceResult) {
    prices = earlyPriceResult.prices;
    priceLiveCount = earlyPriceResult.liveCount;
    planLog(scope, `Prices (early): ${prices.length} items, ${priceLiveCount} live`, prices.map((p) => `${p.itemName}=${p.sourceType}`));
  } else if (presentation.runPriceCatalog && agentsToRun.has('price-catalog')) {
    planLog(scope, `Wave 2: price catalog — items=[${(catalogItems ?? []).join(', ') || 'default basket'}]`);
    const priceResult = await runAgent('price-catalog', true, 'Price catalog', () => runPriceCatalog(ctx, catalogItems));
    if (priceResult) {
      prices = priceResult.prices;
      priceLiveCount = priceResult.liveCount;
      planLog(scope, `Prices: ${prices.length} items, ${priceLiveCount} live`, prices.map((p) => `${p.itemName}=${p.sourceType}`));
    }
  }

  const routeResult = agentsToRun.has('route-optimizer')
    ? await runAgent('route-optimizer', true, 'Route optimizer', () => runRouteOptimizer(ctx, crisis.newsHeadlines))
    : null;
  if (routeResult) {
    traffic = routeResult.traffic;
  }

  const homeArea = homeAreaFromContext(memoryContext, req.memory?.homeArea);
  if (isWeatherQuestion(req.prompt) && !agentsToRun.has('sensory-decay')) {
    weather = await fetchWeather(homeArea);
    planLog(scope, `Weather fetched for question (${weather.source})`);
  }
  if (isCrisisNewsQuestion(req.prompt) && !agentsToRun.has('crisis-agent')) {
    crisis = await fetchCrisisNews(newsLocationLabel(homeArea), req.prompt);
    planLog(scope, `News/crisis fetched for question (${crisis.source})`);
  }

  if (!recipes.length && scenario === 'decided_menu' && plan.runRecipeCompiler && !reuseRecipes) {
    const r = await runAgent('recipe-compiler', true, 'Recipe compiler (fallback)', () =>
      runRecipeCompiler({ ...ctx, prompt: ctx.prompt + ' (user decided menu)' })
    );
    if (r) recipes = r.recipes;
  }

  const { recipes: curatedRecipes, meta: planCurationRaw } =
    presentation.mode === 'dine_out'
      ? { recipes: [] as Recipe[], meta: undefined }
      : curateMealPlan({
          recipes,
          prices,
          budgetLkr,
          weather,
          prompt: req.prompt,
          isMealRoutine: isRoutine,
          cookEffort: ctx.cookEffort,
          mealMode: ctx.mealMode,
        });
  recipes = presentation.showRecipes ? curatedRecipes : [];
  const planCuration =
    presentation.mode === 'dine_out'
      ? {
          primaryAction: 'order_out' as const,
          mealPeriod: inferMealPeriod(),
          weatherContext: `${weather.condition} ${weather.temperature}°C${weather.rainMm ? `, ${weather.rainMm}mm rain` : ''}`,
          showCount: 0,
          hiddenCount: presentation.contextRecipes.length,
          recipeRankings: presentation.contextRecipes.map((r) => ({
            name: r.name,
            shopCostLkr: 0,
            homeCount: r.ingredients.filter((i) => i.source === 'inventory').length,
            score: 0,
            included: false,
            reason: 'You asked to order out instead',
          })),
          headline: presentation.contextDish
            ? `Order ${presentation.contextDish} nearby — skip the grocery run`
            : 'Order out — nearby restaurants',
        }
      : planCurationRaw;

  const bestRank = planCuration?.recipeRankings[0];
  const shoppingList = presentation.showShoppingList
    ? buildShoppingList(
        recipes,
        prices,
        weather,
        traffic.recommendedStore,
        spoilageAlerts,
        req.memory?.preferredStores ?? []
      )
    : [];
  const listTotal = shoppingList.reduce((s, i) => s + safeLkr(i.totalPrice), 0);
  const cookEstimate = estimateCookCostForDish(presentation.contextDish);
  const totalBudgetSpent =
    presentation.mode === 'dine_out'
      ? safeLkr(req.previousMealPlan?.totalBudgetSpent ?? (listTotal > 0 ? listTotal : cookEstimate))
      : shoppingList.length > 0
        ? listTotal
        : safeLkr(bestRank?.shopCostLkr ?? listTotal);
  const inventorySavings = calcInventorySavings(recipes, prices);
  const savingsVsSingleStore = calcMultiStoreSavings(shoppingList, prices);

  const foodDelivery =
    presentation.mode === 'dine_out' ||
    isDineOutIntent(req.prompt) ||
    ctx.mealMode === 'order' ||
    ctx.mealMode === 'eat_out';
  const weatherQ = isWeatherQuestion(req.prompt);
  const crisisQ = isCrisisNewsQuestion(req.prompt);
  const envOnly = isEnvironmentOnlyQuestion(req.prompt);

  let budgetDecision: BudgetDecisionMeta = evaluateBudgetDecision({
    prompt: req.prompt,
    scenario,
    budgetLkr,
    groceryTotalLkr: totalBudgetSpent,
    shoppingList,
    recipes,
    isMealRoutine: isRoutine,
    planCuration,
    mealMode: ctx.mealMode,
  });
  budgetDecision = alignBudgetWithCuration(budgetDecision, planCuration);

  planLog(scope, `Budget decision: ${budgetDecision.recommendation}`, {
    grocery: totalBudgetSpent,
    budget: budgetLkr,
    ratio: budgetDecision.spendRatio.toFixed(1),
    curation: planCuration?.showCount ?? recipes.length,
    hidden: planCuration?.hiddenCount ?? 0,
  });

  let localBusinesses: LocalBusiness[] = [];
  let placesQuery = '';
  const needsPlaces =
    presentation.showPlaces ||
    wantsLocalPlacesSearch(req.prompt) ||
    shouldAutoFetchPlacesForBudget(
      budgetDecision,
      req.prompt,
      isRoutine,
      planCuration,
      ctx.mealMode
    );

  if (needsPlaces) {
    const placesContextRecipes =
      presentation.mode === 'dine_out' ? presentation.contextRecipes : recipes;
    placesQuery = buildMealPlacesPrompt(placesContextRecipes, req.prompt, homeArea);
    const placesResult = await planTimed(scope, 'Google Maps places', async () => {
      let { places, query, source } = await searchGoogleMapsPlaces({
        prompt: req.prompt,
        homeArea,
        queryOverride: placesQuery,
      });

      if (!places.length) {
        const fallbackQuery = `restaurants ${homeArea?.trim() || 'Negombo, Sri Lanka'}`;
        if (fallbackQuery.toLowerCase() !== query.toLowerCase()) {
          const retry = await searchGoogleMapsPlaces({
            prompt: req.prompt,
            homeArea,
            queryOverride: fallbackQuery,
          });
          if (retry.places.length) {
            places = retry.places;
            query = retry.query;
            source = retry.source;
          }
        }
      }

      if (!places.length && presentation.mode === 'dine_out') {
        places = demoPlacesForDish(presentation.contextDish, homeArea);
        planLog(scope, `Using demo restaurant fallback for "${presentation.contextDish || 'dine-out'}" (${places.length} places)`);
      }

      const log: AgentExecutionLog = {
        agentId: 'places-search',
        agentName: 'Google Maps Places',
        status: places.length ? 'success' : 'warn',
        message: places.length
          ? `Found ${places.length} place(s) for budget comparison — "${query}"`
          : `No places found for "${query}" (${source})`,
        details: { query, source, count: places.length, demoFallback: source === 'unavailable' && places.length > 0 },
      };
      return { log, places, query };
    });
    logs.push(placesResult.log);
    localBusinesses = placesResult.places;
    placesQuery = placesResult.query;
    budgetDecision = attachAffordablePlaces(budgetDecision, localBusinesses, {
      dineOut: presentation.mode === 'dine_out',
    });
  }

  if (presentation.mode === 'dine_out') {
    budgetDecision = {
      ...budgetDecision,
      recommendation: 'order_out',
      headline: planCuration?.headline ?? 'Order out tonight',
      reason: presentation.contextDish
        ? `You wanted ${presentation.contextDish} — ordering beats a LKR ${totalBudgetSpent.toLocaleString()} grocery run.`
        : budgetDecision.reason,
      groceryTotalLkr: totalBudgetSpent,
      spendRatio: totalBudgetSpent / Math.max(1, budgetLkr),
      tips: [
        `${planCuration?.mealPeriod ?? 'Tonight'} · ${planCuration?.weatherContext ?? ''}`.trim(),
        localBusinesses.length
          ? 'Tap a restaurant card below for Maps, menu, and delivery options.'
          : `Search PickMe or Uber Eats for ${presentation.contextDish || 'nearby food'}.`,
        ...budgetDecision.tips,
      ].slice(0, 4),
    };
  }

  const routineDays = extractRoutineDays(req.prompt, req.previousMealPlan?.mealRoutineMeta?.daysPlanned ?? 7);

  const mealRoutineMeta = isRoutine
    ? buildRoutineMeta(req.prompt, routineDays, weather, shoppingList, prices)
    : undefined;

  const planComparisonMeta =
    isRoutineComparison && req.previousMealPlan?.totalBudgetSpent != null && routineVariant !== 'full'
      ? buildPlanComparisonMeta(
          routineVariant,
          req.previousMealPlan.totalBudgetSpent,
          totalBudgetSpent,
          routineDays
        )
      : undefined;

  const orchestratorSummary = await planTimed(scope, 'Build summary', () =>
    buildOrchestratorSummary({
      prompt: req.prompt,
      scenario,
      recipes,
      shoppingList,
      prices,
      totalBudgetSpent,
      budgetLkr,
      inventorySavings,
      savingsVsSingleStore,
      inventory,
      relevantPantry,
      dietaryVerdict,
      conversationHistory: req.conversationHistory,
      isOrderFollowUp: reuseRecipes && presentation.mode === 'grocery_order',
      isFoodDeliveryRequest: foodDelivery,
      isDineOutRequest: presentation.mode === 'dine_out',
      contextDish: presentation.contextDish,
      isPriceLookup: isPriceLookupRequest(req.prompt),
      isMealRoutinePlan: isRoutine,
      mealRoutineMeta,
      planComparisonMeta,
      localBusinesses,
      placesQuery,
      budgetDecision,
      planCuration,
      outputMode: presentationMode,
      mealMode: ctx.mealMode,
      cookEffort: ctx.cookEffort,
      weather,
      crisis,
      spoilageAlerts,
      isWeatherQuestion: weatherQ,
      isCrisisQuestion: crisisQ,
      isEnvironmentOnly: envOnly,
    })
  );

  planLog(scope, `Pipeline complete (${Date.now() - pipelineStart}ms) — spend LKR ${totalBudgetSpent}, ${shoppingList.length} shop items, ${recipes.length} recipes`);

  const sources = collectOrchestrationSources({
    agentsRun: [...agentsToRun],
    prices,
    recipes,
    weather,
    crisis,
    priceLiveCount,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  const data: MealPlanResponse = {
    recipes,
    shoppingList,
    totalBudgetSpent,
    savingsVsSingleStore,
    inventorySavings,
    cookingSchedulerReason: recipes.map((r) => `${r.assignedCook}: ${r.name}`).join('; ') || 'No recipes compiled.',
    orchestratorSummary,
    mealRoutineMeta,
    planComparisonMeta,
    budgetDecision,
    planCuration,
    outputMode: presentationMode,
    contextDish: presentation.contextDish,
    localBusinesses: localBusinesses.length ? localBusinesses : undefined,
    placesQuery: placesQuery || undefined,
  };

  return {
    success: true,
    scenario,
    agentsRun: [...agentsToRun, ...(localBusinesses.length ? ['places-search'] : [])],
    logs,
    data,
    weather,
    traffic,
    crisis,
    prices,
    spoilageAlerts,
    dietaryVerdict,
    sources,
    localBusinesses: localBusinesses.length ? localBusinesses : undefined,
    placesQuery: placesQuery || undefined,
    mealComponents: mealRoleResolution.components.map((c) => ({
      name: c.name,
      role: c.role,
      reason: c.reason,
    })),
  };
}

function agentLabel(id: string): string {
  const labels: Record<string, string> = {
    'inventory-rag': 'Agent 1: Home Inventory RAG',
    'dietary-guard': 'Agent 6: Dietary Guard',
    'recipe-compiler': 'Agent 2: Recipe Compiler',
    'price-catalog': 'Agent 7: Price Catalog',
    'route-optimizer': 'Agent 3: Route Optimizer',
    'sensory-decay': 'Agent 5: Sensory Decay',
    'crisis-agent': 'Agent 7: Crisis Intelligence',
  };
  return labels[id] || id;
}
