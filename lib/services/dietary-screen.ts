import type { DietaryScreenResult, FamilyMember, UserMemorySnapshot } from '@/lib/types';

const ALLERGEN_PATTERNS: Record<string, RegExp> = {
  shellfish: /\b(prawn|shrimp|shellfish|crab|lobster|seafood)\b/i,
  fish: /\b(fish|tuna|salmon|sea\s*food)\b/i,
  dairy: /\b(milk|cheese|yogurt|butter|ghee|dairy|lactose)\b/i,
  egg: /\b(egg|eggs)\b/i,
  gluten: /\b(wheat|flour|bread|pasta|gluten|semolina)\b/i,
  nuts: /\b(peanut|almond|cashew|nut|nuts)\b/i,
};

const DIABETIC_HIGH_GI = /\b(white\s*r|rice\s*flour|sugar|jaggery|honey|sweet|dessert|soda|pastry|white\s*bread)\b/i;

function parseMemoryDietary(entries?: UserMemorySnapshot['entries']): string[] {
  if (!entries?.length) return [];
  return entries.filter((e) => e.category === 'dietary' || e.category === 'avoid').map((e) => e.value.toLowerCase());
}

function memberRules(member: FamilyMember): { allergies: string[]; restrictions: string[]; preferences: string[] } {
  return {
    allergies: [...member.allergies, ...member.dietaryRestrictions.filter((r) => /allerg/i.test(r))].map((s) =>
      s.toLowerCase()
    ),
    restrictions: member.dietaryRestrictions.map((s) => s.toLowerCase()),
    preferences: [...member.preferences, ...member.favoriteIngredients].map((s) => s.toLowerCase()),
  };
}

function matchesAllergen(allergy: string, item: string): boolean {
  const itemLower = item.toLowerCase();
  if (itemLower.includes(allergy) || allergy.includes(itemLower.split(' ')[0])) return true;
  for (const [label, pattern] of Object.entries(ALLERGEN_PATTERNS)) {
    if (allergy.includes(label) && pattern.test(item)) return true;
  }
  return false;
}

