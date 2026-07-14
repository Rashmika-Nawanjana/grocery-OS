import type { OrchestrationResult, Recipe } from '@/lib/types';
import type { MemoryEntry, UserMemory } from '@/lib/memory/types';

function entryId(): string {
  return crypto.randomUUID();
}

function upsertEntry(
  memory: UserMemory,
  category: MemoryEntry['category'],
  key: string,
  value: string,
  source: MemoryEntry['source'] = 'inferred',
  confidence = 0.75
): UserMemory {
  const now = new Date().toISOString();
  const existing = memory.entries.find((e) => e.category === category && e.key.toLowerCase() === key.toLowerCase());
  if (existing) {
    return {
      ...memory,
      updatedAt: now,
      entries: memory.entries.map((e) =>
        e.id === existing.id
          ? { ...e, value, source, confidence: Math.max(e.confidence, confidence), updatedAt: now }
          : e
      ),
    };
  }
  return {
    ...memory,
    updatedAt: now,
    entries: [
      ...memory.entries,
      { id: entryId(), category, key, value, source, confidence, createdAt: now, updatedAt: now },
    ],
  };
}

/** Pull durable preferences from a user prompt (regex — no LLM required). */
export function extractMemoryFromPrompt(memory: UserMemory, prompt: string): UserMemory {
  let next = { ...memory };
  const lower = prompt.toLowerCase();

  const budgetMatch = prompt.match(/(?:budget|lkr|rs\.?)\s*(?:of|:)?\s*(\d[\d,]*)/i);
  if (budgetMatch) {
    const amount = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
    if (amount >= 500 && amount <= 500000) {
      next = { ...next, defaultBudgetLkr: amount };
      next = upsertEntry(next, 'budget', 'default', `LKR ${amount}`, 'inferred', 0.9);
    }
  }

  for (const store of ['Keells', 'Cargills', 'Pola']) {
    if (lower.includes(store.toLowerCase())) {
      const stores = [...new Set([...next.preferredStores, store])];
      next = { ...next, preferredStores: stores };
      next = upsertEntry(next, 'store', store.toLowerCase(), `Prefers ${store}`, 'inferred', 0.85);
    }
  }

  const areaMatch = prompt.match(/\b(?:in|near|around|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
  if (areaMatch && !['Home', 'The', 'My'].includes(areaMatch[1])) {
    next = { ...next, homeArea: areaMatch[1] };
    next = upsertEntry(next, 'location', 'home_area', areaMatch[1], 'inferred', 0.7);
  }

  // Lowercase place fallback (e.g. "in negombo")
  const areaLower = prompt.match(/\b(?:in|near|around|from)\s+([a-z][a-z]+)(?:\s|,|\.|$)/i);
  if (areaLower && !next.homeArea) {
    const place = areaLower[1];
    if (!/home|the|my|tonight|budget|dinner|lunch/.test(place)) {
      const titled = place.charAt(0).toUpperCase() + place.slice(1);
      next = { ...next, homeArea: titled };
      next = upsertEntry(next, 'location', 'home_area', titled, 'inferred', 0.55);
    }
  }

  const avoidPatterns: [RegExp, string][] = [
    [/\bno\s+fish\b|\bwithout\s+fish\b|\bfish[\s-]free\b/i, 'no fish'],
    [/\bno\s+spicy\b|\bmild\b|\bnot\s+spicy\b/i, 'no spicy'],
    [/\bvegetarian\b/i, 'vegetarian'],
    [/\bvegan\b/i, 'vegan'],
    [/\bgluten[\s-]free\b/i, 'gluten-free'],
    [/\blow[\s-]?carb\b/i, 'low-carb'],
    [/\bdiabetic[\s-]?friendly\b|\bdiabetic\b/i, 'diabetic-friendly'],
    [/\bno\s+shellfish\b/i, 'no shellfish'],
  ];
  for (const [re, label] of avoidPatterns) {
    if (re.test(prompt)) {
      next = upsertEntry(next, 'avoid', label, `User avoids: ${label}`, 'inferred', 0.95);
    }
  }

  if (/\buse\s+home\s+inventory\b|\bfrom\s+pantry\b|\bwhat\s+i\s+have\b|\bcook with what\b/i.test(prompt)) {
    next = upsertEntry(next, 'preference', 'use_inventory', 'Prefer using home inventory when planning', 'inferred', 0.9);
  }

  return next;
}

export interface MemoryExtractExtras {
  clarificationContext?: {
    mealMode?: 'cook_pantry' | 'cook_shop' | 'order' | 'eat_out';
    cookEffort?: 'quick' | 'normal';
    budgetLkr?: number;
  };
  mealComponents?: {
    name: string;
    role: 'cook' | 'buy_ready' | 'ingredient';
    reason?: string;
  }[];
}

/** Learn from orchestration output (roles, dishes, scenario, clarification defaults). */
export function extractMemoryFromResult(
  memory: UserMemory,
  prompt: string,
  result: OrchestrationResult,
  extras: MemoryExtractExtras = {}
): UserMemory {
  let next = extractMemoryFromPrompt(memory, prompt);

  if (result.scenario) {
    next = upsertEntry(next, 'fact', 'last_scenario', result.scenario, 'system', 0.6);
  }

  const recipes: Recipe[] = result.data?.recipes ?? [];
  for (const recipe of recipes.slice(0, 3)) {
    if (recipe.id === 'buy_ready_sides') continue;
    next = upsertEntry(next, 'dish', recipe.name.toLowerCase(), recipe.name, 'inferred', 0.65);
  }

  const store = result.traffic?.recommendedStore;
  if (store) {
    if (['Keells', 'Cargills', 'Pola'].some((s) => storeNameIncludes(store, s))) {
      const matched = ['Keells', 'Cargills', 'Pola'].find((s) => storeNameIncludes(store, s))!;
      next = {
        ...next,
        preferredStores: [...new Set([...next.preferredStores, matched])],
      };
      next = upsertEntry(next, 'store', 'last_recommended', matched, 'system', 0.7);
    }
  }

  if (result.dietaryVerdict?.memberNotes?.length) {
    for (const note of result.dietaryVerdict.memberNotes.slice(0, 3)) {
      next = upsertEntry(next, 'dietary', note.slice(0, 40).toLowerCase(), note, 'system', 0.8);
    }
  }

  // Persist cook vs buy-ready habits for next time
  const roles = extras.mealComponents ?? result.mealComponents ?? [];
  for (const c of roles) {
    if (c.role !== 'cook' && c.role !== 'buy_ready') continue;
    const key = c.name.trim().toLowerCase();
    if (!key) continue;
    next = upsertEntry(
      next,
      'meal_role',
      key,
      c.role,
      'inferred',
      c.role === 'buy_ready' ? 0.9 : 0.8
    );
  }

  const clarify = extras.clarificationContext;
  if (clarify?.mealMode) {
    next = upsertEntry(next, 'preference', 'default_meal_mode', clarify.mealMode, 'inferred', 0.9);
    if (clarify.mealMode === 'cook_pantry') {
      next = upsertEntry(next, 'preference', 'use_inventory', 'Prefer using home inventory when planning', 'inferred', 0.9);
    }
  }
  if (clarify?.cookEffort) {
    next = upsertEntry(next, 'preference', 'default_cook_effort', clarify.cookEffort, 'inferred', 0.85);
  }
  if (clarify?.budgetLkr && clarify.budgetLkr >= 500) {
    next = { ...next, defaultBudgetLkr: clarify.budgetLkr };
    next = upsertEntry(next, 'budget', 'default', `LKR ${clarify.budgetLkr}`, 'inferred', 0.9);
  }

  // Cap meal_role + dish growth
  next = pruneCategory(next, 'meal_role', 40);
  next = pruneCategory(next, 'dish', 25);

  return next;
}

function storeNameIncludes(store: string, name: string): boolean {
  return store.toLowerCase().includes(name.toLowerCase());
}

function pruneCategory(memory: UserMemory, category: MemoryEntry['category'], keep: number): UserMemory {
  const ofCat = memory.entries
    .filter((e) => e.category === category)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (ofCat.length <= keep) return memory;
  const drop = new Set(ofCat.slice(keep).map((e) => e.id));
  return {
    ...memory,
    entries: memory.entries.filter((e) => !drop.has(e.id)),
    updatedAt: new Date().toISOString(),
  };
}
