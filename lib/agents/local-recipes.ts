import type { AgentContext, Recipe } from '@/lib/types';
import { extractFamilySize, normalizeOrderTypos } from '@/lib/orchestrator/meal-intent';

function assignCook(ctx: AgentContext): string {
  const available = ctx.family.filter((m) => m.schedule.cookingAvailability);
  const sorted = [...available].sort((a, b) => {
    const skill = { high: 3, medium: 2, low: 1 };
    return skill[b.schedule.cookingSkill] - skill[a.schedule.cookingSkill];
  });
  return sorted[0]?.name || 'Family cook';
}

function buildKottuFromPantry(ctx: AgentContext, servings = 2): Recipe {
  const has = (term: string) => ctx.inventory.some((i) => i.item.toLowerCase().includes(term));
  const ing = (name: string, amount: number, unit: string, pantryKey: string) => ({
    name,
    amount,
    unit,
    source: (has(pantryKey) ? 'inventory' : 'shopping') as 'inventory' | 'shopping',
  });

  return {
    id: 'local_kottu',
    name: 'Chicken Kottu',
    ingredients: [
      ing('Kottu Roti', 400, 'g', 'kottu'),
      ing('Chicken', 200, 'g', 'chicken'),
      ing('Onion', 1, 'pcs', 'onion'),
      ing('Green Chilli', 2, 'pcs', 'chilli'),
      ing('Curry Powder', 1, 'tsp', 'curry'),
      ing('Eggs', 2, 'pcs', 'egg'),
      ing('Coconut Oil', 2, 'tbsp', 'oil'),
      ing('Carrots', 1, 'pcs', 'carrot'),
    ],
    instructions: [
      'Shred kottu roti into strips.',
      'Stir-fry chicken, onion, and carrot with curry powder.',
      'Add roti strips and scramble eggs through on high heat.',
      `Serve hot for ${servings} — classic street-style kottu.`,
    ],
    prepTimeMin: 10,
    cookTimeMin: 20,
    assignedCook: assignCook(ctx),
    reasonForSelection: 'Sri Lankan kottu using home roti and pantry staples.',
    dietaryTags: ['Sri Lankan', 'Street food'],
    nutritionalInfo: { calories: 520, protein: '28g', sugar: '4g', fat: '18g' },
  };
}

function buildChickenCurryFromPantry(ctx: AgentContext, servings = 4): Recipe {
  const has = (term: string) => ctx.inventory.some((i) => i.item.toLowerCase().includes(term));
  const ing = (name: string, amount: number, unit: string, pantryKey: string) => ({
    name,
    amount,
    unit,
    source: (has(pantryKey) ? 'inventory' : 'shopping') as 'inventory' | 'shopping',
  });

  return {
    id: 'local_chicken_curry',
    name: 'Sri Lankan Chicken Curry',
    ingredients: [
      ing('Chicken', 500, 'g', 'chicken'),
      ing('Onion', 2, 'pcs', 'onion'),
      ing('Garlic', 4, 'cloves', 'garlic'),
      ing('Ginger', 1, 'inch', 'ginger'),
      ing('Green Chillies', 2, 'pcs', 'chilli'),
      ing('Curry powder', 2, 'tsp', 'curry'),
      ing('Turmeric', 0.5, 'tsp', 'turmeric'),
      ing('Coconut milk', 200, 'ml', 'coconut'),
      ing('Coconut oil', 2, 'tbsp', 'oil'),
      ing('Curry leaves', 1, 'sprig', 'curry'),
    ],
    instructions: [
      'Temper onions, garlic, ginger, and curry leaves in coconut oil.',
      'Add chicken and spices; brown lightly.',
      'Pour coconut milk and simmer 25 minutes until tender.',
      `Serve with rice for ${servings}.`,
    ],
    prepTimeMin: 15,
    cookTimeMin: 30,
    assignedCook: assignCook(ctx),
    reasonForSelection: 'Classic Sri Lankan chicken curry — matches what you asked for.',
    dietaryTags: ['Sri Lankan'],
    nutritionalInfo: { calories: 480, protein: '32g', sugar: '4g', fat: '22g' },
  };
}

function buildSteamedRiceFromPantry(ctx: AgentContext, servings = 4): Recipe {
  const has = (term: string) => ctx.inventory.some((i) => i.item.toLowerCase().includes(term));
  return {
    id: 'local_steamed_rice',
    name: 'Steamed White Rice',
    ingredients: [
      ...(has('rice')
        ? [{ name: 'White Rice', amount: servings * 100, unit: 'g', source: 'inventory' as const }]
        : [{ name: 'White Rice', amount: servings * 100, unit: 'g', source: 'shopping' as const }]),
    ],
    instructions: ['Rinse rice.', 'Boil with water until fluffy.', 'Serve with curry.'],
    prepTimeMin: 5,
    cookTimeMin: 20,
    assignedCook: assignCook(ctx),
    reasonForSelection: 'Plain rice to pair with your curry.',
    dietaryTags: ['Sri Lankan'],
    nutritionalInfo: { calories: 280, protein: '5g', sugar: '0g', fat: '1g' },
  };
}

