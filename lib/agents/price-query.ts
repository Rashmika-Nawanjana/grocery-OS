const KNOWN_GROCERY = [
  'banana', 'bananas', 'rice', 'tomato', 'tomatoes', 'dhal', 'onion', 'onions',
  'chicken', 'egg', 'eggs', 'fish', 'carrot', 'carrots', 'oil', 'lentil', 'garlic', 'ginger',
  'bread', 'peanut butter', 'peanut', 'jam', 'tuna', 'butter', 'sandwich',
];

import { isRoutineComparisonFollowUp } from '@/lib/orchestrator/meal-routine';

/** Extract grocery item names from a natural-language prompt. */
export function extractItemsFromPrompt(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  if (isRoutineComparisonFollowUp(prompt, { isFollowUp: true })) return [];

  const found = new Set<string>();

  for (const k of KNOWN_GROCERY) {
    if (lower.includes(k)) found.add(normalizeItem(k));
  }

  const priceOf = lower.match(/(?:price|cost)\s+of\s+(?:a\s+|an\s+|the\s+)?([a-z][a-z\s-]{1,24}?)(?:\s+in|\s+at|\?|$)/i);
  if (priceOf?.[1]) found.add(normalizeItem(priceOf[1].trim()));

  const atStore = lower.match(/\b([a-z][a-z\s-]{1,24}?)\s+(?:in|at)\s+(?:keells|keels|cargills|pola)\b/i);
  if (atStore?.[1]) found.add(normalizeItem(atStore[1].trim()));

  return [...found];
}

export function isPriceLookupRequest(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  if (isRoutineMealPlanPrompt(lower)) return false;
  if (isRoutineComparisonFollowUp(prompt, { isFollowUp: true })) return false;
  const mentionsStore = /\b(keells|keels|cargills|pola|supermarket|store)\b/i.test(lower);
  const mentionsPrice = /\b(price|cost|how much|cheaper|compare)\b/i.test(lower);
  const mealIntent = /\b(cook|recipe|meal|order|fried rice|tonight|dinner|lunch)\b/i.test(lower);
  return (mentionsPrice || mentionsStore) && !mealIntent && extractItemsFromPrompt(prompt).length > 0;
}

function isRoutineMealPlanPrompt(lower: string): boolean {
  const recurring = /\b(every\s+(morning|day|weekday)|daily|each\s+morning|from\s+tomorrow|how\s+(much|often|frequently))\b/i.test(
    lower
  );
  const routineMeal = /\b(sandwich|sandwiches|breakfast)\b/i.test(lower);
  const storage = /\b(no\s+fridge|without\s+(a\s+)?fridge|don't\s+have\s+a\s+fridge|dont\s+have\s+a\s+fridge)\b/i.test(
    lower
  );
  return (recurring && routineMeal) || (storage && routineMeal);
}

function normalizeItem(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s.startsWith('banana')) return 'bananas';
  if (s === 'egg') return 'eggs';
  if (s === 'onion') return 'onions';
  if (s === 'tomato') return 'tomatoes';
  if (s === 'carrot') return 'carrots';
  return s;
}
