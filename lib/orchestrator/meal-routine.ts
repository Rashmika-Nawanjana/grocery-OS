import type { AgentContext, MealRoutineMeta, PlanComparisonMeta, Recipe, ShoppingListItem, StorePrice, WeatherCondition } from '@/lib/types';

export type { MealRoutineMeta };

export type SandwichFillingVariant = 'full' | 'jam-only' | 'peanut-only' | 'tuna-only';

export function detectSandwichFillingVariant(prompt: string): SandwichFillingVariant {
  const lower = prompt.toLowerCase();
  if (/\b(jam\s*only|only\s+jam|just\s+jam|use\s+jam\s+only)\b/i.test(lower)) return 'jam-only';
  if (/\b(peanut\s*(butter\s*)?only|only\s+peanut)\b/i.test(lower)) return 'peanut-only';
  if (/\b(tuna\s*only|only\s+tuna|just\s+tuna)\b/i.test(lower)) return 'tuna-only';
  return 'full';
}

export function isRoutineComparisonFollowUp(
  prompt: string,
  opts?: { isFollowUp?: boolean; previousRecipes?: Recipe[]; hadMealRoutine?: boolean }
): boolean {
  const variant = detectSandwichFillingVariant(prompt);
  const hadRoutine =
    opts?.hadMealRoutine ||
    opts?.previousRecipes?.some((r) => r.id === 'routine_sandwich') ||
    false;
  if (!opts?.isFollowUp && variant === 'full') return false;
  if (variant !== 'full' && (opts?.isFollowUp || hadRoutine)) return true;
  if (
    opts?.isFollowUp &&
    hadRoutine &&
    /\b(save|saving|cheaper|compare|instead|if i|versus|vs\.?)\b/i.test(prompt.toLowerCase())
  ) {
    return true;
  }
  return false;
}

export function isMealRoutinePlanRequest(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const recurring =
    /\b(every\s+(morning|day|weekday|night)|daily|each\s+morning|from\s+tomorrow|how\s+(much|often|frequently)|how\s+long)\b/i.test(
      lower
    );
  const planning = /\b(planning|plan\s+to\s+eat|going\s+to\s+eat|want\s+to\s+eat|need\s+to\s+buy)\b/i.test(lower);
  const storage =
    /\b(no\s+fridge|without\s+(a\s+)?fridge|don't\s+have\s+a\s+fridge|dont\s+have\s+a\s+fridge|no\s+refrigeration)\b/i.test(
      lower
    );
  const routineMeal = /\b(sandwich|sandwiches|breakfast|same\s+meal)\b/i.test(lower);
  return (
    (recurring && (planning || routineMeal)) ||
    (storage && routineMeal && (recurring || planning || /\b(buy|shopping|stuff|weather)\b/i.test(lower)))
  );
}

export function hasNoFridge(prompt: string): boolean {
  return /\b(no\s+fridge|without\s+(a\s+)?fridge|don't\s+have\s+a\s+fridge|dont\s+have\s+a\s+fridge|no\s+refrigeration)\b/i.test(
    prompt
  );
}

export function extractRoutineDays(prompt: string, fallback = 7): number {
  const week = prompt.match(/\b(\d+)\s*weeks?\b/i);
  if (week) return Math.min(30, parseInt(week[1], 10) * 7);
  const days = prompt.match(/\b(\d+)\s*days?\b/i);
  if (days) return Math.min(30, parseInt(days[1], 10));
  return fallback;
}

export function routineCatalogItems(prompt: string, variant?: SandwichFillingVariant): string[] {
  const v = variant ?? detectSandwichFillingVariant(prompt);
  if (/\bsandwich/i.test(prompt) || v !== 'full') {
    const items = ['bread'];
    if (v === 'full' || v === 'peanut-only') items.push('peanut butter');
    if (v === 'full' || v === 'jam-only') items.push('jam');
    if (v === 'full' || v === 'tuna-only') items.push('canned tuna');
    return items;
  }
  return ['bread', 'eggs', 'butter'];
}

