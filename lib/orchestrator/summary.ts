import type {
  DietaryVerdict,
  InventoryItem,
  LocalBusiness,
  MealRoutineMeta,
  PlanComparisonMeta,
  Recipe,
  ShoppingListItem,
  SpoilageAlert,
  StorePrice,
  UserScenario,
  WeatherCondition,
  CrisisAlert,
} from '@/lib/types';
import { geminiText } from '@/lib/services/gemini';
import { planLog } from '@/lib/plan-logger';
import { formatComparisonSummary } from '@/lib/orchestrator/meal-routine';
import { formatBudgetDecisionSummary } from '@/lib/orchestrator/budget-decision';
import type { BudgetDecisionMeta, PlanCurationMeta } from '@/lib/types';

interface SummaryInput {
  prompt: string;
  scenario: UserScenario;
  recipes: Recipe[];
  shoppingList: ShoppingListItem[];
  prices?: StorePrice[];
  totalBudgetSpent: number;
  budgetLkr: number;
  inventorySavings: number;
  savingsVsSingleStore: number;
  inventory: InventoryItem[];
  relevantPantry?: InventoryItem[];
  dietaryVerdict?: DietaryVerdict;
  conversationHistory?: { role: 'user' | 'assistant'; text: string }[];
  isOrderFollowUp?: boolean;
  isFoodDeliveryRequest?: boolean;
  isDineOutRequest?: boolean;
  contextDish?: string;
  isPriceLookup?: boolean;
  isMealRoutinePlan?: boolean;
  mealRoutineMeta?: MealRoutineMeta;
  planComparisonMeta?: PlanComparisonMeta;
  localBusinesses?: LocalBusiness[];
  placesQuery?: string;
  budgetDecision?: BudgetDecisionMeta;
  planCuration?: PlanCurationMeta;
  weather?: WeatherCondition;
  crisis?: CrisisAlert;
  spoilageAlerts?: SpoilageAlert[];
  isWeatherQuestion?: boolean;
  isCrisisQuestion?: boolean;
  isEnvironmentOnly?: boolean;
  outputMode?: 'meal_plan' | 'grocery_order' | 'dine_out' | 'price_lookup';
  mealMode?: 'cook_pantry' | 'cook_shop' | 'order' | 'eat_out';
  cookEffort?: 'quick' | 'normal';
}

/** Follow-up choices shown at the end of every final meal answer. */
export function nextStepChoices(input: Pick<SummaryInput, 'outputMode' | 'mealMode' | 'isDineOutRequest' | 'isPriceLookup' | 'isEnvironmentOnly'>): string[] {
  if (input.isEnvironmentOnly || input.isPriceLookup) return [];

  const mode = input.mealMode;
  if (mode === 'order' || mode === 'eat_out' || input.isDineOutRequest || input.outputMode === 'dine_out') {
    return ['Pick a place', 'Switch to cook at home', 'Change budget'];
  }
  if (mode === 'cook_shop' || input.outputMode === 'grocery_order') {
    return ['Build shopping list', 'Cook with pantry only', 'Compare prices'];
  }
  if (mode === 'cook_pantry') {
    return ['Start cooking this', 'Order ingredients for gaps', 'Switch to eat out'];
  }
  return ['Order ingredients', 'Switch to eat out', 'Suggest something else'];
}

function formatNextStepBlock(input: SummaryInput): string {
  const choices = nextStepChoices(input);
  if (!choices.length) return '';
  return `\n\nNext steps: ${choices.join(' · ')}`;
}

function withNextSteps(text: string, input: SummaryInput): string {
  if (!text.trim()) return text;
  if (/next steps:/i.test(text)) return text;
  const block = formatNextStepBlock(input);
  if (!block) return text;
  return `${text.trimEnd()}${block}`;
}

/** Single source of truth passed to summary — orchestrator decision, not raw agent dumps. */
interface OrchestratorBrief {
  outputMode: SummaryInput['outputMode'];
  primaryAction?: string;
  headline?: string;
  reason?: string;
  contextDish?: string;
  showRecipeNames: string[];
  hiddenRecipeNames: string[];
  shoppingItemCount: number;
  totalSpendLkr: number;
  budgetLkr: number;
  placesQuery?: string;
  restaurantCount: number;
  instructSummary: string;
}

