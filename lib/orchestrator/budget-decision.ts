import type { LocalBusiness, Recipe, ShoppingListItem, UserScenario, BudgetDecisionMeta, PlanCurationMeta } from '@/lib/types';
import { safeLkr } from '@/lib/services/price-units';

export type BudgetRecommendation = BudgetDecisionMeta['recommendation'];

function isTonightMealPrompt(prompt: string): boolean {
  return /\b(tonight|what do i eat|what should i eat|what to eat|dinner|lunch|breakfast|hungry|meal idea)\b/i.test(
    prompt
  );
}

function isExplicitShoppingIntent(prompt: string): boolean {
  return /\b(shopping trip|grocery list|buy groceries|shop for|stock up|weekly shop)\b/i.test(prompt);
}

function homeIngredientCount(recipes: Recipe[]): number {
  return recipes.reduce((n, r) => n + r.ingredients.filter((i) => i.source === 'inventory').length, 0);
}

export function evaluateBudgetDecision(input: {
  prompt: string;
  scenario: UserScenario;
  budgetLkr: number;
  groceryTotalLkr: number;
  shoppingList: ShoppingListItem[];
  recipes: Recipe[];
  isMealRoutine: boolean;
  planCuration?: PlanCurationMeta;
}): BudgetDecisionMeta {
  const budget = Math.max(1, safeLkr(input.budgetLkr, 5000));
  const bestRank = input.planCuration?.recipeRankings[0];
  const grocery = safeLkr(
    input.shoppingList.length > 0 ? input.groceryTotalLkr : (bestRank?.shopCostLkr ?? input.groceryTotalLkr)
  );
  const overBy = Math.max(0, grocery - budget);
  const ratio = grocery / budget;
  const homeItems = homeIngredientCount(input.recipes);
  const shopItems = input.shoppingList.length;
  const tonight = isTonightMealPrompt(input.prompt);
  const explicitShop = isExplicitShoppingIntent(input.prompt);

  if (grocery <= budget * 1.15 && shopItems > 0) {
    return {
      recommendation: 'cook_at_home',
      headline: 'Cook at home — within budget',
      reason: `Shopping for missing ingredients (LKR ${grocery}) fits your LKR ${budget} budget.`,
      groceryTotalLkr: grocery,
      budgetLkr: budget,
      overByLkr: 0,
      spendRatio: ratio,
      tips: ['Buy at the cheapest store per item in the shopping list.'],
    };
  }

  if (grocery <= budget * 1.5 && shopItems > 0) {
    return {
      recommendation: 'trim_shopping',
      headline: 'Slightly over budget — trim or swap stores',
      reason: `Grocery total LKR ${grocery} is ~${Math.round(ratio * 100)}% of your LKR ${budget} budget.`,
      groceryTotalLkr: grocery,
      budgetLkr: budget,
      overByLkr: overBy,
      spendRatio: ratio,
      tips: [
        'Drop optional spices or buy smallest packs.',
        'Check Pola prices — multi-store routing may save more.',
      ],
    };
  }

  // Grocery far exceeds budget for a single meal
  if (
    ratio >= 2 &&
    shopItems >= 3 &&
    tonight &&
    !input.isMealRoutine &&
    !explicitShop
  ) {
    const mealName = input.recipes[0]?.name || bestRank?.name || 'this meal';
    return {
      recommendation: 'order_out',
      headline: `Order out — grocery (LKR ${grocery.toLocaleString()}) is ${Math.round(ratio)}× your budget`,
      reason: `Buying ingredients for ${mealName} costs LKR ${grocery.toLocaleString()}, but your budget is only LKR ${budget.toLocaleString()}. One restaurant meal is likely cheaper than stocking up for a full curry.`,
      groceryTotalLkr: grocery,
      budgetLkr: budget,
      overByLkr: overBy,
      spendRatio: ratio,
      tips: [
        `You already have ${homeItems} item(s) at home — not worth a LKR ${grocery.toLocaleString()} shop run tonight.`,
        'Check nearby restaurants below — many lunch/dinner spots fall within your budget per person.',
        'If you still want to cook, ask for a "pantry-only" recipe using what you already have.',
      ],
    };
  }

  if (homeItems >= 2 && shopItems >= 4 && ratio >= 1.5) {
    return {
      recommendation: 'pantry_meal',
      headline: 'Use your pantry — skip the big shop tonight',
      reason: `You have ${homeItems} ingredients at home but would need ${shopItems} more items (LKR ${grocery.toLocaleString()}) — over your LKR ${budget} budget.`,
      groceryTotalLkr: grocery,
      budgetLkr: budget,
      overByLkr: overBy,
      spendRatio: ratio,
      tips: [
        'Ask for a simpler dish using only home inventory.',
        'Or order out if you want something ready-made within budget.',
      ],
    };
  }

  return {
    recommendation: ratio >= 2 ? 'order_out' : 'trim_shopping',
    headline: ratio >= 2 ? 'Over budget — consider ordering out' : 'Over budget — trim your list',
    reason: `Estimated grocery spend LKR ${grocery.toLocaleString()} vs budget LKR ${budget.toLocaleString()}.`,
    groceryTotalLkr: grocery,
    budgetLkr: budget,
    overByLkr: overBy,
    spendRatio: ratio,
    tips: ['Compare dine-out prices with the grocery total before shopping.'],
  };
}