function buildEggCurryFromPantry(ctx: AgentContext, servings = 4): Recipe {
  const has = (term: string) => ctx.inventory.some((i) => i.item.toLowerCase().includes(term));
  return {
    id: 'local_egg_curry',
    name: 'Sri Lankan Egg Curry',
    ingredients: [
      ...(has('egg')
        ? [{ name: 'Eggs', amount: Math.max(4, servings), unit: 'pcs', source: 'inventory' as const }]
        : [{ name: 'Eggs', amount: Math.max(4, servings), unit: 'pcs', source: 'shopping' as const }]),
      ...(has('rice')
        ? [{ name: 'Rice', amount: servings * 80, unit: 'g', source: 'inventory' as const }]
        : [{ name: 'Rice', amount: servings * 80, unit: 'g', source: 'shopping' as const }]),
      { name: 'Onions', amount: 2, unit: 'pcs', source: has('onion') ? ('inventory' as const) : ('shopping' as const) },
      { name: 'Curry leaves', amount: 1, unit: 'sprig', source: 'shopping' as const },
      { name: 'Turmeric', amount: 0.5, unit: 'tsp', source: 'shopping' as const },
      { name: 'Chilli powder', amount: 1, unit: 'tsp', source: 'shopping' as const },
      { name: 'Coconut milk', amount: 200, unit: 'ml', source: 'shopping' as const },
    ],
    instructions: [
      'Boil eggs, peel, and lightly fry.',
      'Temper onions and curry leaves; add spices and coconut milk.',
      'Simmer eggs in gravy 8 minutes.',
      `Serve with rice for ${servings}.`,
    ],
    prepTimeMin: 10,
    cookTimeMin: 25,
    assignedCook: assignCook(ctx),
    reasonForSelection: 'Easy Sri Lankan dinner from eggs and rice at home.',
    dietaryTags: ['Sri Lankan', 'Vegetarian option'],
    nutritionalInfo: { calories: 410, protein: '18g', sugar: '3g', fat: '14g' },
  };
}

function buildBrinjalCurryFromPantry(ctx: AgentContext, servings = 4): Recipe {
  const has = (term: string) => ctx.inventory.some((i) => i.item.toLowerCase().includes(term));
  const hasBrinjal = has('eggplant') || has('brinjal') || has('wambatu');
  return {
    id: 'local_brinjal',
    name: 'Wambatu Moju (Brinjal Pickle Curry)',
    ingredients: [
      ...(hasBrinjal
        ? [{ name: 'Brinjal', amount: 3, unit: 'pcs', source: 'inventory' as const }]
        : [{ name: 'Brinjal', amount: 3, unit: 'pcs', source: 'shopping' as const }]),
      ...(has('rice')
        ? [{ name: 'Rice', amount: servings * 80, unit: 'g', source: 'inventory' as const }]
        : [{ name: 'Rice', amount: servings * 80, unit: 'g', source: 'shopping' as const }]),
      { name: 'Onions', amount: 1, unit: 'pcs', source: has('onion') ? ('inventory' as const) : ('shopping' as const) },
      { name: 'Vinegar', amount: 2, unit: 'tbsp', source: 'shopping' as const },
      { name: 'Sugar', amount: 1, unit: 'tsp', source: 'shopping' as const },
      { name: 'Chilli powder', amount: 1, unit: 'tsp', source: 'shopping' as const },
      { name: 'Coconut oil', amount: 2, unit: 'tbsp', source: has('oil') ? ('inventory' as const) : ('shopping' as const) },
    ],
    instructions: [
      'Fry brinjal wedges until golden.',
      'Caramelize onions with vinegar, sugar, and chilli.',
      'Combine and simmer briefly.',
      `Serve with rice for ${servings}.`,
    ],
    prepTimeMin: 15,
    cookTimeMin: 25,
    assignedCook: assignCook(ctx),
    reasonForSelection: 'Classic Sri Lankan brinjal dish — uses eggplant from your pantry.',
    dietaryTags: ['Sri Lankan', 'Vegetarian'],
    nutritionalInfo: { calories: 360, protein: '8g', sugar: '6g', fat: '12g' },
  };
}