function buildOrchestratorBrief(input: SummaryInput): OrchestratorBrief {
  const showRecipeNames = input.recipes.map((r) => r.name);
  const hiddenRecipeNames =
    input.planCuration?.recipeRankings.filter((r) => !r.included).map((r) => r.name) ?? [];

  let instructSummary = 'Answer the latest user message using ONLY the orchestrator decision below.';
  if (input.outputMode === 'dine_out') {
    instructSummary =
      'User wants to ORDER prepared food. Recommend restaurants from localBusinesses JSON. Do NOT list grocery items or cooking steps.';
  } else if (input.outputMode === 'grocery_order') {
    instructSummary =
      'User wants to SHOP for ingredients for the same meal. List shopping list with prices. Do NOT suggest new recipes.';
  } else if (input.planCuration?.hiddenCount) {
    instructSummary = `Discuss ONLY these recipes: ${showRecipeNames.join(', ') || 'none'}. Do NOT mention hidden recipes except one line that others were skipped.`;
  } else if (showRecipeNames.length) {
    instructSummary = `Recommend cooking: ${showRecipeNames.join(', ')}. Use shopping list prices. Sri Lankan family context.`;
  }

  const choices = nextStepChoices(input);
  if (choices.length) {
    instructSummary += ` End with exactly one line: "Next steps: ${choices.join(' · ')}".`;
  }

  return {
    outputMode: input.outputMode ?? 'meal_plan',
    primaryAction: input.planCuration?.primaryAction ?? input.budgetDecision?.recommendation,
    headline: input.planCuration?.headline ?? input.budgetDecision?.headline,
    reason: input.budgetDecision?.reason,
    contextDish: input.contextDish,
    showRecipeNames,
    hiddenRecipeNames,
    shoppingItemCount: input.shoppingList.length,
    totalSpendLkr: input.totalBudgetSpent,
    budgetLkr: input.budgetLkr,
    placesQuery: input.placesQuery,
    restaurantCount: input.localBusinesses?.length ?? 0,
    instructSummary,
  };
}

function formatCuratedMealSummary(input: SummaryInput): string {
  const lines: string[] = [];
  const brief = buildOrchestratorBrief(input);

  if (brief.headline) lines.push(brief.headline);
  else if (input.recipes.length === 1) {
    lines.push(`For dinner, I suggest **${input.recipes[0].name}**.`);
  } else if (input.recipes.length) {
    lines.push(`Here ${input.recipes.length === 1 ? 'is' : 'are'} ${input.recipes.length} option${input.recipes.length > 1 ? 's' : ''} from your pantry and budget:`);
  }

  // Surface cook-vs-buy split when present in recipe reason
  const buyReadyNote = input.recipes
    .map((r) => r.reasonForSelection)
    .find((t) => /buy ready:/i.test(t));
  if (buyReadyNote && /buy ready:/i.test(buyReadyNote)) {
    const m = buyReadyNote.match(/buy ready:\s*([^.]+)/i);
    if (m) {
      lines.push(`Cook the curry at home · Buy ready from the shop: ${m[1].trim()}.`);
    }
  }

  if (input.planCuration?.weatherContext) {
    lines.push(`${input.planCuration.mealPeriod} · ${input.planCuration.weatherContext}`);
  }

  lines.push('');
  input.recipes.slice(0, 3).forEach((r) => lines.push(...formatRecipeDetail(r)));

  if (input.shoppingList.length) {
    lines.push('');
    lines.push('To buy:');
    input.shoppingList.forEach((s) => {
      lines.push(`• ${s.item} — ${s.store}, LKR ${s.totalPrice}`);
    });
    lines.push('');
    lines.push(
      `Total: LKR ${input.totalBudgetSpent} of LKR ${input.budgetLkr} budget${input.totalBudgetSpent <= input.budgetLkr ? ' — within budget.' : '.'}`
    );
  } else {
    const home = homeItemsUsed(input.recipes);
    if (home.length) {
      lines.push('');
      lines.push(`You have everything at home (${home.join(', ')}).`);
    }
  }

  if (brief.hiddenRecipeNames.length) {
    lines.push('');
    lines.push(`Not shown: ${brief.hiddenRecipeNames.join(', ')} — skipped (budget, weather, or not Sri Lankan family-friendly).`);
  }

  const home = homeItemsUsed(input.recipes);
  if (input.relevantPantry?.length) {
    lines.push('');
    lines.push(
      home.length
        ? `Using from your pantry: ${home.join(', ')}.`
        : `Pantry matches for this request: ${input.relevantPantry
            .slice(0, 6)
            .map((i) => i.item)
            .join(', ')}.`
    );
  }

  if (input.weather) {
    lines.push('');
    lines.push(`Weather: ${input.weather.condition}, ${input.weather.temperature}°C.`);
  }

  return withNextSteps(lines.join('\n'), input);
}