async function fetchOpenFoodFactsCarbs(item: string): Promise<{ carbs100g: number | null; name: string | null }> {
  try {
    const q = encodeURIComponent(`${item} sri lanka`);
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=3`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { carbs100g: null, name: null };
    const data = await res.json();
    const product = data.products?.[0];
    if (!product?.nutriments) return { carbs100g: null, name: null };
    const carbs = product.nutriments.carbohydrates_100g ?? product.nutriments.carbohydrates;
    return {
      carbs100g: typeof carbs === 'number' ? carbs : null,
      name: product.product_name || null,
    };
  } catch {
    return { carbs100g: null, name: null };
  }
}

function estimateGiFromCarbs(carbs100g: number | null, item: string): { gi: number | null; gl: number | null } {
  if (carbs100g == null) {
    if (DIABETIC_HIGH_GI.test(item)) return { gi: 70, gl: 25 };
    if (/\b(dhal|lentil|bean|chickpea|vegetable|leafy)\b/i.test(item)) return { gi: 35, gl: 8 };
    return { gi: null, gl: null };
  }
  const gi = carbs100g >= 60 ? 72 : carbs100g >= 40 ? 55 : carbs100g >= 20 ? 45 : 30;
  const gl = Math.round((gi * carbs100g) / 100);
  return { gi, gl };
}

/** Screen one grocery item against household family_members + memory (no hardcoded household). */
export async function screenIngredientForFamily(
  item: string,
  family: FamilyMember[],
  memoryEntries?: UserMemorySnapshot['entries']
): Promise<DietaryScreenResult> {
  const allergenWarnings: string[] = [];
  const restrictionWarnings: string[] = [];
  const matchedMembers = new Set<string>();
  const memoryNotes = parseMemoryDietary(memoryEntries);

  for (const member of family) {
    const rules = memberRules(member);
    for (const allergy of [...rules.allergies, ...member.allergies.map((a) => a.toLowerCase())]) {
      if (matchesAllergen(allergy, item)) {
        allergenWarnings.push(`${member.name}: allergy/exclusion — ${allergy}`);
        matchedMembers.add(member.name);
      }
    }
    for (const restriction of rules.restrictions) {
      if (restriction.includes('diabetic') || restriction.includes('diabetes') || restriction.includes('low sugar')) {
        if (DIABETIC_HIGH_GI.test(item)) {
          restrictionWarnings.push(`${member.name}: diabetic — high glycemic item`);
          matchedMembers.add(member.name);
        }
      }
      if (restriction.includes('no fish') && ALLERGEN_PATTERNS.fish.test(item)) {
        restrictionWarnings.push(`${member.name}: no fish/seafood`);
        matchedMembers.add(member.name);
      }
      if (restriction.includes('vegetarian') && /\b(chicken|beef|pork|fish|prawn|meat)\b/i.test(item)) {
        restrictionWarnings.push(`${member.name}: vegetarian — contains animal product`);
        matchedMembers.add(member.name);
      }
      if (restriction.includes('no spicy') && /\b(chilli|chili|pepper|spicy)\b/i.test(item)) {
        restrictionWarnings.push(`${member.name}: avoid spicy ingredients`);
        matchedMembers.add(member.name);
      }
    }
  }

  for (const note of memoryNotes) {
    if (note.includes('no fish') && ALLERGEN_PATTERNS.fish.test(item)) {
      restrictionWarnings.push(`Memory: avoid fish/seafood`);
    }
    if ((note.includes('diabetic') || note.includes('low sugar')) && DIABETIC_HIGH_GI.test(item)) {
      restrictionWarnings.push(`Memory: low sugar / diabetic preference`);
    }
  }

  const off = await fetchOpenFoodFactsCarbs(item);
  const { gi, gl } = estimateGiFromCarbs(off.carbs100g, item);

  const hasDiabetic = family.some((m) =>
    m.dietaryRestrictions.some((r) => /diabetic|diabetes|low.?sugar/i.test(r))
  );
  if (hasDiabetic && gi != null && gi >= 55) {
    restrictionWarnings.push(`Glycemic index ~${gi} may be high for diabetic household members`);
  }

  const status: DietaryScreenResult['status'] =
    allergenWarnings.length || restrictionWarnings.some((w) => w.includes('allergy') || w.includes('shellfish'))
      ? 'fail'
      : restrictionWarnings.length
        ? 'warn'
        : 'pass';

  const descriptionParts: string[] = [];
  if (off.name) descriptionParts.push(`Matched Open Food Facts entry: ${off.name}.`);
  if (gi != null) descriptionParts.push(`Estimated GI ~${gi}, GL ~${gl ?? 'n/a'} per 100g serving.`);
  if (!family.length) {
    descriptionParts.push('Add family members in Preferences to enable personalized dietary screening.');
  } else if (status === 'pass') {
    descriptionParts.push('No conflicts with stored allergies or dietary restrictions.');
  } else {
    descriptionParts.push('Review warnings against your Supabase household profile.');
  }

  return {
    item,
    status,
    glycemicIndex: gi,
    glycemicLoad: gl,
    allergenWarnings,
    restrictionWarnings,
    description: descriptionParts.join(' '),
    source: off.carbs100g != null ? 'openfoodfacts' : family.length ? 'family_db' : 'inferred',
    matchedMembers: [...matchedMembers],
  };
}

export function buildDietaryRulesSummary(family: FamilyMember[], memoryEntries?: UserMemorySnapshot['entries']): string[] {
  const lines: string[] = [];
  for (const member of family) {
    if (member.allergies.length) lines.push(`${member.name} allergies: ${member.allergies.join(', ')}`);
    if (member.dietaryRestrictions.length) lines.push(`${member.name} restrictions: ${member.dietaryRestrictions.join(', ')}`);
  }
  for (const note of parseMemoryDietary(memoryEntries).slice(0, 4)) {
    lines.push(`Memory: ${note}`);
  }
  return lines;
}