export function buildSandwichRoutineRecipe(
  ctx: AgentContext,
  days: number,
  variant: SandwichFillingVariant = 'full'
): Recipe {
  const noFridge = hasNoFridge(ctx.prompt);
  const loavesNeeded = noFridge ? days : Math.ceil(days / 4);
  const peanutJars = Math.max(1, Math.ceil(days / 21));
  const jamJars = Math.max(1, Math.ceil(days / 14));
  const tunaCans = noFridge ? days : Math.ceil(days / 3);

  const ing = (
    name: string,
    amount: number,
    unit: string,
    pantryKey: string
  ): { name: string; amount: number; unit: string; source: 'inventory' | 'shopping' } => {
    const has = ctx.inventory.some((i) => i.item.toLowerCase().includes(pantryKey));
    return { name, amount, unit, source: has ? 'inventory' : 'shopping' };
  };

  const fillings: { name: string; amount: number; unit: string; source: 'inventory' | 'shopping' }[] = [];
  if (variant === 'full' || variant === 'peanut-only') {
    fillings.push(ing('Peanut Butter', peanutJars, 'pcs', 'peanut'));
  }
  if (variant === 'full' || variant === 'jam-only') {
    fillings.push(ing('Jam', jamJars, 'pcs', 'jam'));
  }
  if ((variant === 'full' || variant === 'tuna-only') && tunaCans > 0) {
    fillings.push(ing('Canned Tuna', variant === 'tuna-only' ? tunaCans : tunaCans, 'pcs', 'tuna'));
  }

  const variantLabel =
    variant === 'jam-only'
      ? 'Jam'
      : variant === 'peanut-only'
        ? 'Peanut Butter'
        : variant === 'tuna-only'
          ? 'Tuna'
          : 'Mixed Fillings';

  return {
    id: 'routine_sandwich',
    name: `Daily ${variantLabel} Sandwiches (${days} days)`,
    ingredients: [
      ing('Bread Loaf', loavesNeeded, 'pcs', 'bread'),
      ...fillings,
    ],
    instructions: [
      'Buy bread in small batches — use within 1–2 days without a fridge.',
      'Rotate fillings: peanut butter, jam, or one opened tuna can per day (finish same day).',
      'Store jars in a cool dry cupboard; wipe lids clean after each use.',
      'Prep sandwiches in the morning; avoid pre-making the night before in humid weather.',
    ],
    prepTimeMin: 5,
    cookTimeMin: 0,
    assignedCook: ctx.family[0]?.name || 'You',
    reasonForSelection:
      variant === 'jam-only'
        ? 'Jam-only sandwich routine — lower cost, no peanut butter or tuna needed.'
        : variant === 'peanut-only'
          ? 'Peanut butter-only sandwich routine.'
          : noFridge
            ? 'Shelf-stable sandwich plan for tropical weather without refrigeration.'
            : 'Weekly sandwich breakfast plan with weather-aware bread buying.',
    dietaryTags: ['Quick breakfast', 'No-cook'],
    nutritionalInfo: { calories: 320, protein: '12g', sugar: '8g', fat: '14g' },
  };
}

export function buildRoutineMeta(
  prompt: string,
  days: number,
  weather: WeatherCondition,
  shoppingList: ShoppingListItem[],
  prices: StorePrice[]
): MealRoutineMeta {
  const noFridge = hasNoFridge(prompt);
  const hot = weather.condition === 'monsoon' || weather.condition === 'humid' || weather.temperature >= 28;
  const breadDays = noFridge ? (hot ? 1 : 2) : 4;
  const breadTrips = Math.ceil(days / breadDays);

  const lineCost = (name: string) => shoppingList.find((s) => s.item.toLowerCase().includes(name.toLowerCase()))?.totalPrice ?? 0;
  const priceOf = (name: string) => {
    const row = prices.find((p) => p.itemName.toLowerCase().includes(name.toLowerCase()));
    return row ? Math.min(row.keellsPrice, row.cargillsPrice, row.polaPrice) : null;
  };

  const weeklyCost = shoppingList.reduce((s, i) => s + i.totalPrice, 0);

  const trips: MealRoutineMeta['shoppingTrips'] = [];

  for (let t = 0; t < breadTrips; t++) {
    const dayLabel = t === 0 ? 'Tomorrow (Day 1)' : `Every ${breadDays} day${breadDays > 1 ? 's' : ''} — trip ${t + 1}`;
    const breadPrice = priceOf('bread');
    trips.push({
      when: dayLabel,
      items: `${Math.min(breadDays, days - t * breadDays)} loaf(es) bread`,
      reason: noFridge
        ? `Bread stales fast at ${weather.temperature}°C${hot ? ' + humidity' : ''} — buy only what you eat in ${breadDays} day(s).`
        : 'Fresh bread for the next few days.',
    });
    void breadPrice;
  }

  trips.push({
    when: 'Once this week (shelf-stable stock)',
    items: 'Peanut butter, jam' + (noFridge ? ', small tuna cans (1 per use)' : ', tuna cans'),
    reason: 'Jars and unopened cans keep weeks in a cupboard — one weekly stock-up saves trips.',
  });

  const tips = [
    noFridge
      ? 'Skip butter, cheese, and mayo — they need refrigeration once opened.'
      : 'Butter and cheese are OK if you can chill them; otherwise stick to peanut butter and jam.',
    hot
      ? `In ${weather.condition} weather, buy bread daily or every ${breadDays} days max.`
      : 'Bread keeps ~2 days on the counter; 4 days if cooler.',
    `Budget about LKR ${Math.round(weeklyCost / days)} per sandwich day (${days}-day plan).`,
    'Alternate fillings so you do not rely on one item all week.',
  ];

  if (lineCost('tuna') > 0 && noFridge) {
    tips.push('Open one tuna can per sandwich day only — finish within a few hours.');
  }

  return {
    mealName: 'Daily breakfast sandwiches',
    daysPlanned: days,
    hasFridge: !noFridge,
    shoppingTrips: trips,
    weeklyCostEstimateLkr: weeklyCost,
    tips,
  };
}