function formatWeatherAnswer(weather: WeatherCondition, alerts?: SpoilageAlert[]): string {
  const loc = weather.location || 'Colombo';
  const sourceLabel =
    weather.source === 'openweather' ? 'OpenWeatherMap' : weather.source === 'fallback' ? 'offline estimate' : 'placeholder';
  const lines: string[] = [
    `Current weather in ${loc}: ${weather.condition}, ${weather.temperature}°C${weather.rainMm ? `, ${weather.rainMm}mm rain recently` : ''} (via ${sourceLabel}).`,
  ];

  if (weather.forecast?.length) {
    lines.push('');
    lines.push('Short forecast:');
    weather.forecast.slice(0, 3).forEach((f) => {
      lines.push(`• ${f.date}: ${f.condition}${f.rainMm ? `, ~${f.rainMm}mm rain` : ''}`);
    });
  }

  const urgent = (alerts ?? []).filter((a) => a.weatherExpiryDays <= 4).slice(0, 3);
  if (urgent.length && (weather.condition === 'monsoon' || weather.spoilageModifier < 0.85)) {
    lines.push('');
    lines.push('Grocery spoilage tips for this weather:');
    urgent.forEach((a) => lines.push(`• ${a.warning} — ${a.buyRecommendation}`));
  } else if (weather.condition === 'monsoon' || weather.rainMm > 5) {
    lines.push('');
    lines.push('Monsoon/rainy conditions shorten shelf life for tomatoes, leafy greens, and fish — buy smaller quantities.');
  }

  return lines.join('\n');
}

function formatCrisisAnswer(crisis: CrisisAlert): string {
  if (crisis.source === 'unconfigured') {
    return 'Live news is not configured — add NEWS_API_KEY in .env to check flood, storm, and strike headlines.';
  }

  if (crisis.type === 'none') {
    const lines = [crisis.warningText || 'No active flood, storm, or strike alerts in recent Sri Lanka headlines.'];
    if (crisis.newsHeadlines?.length) {
      lines.push('');
      lines.push('Recent headlines checked:');
      crisis.newsHeadlines.slice(0, 4).forEach((h) => lines.push(`• ${h}`));
    }
    return lines.join('\n');
  }

  const lines = [
    `${crisis.type.toUpperCase()} alert (${crisis.severity} severity): ${crisis.warningText}`,
    `Affected areas: ${crisis.affectedAreas.join(', ')} (expected ~${crisis.expectedDurationDays} day(s)).`,
  ];

  if (crisis.shoppingRecommendation) {
    lines.push(`Action: ${crisis.shoppingRecommendation.action} (${crisis.shoppingRecommendation.urgency}).`);
    lines.push(`Consider stocking: ${crisis.shoppingRecommendation.items.join(', ')}.`);
  }

  if (crisis.newsHeadlines?.length) {
    lines.push('');
    lines.push('Headlines:');
    crisis.newsHeadlines.slice(0, 4).forEach((h) => lines.push(`• ${h}`));
  }

  return lines.join('\n');
}

function appendEnvironmentContext(lines: string[], input: SummaryInput): void {
  if (input.isCrisisQuestion && input.crisis) {
    lines.push('');
    lines.push(formatCrisisAnswer(input.crisis));
  }
  if (input.isWeatherQuestion && input.weather && !input.isEnvironmentOnly) {
    lines.push('');
    lines.push(formatWeatherAnswer(input.weather, input.spoilageAlerts));
  }
}

function homeItemsUsed(recipes: Recipe[]): string[] {
  const names = new Set<string>();
  for (const r of recipes) {
    for (const ing of r.ingredients.filter((i) => i.source === 'inventory')) {
      names.add(ing.name);
    }
  }
  return [...names];
}