function buildHoppersFromPantry(ctx: AgentContext, servings = 4): Recipe {
  const has = (term: string) => ctx.inventory.some((i) => i.item.toLowerCase().includes(term));
  const ing = (name: string, amount: number, unit: string, pantryKey: string | null) => ({
    name,
    amount,
    unit,
    // Free staples (water) never go on the shop list
    source: (pantryKey === null || has(pantryKey) ? 'inventory' : 'shopping') as 'inventory' | 'shopping',
  });

  const eggHoppers = /\begg\b/i.test(ctx.userPrompt || ctx.prompt || '');

  return {
    id: 'local_hoppers',
    name: eggHoppers ? 'Egg Hoppers (Appa)' : 'Plain Hoppers (Appa)',
    ingredients: [
      ing('Rice Flour', 300, 'g', 'flour'),
      ing('Coconut Milk', 400, 'ml', 'coconut'),
      // Always treat as at home — don't charge for tap water
      ing('Water', 200, 'ml', null),
      ing('Salt', 1, 'tsp', 'salt'),
      ing('Yeast', 1, 'tsp', 'yeast'),
      ...(eggHoppers ? [ing('Eggs', Math.max(2, servings), 'pcs', 'egg')] : []),
      ing('Coconut Oil', 1, 'tbsp', 'oil'),
    ],
    instructions: [
      'Mix rice flour, coconut milk, water, salt, and yeast into a thin batter. Rest 30–60 minutes until slightly fermented.',
      'Heat a hopper pan (appa kal) and lightly oil it.',
      'Pour a ladle of batter, swirl to coat the sides, cover and steam until the centre sets and edges crisp.',
      eggHoppers
        ? 'For egg hoppers, crack an egg into the centre before covering.'
        : 'Serve plain hoppers hot with lunu miris, pol sambol, or a curry.',
      `Makes about ${servings * 2} hoppers for ${servings} people.`,
    ],
    prepTimeMin: 40,
    cookTimeMin: 25,
    assignedCook: assignCook(ctx),
    reasonForSelection: 'You asked for hoppers — local Sri Lankan appa recipe (TheMealDB has no hoppers).',
    dietaryTags: ['Sri Lankan', 'Hoppers', eggHoppers ? 'Egg' : 'Vegetarian'].filter(Boolean),
    nutritionalInfo: { calories: 280, protein: eggHoppers ? '12g' : '6g', sugar: '2g', fat: '8g' },
  };
}

function buildStringHoppersFromPantry(ctx: AgentContext, servings = 4): Recipe {
  const has = (term: string) => ctx.inventory.some((i) => i.item.toLowerCase().includes(term));
  const ing = (name: string, amount: number, unit: string, pantryKey: string | null) => ({
    name,
    amount,
    unit,
    source: (pantryKey === null || has(pantryKey) ? 'inventory' : 'shopping') as 'inventory' | 'shopping',
  });

  return {
    id: 'local_string_hoppers',
    name: 'String Hoppers (Idiyappam)',
    ingredients: [
      ing('Rice Flour', 400, 'g', 'flour'),
      ing('Water', 300, 'ml', null),
      ing('Salt', 1, 'tsp', 'salt'),
      ing('Fresh Coconut', 100, 'g', 'coconut'),
    ],
    instructions: [
      'Knead rice flour with hot water and salt into a soft dough.',
      'Press through an idiyappam press onto steamer mats.',
      'Steam 5–8 minutes until cooked through.',
      'Serve with pol sambol, kiri hodi, or curry.',
    ],
    prepTimeMin: 20,
    cookTimeMin: 15,
    assignedCook: assignCook(ctx),
    reasonForSelection: 'You asked for string hoppers — local idiyappam plan.',
    dietaryTags: ['Sri Lankan', 'String hoppers', 'Vegetarian'],
    nutritionalInfo: { calories: 250, protein: '5g', sugar: '1g', fat: '4g' },
  };
}

