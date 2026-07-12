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
        e.id === existing.id ? { ...e, value, source, confidence: Math.max(e.confidence, confidence), updatedAt: now } : e
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

  if (/\buse\s+home\s+inventory\b|\bfrom\s+pantry\b|\bwhat\s+i\s+have\b/i.test(prompt)) {
    next = upsertEntry(next, 'preference', 'use_inventory', 'Prefer using home inventory when planning', 'inferred', 0.9);
  }

  return next;
}

/** Learn from orchestration output (chosen recipes, scenario habits). */
export function extractMemoryFromResult(
  memory: UserMemory,
  prompt: string,
  result: OrchestrationResult
): UserMemory {
  let next = extractMemoryFromPrompt(memory, prompt);

  if (result.scenario) {
    next = upsertEntry(next, 'fact', 'last_scenario', result.scenario, 'system', 0.6);
  }

  const recipes: Recipe[] = result.data?.recipes ?? [];
  for (const recipe of recipes.slice(0, 3)) {
    next = upsertEntry(next, 'dish', recipe.name.toLowerCase(), recipe.name, 'inferred', 0.65);
  }

  const store = result.traffic?.recommendedStore;
  if (store) {
    const storeName = store.split(' ')[0];
    if (['Keells', 'Cargills', 'Pola'].some((s) => storeName.includes(s))) {
      const matched = ['Keells', 'Cargills', 'Pola'].find((s) => store.includes(s))!;
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

  return next;
}