function formatRecipeLine(r: Recipe, index: number): string {
  const home = r.ingredients.filter((i) => i.source === 'inventory').map((i) => i.name);
  const tags = r.dietaryTags.length ? ` (${r.dietaryTags.slice(0, 2).join(', ')})` : '';
  const homeNote = home.length ? ` — uses ${home.slice(0, 3).join(', ')} from home` : '';
  return `${index + 1}. ${r.name}${tags}${homeNote}. ${r.assignedCook} can cook this in ~${r.prepTimeMin + r.cookTimeMin} min.`;
}

function formatRecipeDetail(r: Recipe): string[] {
  const home = r.ingredients.filter((i) => i.source === 'inventory');
  const shop = r.ingredients.filter((i) => i.source === 'shopping');
  const lines = [`**${r.name}** (~${r.prepTimeMin + r.cookTimeMin} min, ${r.assignedCook})`];
  if (home.length) lines.push(`  From home: ${home.map((i) => `${i.name} (${i.amount}${i.unit})`).join(', ')}`);
  if (shop.length) lines.push(`  Need to buy: ${shop.map((i) => `${i.name} (${i.amount}${i.unit})`).join(', ')}`);
  return lines;
}

export function buildSummaryTemplate(input: SummaryInput): string {
  const {
    prompt,
    scenario,
    recipes,
    shoppingList,
    totalBudgetSpent,
    budgetLkr,
    inventorySavings,
    savingsVsSingleStore,
    inventory,
    dietaryVerdict,
    isOrderFollowUp,
    isFoodDeliveryRequest,
    isPriceLookup,
    relevantPantry,
    isMealRoutinePlan,
    mealRoutineMeta,
    planComparisonMeta,
  } = input;

  const lines: string[] = [];
  const underBudget = totalBudgetSpent <= budgetLkr;
  const mealNames = recipes.map((r) => r.name).join(', ');
  const priceRows = input.prices ?? [];

  if (input.isEnvironmentOnly) {
    const parts: string[] = [];
    if (input.isWeatherQuestion && input.weather) parts.push(formatWeatherAnswer(input.weather, input.spoilageAlerts));
    if (input.isCrisisQuestion && input.crisis) parts.push(formatCrisisAnswer(input.crisis));
    if (parts.length) return parts.join('\n\n');
  }

  if (input.isDineOutRequest) {
    const dish = input.contextDish || input.recipes[0]?.name || 'tonight';
    const dineLines: string[] = [];
    dineLines.push(`**Order ${dish} nearby**`);
    dineLines.push('');
    if (input.localBusinesses?.length) {
      dineLines.push(
        input.budgetDecision?.reason ||
          `Nearby spots from Google Maps (${input.placesQuery || 'local search'}):`
      );
      dineLines.push('');
      input.localBusinesses.slice(0, 6).forEach((p) => {
        const price =
          p.priceLabel ||
          (p.priceMinLkr && p.priceMaxLkr
            ? `Rs ${p.priceMinLkr.toLocaleString()}–${p.priceMaxLkr.toLocaleString()}`
            : 'see Maps for prices');
        const rating = p.rating ? ` ★ ${p.rating}` : '';
        dineLines.push(`• ${p.name}${rating} — ${price}`);
        if (p.openState) dineLines.push(`  ${p.openState}`);
      });
    } else {
      dineLines.push(`Try PickMe Food or Uber Eats for ${dish}. Maps search returned no results${input.placesQuery ? ` for "${input.placesQuery}"` : ''}.`);
    }
    if (input.weather) {
      dineLines.push('');
      dineLines.push(`Weather: ${input.weather.condition}, ${input.weather.temperature}°C.`);
    }
    return withNextSteps(dineLines.join('\n'), input);
  }

  if (
    input.outputMode === 'meal_plan' &&
    input.recipes.length &&
    (input.planCuration || input.shoppingList.length)
  ) {
    return formatCuratedMealSummary(input);
  }

  if (input.outputMode === 'grocery_order' && input.shoppingList.length && input.recipes.length) {
    return formatCuratedMealSummary(input);
  }

  if (input.budgetDecision && input.budgetDecision.recommendation !== 'cook_at_home') {
    return withNextSteps(
      formatBudgetDecisionSummary(
        input.budgetDecision,
        recipes,
        input.localBusinesses,
        input.planCuration
      ).replace(/\*\*/g, ''),
      input
    );
  }

  if (planComparisonMeta && shoppingList.length) {
    return withNextSteps(formatComparisonSummary(planComparisonMeta, shoppingList).replace(/\*\*/g, ''), input);
  }

  if (input.localBusinesses?.length && !input.budgetDecision) {
    const placeLines: string[] = [];
    placeLines.push(`Nearby places from Google Maps (${input.placesQuery || 'local search'}):`);
    placeLines.push('');
    input.localBusinesses.slice(0, 6).forEach((p) => {
      const price =
        p.priceLabel ||
        (p.priceMinLkr && p.priceMaxLkr
          ? `LKR ${p.priceMinLkr.toLocaleString()}–${p.priceMaxLkr.toLocaleString()}`
          : 'price not listed');
      const rating = p.rating ? ` ★ ${p.rating}` : '';
      placeLines.push(`• ${p.name}${rating} — ${price}${p.category ? ` (${p.category})` : ''}`);
      if (p.openState) placeLines.push(`  ${p.openState}`);
    });
    placeLines.push('');
    if (shoppingList.length || totalBudgetSpent > 0) {
      placeLines.push(
        `Cooking at home from stores is about LKR ${totalBudgetSpent} for missing ingredients — compare with dine-out ranges above.`
      );
    } else {
      placeLines.push('Open Google Maps links in the artifact for directions, menus, and delivery options.');
    }
    return withNextSteps(placeLines.join('\n'), input);
  }

  if (isMealRoutinePlan && mealRoutineMeta && shoppingList.length) {
    return '';
  }

  if (isPriceLookup && priceRows.length) {
    lines.push(`Here are the store prices I found:`);
    lines.push('');
    priceRows.forEach((p) => {
      lines.push(`• ${p.itemName} — Keells LKR ${p.keellsPrice}, Cargills LKR ${p.cargillsPrice}, Pola LKR ${p.polaPrice} (${p.unit})`);
    });
    lines.push('');
    lines.push(`See Price Catalog sources at the bottom to verify.`);
  } else if (isFoodDeliveryRequest) {
    lines.push(`PlanGro compares grocery stores — we don't have live restaurant or delivery prices.`);
    lines.push('');
    if (recipes.length) {
      lines.push(`You were planning: ${mealNames}.`);
      lines.push(`Cooking at home from stores is about LKR ${totalBudgetSpent} for missing ingredients (see Price Catalog sources).`);
    }
    lines.push('');
    lines.push(`Try PickMe Food or Uber Eats directly for delivery quotes.`);
  } else if (isOrderFollowUp && recipes.length) {
    lines.push(`Your grocery order for **${mealNames}** is ready.`);
    lines.push('');
    if (shoppingList.length) {
      lines.push('Items to buy:');
      shoppingList.forEach((s) => {
        lines.push(`• ${s.item} — ${s.store}, LKR ${s.totalPrice}`);
      });
      lines.push('');
    } else {
      lines.push('You already have everything at home — no extra shopping needed!');
      lines.push('');
    }
  } else if (scenario === 'decided_menu' && recipes.length) {
    lines.push(`Here is your plan:`);
    lines.push('');
    recipes.slice(0, 2).forEach((r) => lines.push(...formatRecipeDetail(r)));
  } else if (scenario === 'needs_suggestions' && recipes.length) {
    lines.push(`Here are ${recipes.length} meal idea${recipes.length > 1 ? 's' : ''} based on your request:`);
    lines.push('');
    recipes.slice(0, 3).forEach((r) => lines.push(...formatRecipeDetail(r)));
  } else if (scenario === 'shopping_trip') {
    lines.push(`Here is your shopping comparison:`);
    if (shoppingList.length) {
      lines.push('');
      shoppingList.slice(0, 6).forEach((s) => {
        lines.push(`• ${s.item} — best at ${s.store}, LKR ${s.totalPrice}`);
      });
    }
  } else if (recipes.length) {
    lines.push(`Here is what I put together for you:`);
    lines.push('');
    recipes.slice(0, 3).forEach((r, i) => lines.push(formatRecipeLine(r, i)));
  } else {
    lines.push(`I could not compile a full plan for "${prompt.slice(0, 80)}${prompt.length > 80 ? '…' : ''}". Try rephrasing.`);
  }

  lines.push('');

  if (shoppingList.length || totalBudgetSpent > 0) {
    lines.push(
      `Estimated spend: LKR ${totalBudgetSpent} of your LKR ${budgetLkr} budget${underBudget ? ' — within budget.' : ' — consider trimming the list.'}`
    );
  }

  const home = homeItemsUsed(recipes);
  if (relevantPantry?.length && !home.length) {
    lines.push(`Pantry items that match your request: ${relevantPantry.map((i) => i.item).join(', ')}.`);
  }
  if (home.length) {
    lines.push(`From your pantry: ${home.join(', ')} (saves ~LKR ${inventorySavings}).`);
  } else if (inventory.length && /inventory|pantry|home/i.test(prompt)) {
    lines.push(`Your pantry has ${inventory.length} tracked items.`);
  }

  if (savingsVsSingleStore > 0) {
    lines.push(`Store comparison saves ~LKR ${savingsVsSingleStore} vs buying everything at one supermarket.`);
  }

  if (dietaryVerdict?.warnings.length) {
    lines.push(`Dietary note: ${dietaryVerdict.warnings.slice(0, 2).join('; ')}.`);
  }

  appendEnvironmentContext(lines, input);

  return withNextSteps(lines.join('\n'), input);
}