export function shouldAutoFetchPlacesForBudget(
  decision: BudgetDecisionMeta,
  prompt: string,
  isMealRoutine: boolean,
  planCuration?: PlanCurationMeta
): boolean {
  if (isMealRoutine) return false;
  if (isExplicitShoppingIntent(prompt)) return false;
  if (planCuration?.primaryAction === 'order_out') return true;
  return decision.recommendation === 'order_out' || decision.recommendation === 'pantry_meal';
}

export function alignBudgetWithCuration(
  decision: BudgetDecisionMeta,
  curation?: PlanCurationMeta
): BudgetDecisionMeta {
  if (!curation) return decision;

  const best = curation.recipeRankings[0];
  const grocery = decision.groceryTotalLkr || best?.shopCostLkr || 0;
  const contextTip = `${curation.mealPeriod.charAt(0).toUpperCase() + curation.mealPeriod.slice(1)} · Weather: ${curation.weatherContext}`;

  if (curation.primaryAction === 'order_out' && curation.showCount === 0 && best) {
    const ratio = grocery / Math.max(1, decision.budgetLkr);
    return {
      ...decision,
      recommendation: 'order_out',
      headline: `Order out — grocery (LKR ${grocery.toLocaleString()}) is ${Math.round(ratio)}× your budget`,
      reason: `Buying ingredients for ${best.name} costs LKR ${grocery.toLocaleString()}, but your budget is only LKR ${decision.budgetLkr.toLocaleString()}. One restaurant meal is likely cheaper than stocking up for a full shop.`,
      groceryTotalLkr: grocery,
      spendRatio: ratio,
      overByLkr: Math.max(0, grocery - decision.budgetLkr),
      tips: [
        contextTip,
        curation.hiddenCount > 0
          ? `Hid ${curation.hiddenCount} recipe suggestion(s) — not suited for your budget, weather, or time of day.`
          : curation.headline,
        ...decision.tips,
      ].slice(0, 4),
    };
  }

  if (curation.primaryAction === 'order_out' && best) {
    return {
      ...decision,
      recommendation: 'order_out',
      tips: [contextTip, curation.headline, ...decision.tips].slice(0, 4),
    };
  }

  return {
    ...decision,
    tips: [contextTip, curation.headline, ...decision.tips].slice(0, 4),
  };
}

import { extractNamedDishes } from '@/lib/orchestrator/meal-intent';

export function buildMealPlacesPrompt(recipes: Recipe[], prompt: string, homeArea?: string): string {
  const location = homeArea?.trim() || 'Negombo, Sri Lanka';
  const named = extractNamedDishes(prompt);
  if (named.length >= 2) {
    return `${named.join(' ')} restaurants ${location}`;
  }
  if (named.length === 1) {
    if (/kottu/i.test(named[0])) return `kottu roti restaurants ${location}`;
    return `${named[0]} restaurants ${location}`;
  }
  const names = recipes.map((r) => r.name.toLowerCase()).join(' ');
  const text = `${names} ${prompt}`.toLowerCase().replace(/\boder\b/g, 'order');
  if (/kottu|kothu/i.test(text)) return `kottu roti restaurants ${location}`;
  if (/fish|seafood|prawn/i.test(text)) return `rice and curry restaurants ${location}`;
  if (/fried rice|rice/i.test(text)) return `fried rice restaurants ${location}`;
  if (/roti/i.test(text)) return `kottu roti restaurants ${location}`;
  if (/sandwich|breakfast/i.test(text)) return `breakfast restaurants ${location}`;
  if (/biryani/i.test(text)) return `biryani restaurants ${location}`;
  if (/biryani/i.test(text)) return `biryani restaurants ${location}`;
  if (/hoppers|appa/i.test(text)) return `hoppers restaurants ${location}`;
  return `restaurants ${location}`;
}