/** Build Sri Lankan suggestions from pantry — no TheMealDB. */
export function buildLocalPantrySuggestions(ctx: AgentContext, prompt: string): Recipe[] {
  const servings = extractFamilySize(prompt) ?? 4;
  const lower = normalizeOrderTypos(prompt);
  // Prefer vector-ranked relevant pantry when available
  const shelf = ctx.relevantPantry?.length ? ctx.relevantPantry : ctx.inventory;
  const has = (term: string) => shelf.some((i) => i.item.toLowerCase().includes(term));
  const out: Recipe[] = [];

  // Decided local dishes first — never lose to random pantry templates
  if (/string\s*hoppers|idiyappam/i.test(lower)) {
    out.push(buildStringHoppersFromPantry(ctx, servings));
  } else if (/hopper|appa/i.test(lower)) {
    out.push(buildHoppersFromPantry(ctx, servings));
  }

  if (/chicken\s*curry/i.test(lower) || (/chicken/i.test(lower) && /curry/i.test(lower))) {
    out.push(buildChickenCurryFromPantry(ctx, servings));
  }
  if (/\brice\b/i.test(lower) && !/fried|biriyani|biryani|flour|hopper/i.test(lower)) {
    out.push(buildSteamedRiceFromPantry(ctx, servings));
  }
  if (/kottu|kothu/i.test(lower)) out.push(buildKottuFromPantry(ctx, servings));
  if (/fried\s*rice/i.test(lower)) out.push(buildFriedRiceFromPantry(ctx));
  if (has('eggplant') || has('brinjal') || has('wambatu')) out.push(buildBrinjalCurryFromPantry(ctx, servings));
  if (has('egg') && !/hopper/i.test(lower)) out.push(buildEggCurryFromPantry(ctx, servings));
  if ((has('dhal') || has('dal')) && !/hopper/i.test(lower)) out.push(fallbackRecipe(ctx));

  if (!out.length) {
    if (has('rice')) out.push(fallbackRecipe(ctx));
    if (has('egg')) out.push(buildEggCurryFromPantry(ctx, servings));
  }

  const seen = new Set<string>();
  return out.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

// Re-export helpers used below — defined in same file after imports in recipe-compiler
function buildFriedRiceFromPantry(ctx: AgentContext): Recipe {
  const has = (term: string) => ctx.inventory.some((i) => i.item.toLowerCase().includes(term));
  const ing = (name: string, amount: number, unit: string, pantryKey: string) => ({
    name,
    amount,
    unit,
    source: (has(pantryKey) ? 'inventory' : 'shopping') as 'inventory' | 'shopping',
  });

  return {
    id: 'local_fried_rice',
    name: 'Classic Egg Fried Rice',
    ingredients: [
      ing('White Rice', 300, 'g', 'rice'),
      ing('Farm Eggs', 2, 'pcs', 'egg'),
      ing('Red Onions', 1, 'pcs', 'onion'),
      ing('Coconut Oil', 2, 'tbsp', 'oil'),
      ing('Carrots', 1, 'pcs', 'carrot'),
      ing('Soy Sauce', 1, 'tbsp', 'soy'),
      ing('Garlic', 2, 'cloves', 'garlic'),
    ],
    instructions: [
      'Use day-old rice if you have it; fluff with a fork.',
      'Scramble eggs in hot oil, set aside.',
      'Stir-fry onion, garlic, and carrot; add rice and soy sauce.',
      'Fold eggs back in and serve hot.',
    ],
    prepTimeMin: 10,
    cookTimeMin: 15,
    assignedCook: assignCook(ctx),
    reasonForSelection: 'Built from your pantry for fried rice — home items marked as inventory.',
    dietaryTags: ['Sri Lankan', 'Quick meal'],
    nutritionalInfo: { calories: 420, protein: '14g', sugar: '3g', fat: '12g' },
  };
}

function fallbackRecipe(ctx: AgentContext): Recipe {
  const hasDhal = ctx.inventory.some((i) => i.item.toLowerCase().includes('dhal'));
  const hasRice = ctx.inventory.some((i) => i.item.toLowerCase().includes('rice'));
  return {
    id: 'local_1',
    name: 'Sri Lankan Dhal & Rice',
    ingredients: [
      ...(hasRice ? [{ name: 'Rice', amount: 300, unit: 'g', source: 'inventory' as const }] : [{ name: 'Rice', amount: 500, unit: 'g', source: 'shopping' as const }]),
      ...(hasDhal ? [{ name: 'Dhal', amount: 200, unit: 'g', source: 'inventory' as const }] : [{ name: 'Dhal', amount: 250, unit: 'g', source: 'shopping' as const }]),
      { name: 'Onions', amount: 2, unit: 'pcs', source: 'shopping' },
    ],
    instructions: ['Boil rice.', 'Cook dhal with turmeric and tempered onions.', 'Serve together.'],
    prepTimeMin: 10,
    cookTimeMin: 25,
    assignedCook: assignCook(ctx),
    reasonForSelection: 'Default Sri Lankan staple using available home inventory.',
    dietaryTags: ['Sri Lankan', 'Vegetarian', 'Diabetic-Friendly'],
    nutritionalInfo: { calories: 380, protein: '14g', sugar: '2g', fat: '5g' },
  };
}

export { buildFriedRiceFromPantry, buildHoppersFromPantry, buildStringHoppersFromPantry, fallbackRecipe, assignCook };