function weatherNote(input: SummaryInput): string {
  return input.mealRoutineMeta?.hasFridge === false ? 'No fridge — buy perishable items in small batches.' : '';
}

function formatRoutineSummaryBlock(
  meta: MealRoutineMeta,
  shoppingList: ShoppingListItem[],
  total: number,
  budget: number,
  extra?: string
): string {
  const lines: string[] = [];
  lines.push(`${meta.mealName} — ${meta.daysPlanned}-day plan`);
  lines.push('');
  lines.push(`Estimated total: LKR ${total} (~LKR ${Math.round(total / meta.daysPlanned)}/day)${total <= budget ? ` — within your LKR ${budget} budget.` : ` — over your LKR ${budget} budget; trim tuna or buy smaller loaves.`}`);
  lines.push('');
  lines.push('What to buy:');
  shoppingList.forEach((s) => {
    lines.push(`• ${s.item} — ${s.requiredQty} ${s.unit}, ${s.store}, LKR ${s.totalPrice}`);
  });
  lines.push('');
  lines.push('Shopping schedule:');
  meta.shoppingTrips.forEach((t) => {
    lines.push(`• ${t.when}: ${t.items}`);
  });
  lines.push('');
  lines.push('Tips:');
  meta.tips.slice(0, 4).forEach((t) => lines.push(`• ${t}`));
  if (extra) lines.push(`• ${extra}`);
  return lines.join('\n');
}