export function filterAffordablePlaces(places: LocalBusiness[], budgetLkr: number): LocalBusiness[] {
  const budget = safeLkr(budgetLkr);
  const maxAffordable = Math.round(budget * 1.25);
  return places.filter((p) => {
    if (p.priceMinLkr != null && p.priceMinLkr <= maxAffordable) return true;
    if (p.priceMaxLkr != null && p.priceMaxLkr <= maxAffordable) return true;
    if (!p.priceMinLkr && !p.priceMaxLkr && p.priceLabel) {
      const m = p.priceLabel.replace(/,/g, '').match(/(\d+)/);
      if (m && parseInt(m[1], 10) <= maxAffordable) return true;
    }
    return false;
  });
}

export function attachAffordablePlaces(
  decision: BudgetDecisionMeta,
  places: LocalBusiness[],
  options?: { dineOut?: boolean }
): BudgetDecisionMeta {
  const list = options?.dineOut ? places.slice(0, 8) : filterAffordablePlaces(places, decision.budgetLkr);
  if (!list.length) return decision;
  return {
    ...decision,
    affordablePlaces: list.slice(0, 8).map((p) => ({
      name: p.name,
      priceLabel: p.priceLabel,
      priceMinLkr: p.priceMinLkr,
      priceMaxLkr: p.priceMaxLkr,
      mapsUrl: p.mapsUrl,
      rating: p.rating,
    })),
    tips: [
      ...decision.tips,
      options?.dineOut
        ? `${list.length} nearby spot(s) for ${decision.headline.toLowerCase().includes('order') ? 'ordering' : 'dine-out'} — see cards below.`
        : `${list.length} nearby spot(s) may fit your LKR ${decision.budgetLkr} budget — see cards below.`,
    ],
  };
}

export function formatBudgetDecisionSummary(
  decision: BudgetDecisionMeta,
  recipes: Recipe[],
  localBusinesses?: LocalBusiness[],
  planCuration?: PlanCurationMeta
): string {
  const lines: string[] = [];
  lines.push(`**${decision.headline}**`);
  lines.push('');
  lines.push(decision.reason);
  lines.push('');

  if (planCuration?.hiddenCount) {
    lines.push(
      `Showing ${planCuration.showCount} of ${planCuration.showCount + planCuration.hiddenCount} ideas — ${planCuration.mealPeriod}, ${planCuration.weatherContext}.`
    );
    lines.push('');
  }

  if (decision.recommendation === 'order_out') {
    lines.push(`Grocery shopping: LKR ${decision.groceryTotalLkr.toLocaleString()} · Your budget: LKR ${decision.budgetLkr.toLocaleString()}`);
    lines.push('');
    if (decision.affordablePlaces?.length) {
      lines.push('**Within budget nearby:**');
      decision.affordablePlaces.forEach((p) => {
        const price =
          p.priceLabel ||
          (p.priceMinLkr && p.priceMaxLkr
            ? `Rs ${p.priceMinLkr.toLocaleString()}–${p.priceMaxLkr.toLocaleString()}`
            : 'see Maps');
        lines.push(`• ${p.name}${p.rating ? ` ★${p.rating}` : ''} — ${price}`);
      });
      lines.push('');
    } else if (localBusinesses?.length) {
      lines.push('**Nearby restaurants** (check Maps for prices within your budget):');
      localBusinesses.slice(0, 4).forEach((p) => {
        lines.push(`• ${p.name} — ${p.priceLabel || 'price on Maps'}`);
      });
      lines.push('');
    }
    if (recipes.length) {
      const home = recipes[0].ingredients.filter((i) => i.source === 'inventory').map((i) => i.name);
      if (home.length) {
        lines.push(`(You have ${home.join(', ')} at home — not worth a full grocery run tonight.)`);
        lines.push('');
      }
    }
  }

  decision.tips.slice(0, 3).forEach((t) => lines.push(`• ${t}`));
  return lines.join('\n');
}