export function buildPlanComparisonMeta(
  variant: SandwichFillingVariant,
  previousTotal: number,
  newTotal: number,
  days: number
): PlanComparisonMeta {
  const variantLabel =
    variant === 'jam-only'
      ? 'Jam only'
      : variant === 'peanut-only'
        ? 'Peanut butter only'
        : variant === 'tuna-only'
          ? 'Tuna only'
          : 'Alternative';
  return {
    variantLabel,
    previousTotalLkr: previousTotal,
    newTotalLkr: newTotal,
    savingsLkr: Math.max(0, previousTotal - newTotal),
    daysPlanned: days,
    previousLabel: 'Full fillings (peanut butter, jam, tuna)',
  };
}

export function formatComparisonSummary(meta: PlanComparisonMeta, shoppingList: ShoppingListItem[]): string {
  const lines: string[] = [];
  lines.push(`**${meta.variantLabel} vs ${meta.previousLabel}** (${meta.daysPlanned}-day plan)`);
  lines.push('');
  if (meta.savingsLkr > 0) {
    lines.push(
      `Switching to **${meta.variantLabel.toLowerCase()}** saves about **LKR ${meta.savingsLkr}** over ${meta.daysPlanned} days (LKR ${meta.previousTotalLkr} → LKR ${meta.newTotalLkr}).`
    );
    lines.push(`That is roughly **LKR ${Math.round(meta.savingsLkr / meta.daysPlanned)}/day** less.`);
  } else {
    lines.push(
      `**${meta.variantLabel}** costs about the same or slightly more (LKR ${meta.newTotalLkr} vs LKR ${meta.previousTotalLkr}).`
    );
  }
  lines.push('');
  lines.push('**What to buy:**');
  shoppingList.forEach((s) => {
    lines.push(`• ${s.item} — ${s.requiredQty} ${s.unit}, ${s.store}, LKR ${s.totalPrice}`);
  });
  return lines.join('\n');
}

export function formatRoutineSummary(meta: MealRoutineMeta, shoppingList: ShoppingListItem[]): string {
  const lines: string[] = [];
  lines.push(`**${meta.mealName} — ${meta.daysPlanned}-day plan**`);
  lines.push('');
  lines.push(`Estimated total: **LKR ${meta.weeklyCostEstimateLkr}** for ${meta.daysPlanned} days (~LKR ${Math.round(meta.weeklyCostEstimateLkr / meta.daysPlanned)}/day).`);
  lines.push('');
  lines.push('**What to buy:**');
  shoppingList.forEach((s) => {
    lines.push(`• ${s.item} — ${s.requiredQty} ${s.unit}, best at ${s.store}, LKR ${s.totalPrice}`);
  });
  lines.push('');
  lines.push('**Shopping schedule:**');
  meta.shoppingTrips.forEach((t) => {
    lines.push(`• ${t.when}: ${t.items} — ${t.reason}`);
  });
  lines.push('');
  lines.push('**Tips:**');
  meta.tips.forEach((t) => lines.push(`• ${t}`));
  return lines.join('\n');
}