function shouldUseTemplateOnly(input: SummaryInput): boolean {
  if (input.isEnvironmentOnly) return true;
  if (input.isDineOutRequest) return true;
  if (input.outputMode === 'grocery_order' && input.shoppingList.length) return true;
  if (input.outputMode === 'meal_plan' && input.recipes.length && (input.planCuration || input.shoppingList.length)) {
    return true;
  }
  if (input.budgetDecision && input.budgetDecision.recommendation !== 'cook_at_home') return true;
  if (input.localBusinesses?.length && input.budgetDecision?.recommendation === 'order_out') return true;
  if (input.planComparisonMeta && input.shoppingList.length) return true;
  if (input.isMealRoutinePlan && input.mealRoutineMeta && input.shoppingList.length) return true;
  if (input.isPriceLookup && (input.prices?.length ?? 0) > 0) return true;
  if (input.isOrderFollowUp && input.shoppingList.length) return true;
  if (input.scenario === 'shopping_trip' && (input.prices?.length ?? 0) > 0) return true;
  if (input.scenario === 'decided_menu' && input.shoppingList.length && input.recipes.some((r) => r.id === 'routine_sandwich')) {
    return true;
  }
  return false;
}

export async function buildOrchestratorSummary(input: SummaryInput): Promise<string> {
  const template = buildSummaryTemplate(input);
  if (shouldUseTemplateOnly(input)) {
    planLog('summary', 'Using template summary (skipped Gemini)');
    return withNextSteps(template.replace(/\*\*/g, ''), input);
  }

  planLog('summary', 'Calling Gemini for narrative summary…');
  const historyBlock = input.conversationHistory?.length
    ? `\nConversation:\n${input.conversationHistory.slice(-6).map((m) => `${m.role}: ${m.text}`).join('\n')}`
    : '';

  const brief = buildOrchestratorBrief(input);
  const placesBlock = input.localBusinesses?.length
    ? JSON.stringify(
        input.localBusinesses.slice(0, 6).map((p) => ({
          name: p.name,
          priceLabel: p.priceLabel,
          priceMinLkr: p.priceMinLkr,
          priceMaxLkr: p.priceMaxLkr,
          rating: p.rating,
          openState: p.openState,
        }))
      )
    : '[]';

  const nextChoices = nextStepChoices(input);
  const ai = await geminiText(
    `Latest user message: "${input.prompt}"${historyBlock}

ORCHESTRATOR DECISION (authoritative — follow this over conflicting recipe data):
${JSON.stringify(brief, null, 0)}

Scenario: ${input.scenario}
Output mode: ${input.outputMode ?? 'meal_plan'}
Meal mode: ${input.mealMode ?? 'none'}
Is order follow-up (shop same meal): ${input.isOrderFollowUp}
Is dine-out / order prepared food: ${input.isDineOutRequest}
Context dish: ${input.contextDish ?? 'none'}

Recipes to discuss (ONLY these): ${JSON.stringify(input.recipes.map((r) => ({ name: r.name, homeIngredients: r.ingredients.filter((i) => i.source === 'inventory').map((i) => ({ name: i.name, amount: i.amount, unit: i.unit })), shopIngredients: r.ingredients.filter((i) => i.source === 'shopping').map((i) => ({ name: i.name, amount: i.amount, unit: i.unit })) })))}
Hidden recipes (do NOT recommend): ${JSON.stringify(brief.hiddenRecipeNames)}
Relevant pantry: ${JSON.stringify((input.relevantPantry ?? []).map((i) => i.item))}
Shopping list: ${JSON.stringify(input.shoppingList.map((s) => ({ item: s.item, store: s.store, price: s.totalPrice })))}
localBusinesses (use these names when dine-out): ${placesBlock}
Places search query: ${input.placesQuery ?? 'none'}
Budget decision: ${JSON.stringify(input.budgetDecision ?? null)}
Plan curation: ${JSON.stringify(input.planCuration ?? null)}
Price catalog: ${JSON.stringify((input.prices ?? []).slice(0, 8).map((p) => ({ item: p.itemName, keells: p.keellsPrice, cargills: p.cargillsPrice, pola: p.polaPrice, unit: p.unit })))}
Live weather: ${JSON.stringify(input.weather ?? null)}
Budget spent/allowed: ${input.totalBudgetSpent}/${input.budgetLkr}`,
    `You are Plango, a Sri Lankan family grocery assistant. Reply directly to the user.

CRITICAL — ORCHESTRATOR DECISION JSON overrides everything else:
- Follow instructSummary in ORCHESTRATOR DECISION exactly.
- If output mode is dine_out: recommend restaurants from localBusinesses ONLY. Never say you cannot recommend restaurants when localBusinesses is non-empty. No grocery list.
- If hidden recipes exist: mention ONLY showRecipeNames. One optional line that others were skipped.
- Sri Lankan family meals only — never push Chinese/Japanese/exotic dishes if not in showRecipeNames.
- Quote LKR prices from shopping list when discussing cooking.
- Weave weather and dietary notes when relevant. Under 180 words. No agent/pipeline jargon.
- Always end with exactly: "Next steps: ${nextChoices.length ? nextChoices.join(' · ') : 'Suggest something else · Change budget'}".`
  );

  const text = ai?.trim();
  if (!text || text.length < 40) {
    planLog('summary', 'Gemini response too short — using template fallback');
    return withNextSteps(template.replace(/\*\*/g, ''), input);
  }
  planLog('summary', `Gemini summary OK (${text.length} chars)`);
  return withNextSteps(text, input);
}
