/**
 * Hybrid meal-role split: fast rules for known staples + Gemini for novel / multi-item phrases.
 * Default SL home pattern: cook dishes at home, buy ready staples (don't bake bread).
 */

import { normalizeOrderTypos } from '@/lib/orchestrator/meal-intent';
import { geminiJson, SchemaType, type ResponseSchema } from '@/lib/services/gemini';
import { planLog, planWarn } from '@/lib/plan-logger';
import type { UserMemory } from '@/lib/memory/types';
import type { UserMemorySnapshot } from '@/lib/types';

type MemoryInput = UserMemory | UserMemorySnapshot | undefined;

export type MealComponentRole = 'cook' | 'buy_ready' | 'ingredient';

export interface MealComponent {
  name: string;
  role: MealComponentRole;
  /** Short reason for agent logs / summary. */
  reason: string;
  /** Suggested shop qty when role is buy_ready. */
  buyQty?: number;
  buyUnit?: string;
  /** rules = lexicon, llm = Gemini, memory = learned from past turns. */
  source?: 'rules' | 'llm' | 'memory';
}

export interface MealComponentResolution {
  components: MealComponent[];
  source: 'rules' | 'hybrid' | 'llm' | 'rules_only';
  unsure: string[];
}

/** Finished goods people buy — never treat as a from-scratch bake/cook recipe. */
const BUY_READY: Array<{ re: RegExp; name: string; qty: number; unit: string; reason: string }> = [
  { re: /\b(bread|loaf|buns?|rolls?|toast|sandwich\s*bread|roti\s*pack|paratha\s*pack)\b/i, name: 'Bread', qty: 1, unit: 'loaf', reason: 'Store-bought staple — buy, do not bake at home' },
  { re: /\b(yoghurt|yogurt|curd|meekiri)\b/i, name: 'Yoghurt / curd', qty: 1, unit: 'pack', reason: 'Buy ready-made dairy' },
  { re: /\b(papadam|appalam)\b/i, name: 'Papadam', qty: 1, unit: 'pack', reason: 'Buy ready-made' },
  { re: /\b(butter|margarine)\b/i, name: 'Butter', qty: 1, unit: 'pack', reason: 'Buy ready-made' },
  { re: /\b(cheese|processed\s*cheese)\b/i, name: 'Cheese', qty: 1, unit: 'pack', reason: 'Buy ready-made' },
  { re: /\b(jam|marmalade)\b/i, name: 'Jam', qty: 1, unit: 'jar', reason: 'Buy ready-made' },
  { re: /\b(milk\s*packet|fresh\s*milk)\b/i, name: 'Milk', qty: 1, unit: 'pack', reason: 'Buy ready-made' },
  { re: /\b(string\s*hoppers|idiyappam)\b/i, name: 'String hoppers', qty: 10, unit: 'pcs', reason: 'Usually bought ready — not steamed from scratch unless asked' },
  { re: /\b(hoppers|appa)\b/i, name: 'Hoppers', qty: 6, unit: 'pcs', reason: 'Often bought ready; cook only if user says make/cook hoppers' },
  { re: /\b(sausages?|frankfurters?)\b/i, name: 'Sausages', qty: 1, unit: 'pack', reason: 'Buy ready-made' },
  { re: /\b(pickles?|achcharu)\b/i, name: 'Pickle / achcharu', qty: 1, unit: 'jar', reason: 'Buy ready-made' },
];

/** Dishes we expect to cook at home (recipes + shopping for ingredients). */
const COOK_DISHES: Array<{ re: RegExp; name: string }> = [
  { re: /\bdhal\s*curry|dal\s*curry|parippu\b/i, name: 'dhal curry' },
  { re: /\bdhal\b|\bdal\b|\bparippu\b/i, name: 'dhal curry' },
  { re: /\bchicken\s*curry\b/i, name: 'chicken curry' },
  { re: /\bfish\s*curry\b/i, name: 'fish curry' },
  { re: /\begg\s*curry\b/i, name: 'egg curry' },
  { re: /\bbrinjal\s*curry|wambatu\b/i, name: 'brinjal curry' },
  { re: /\bfried\s*rice\b/i, name: 'fried rice' },
  { re: /\bkottu|kothu\b/i, name: 'kottu roti' },
  { re: /\bbiryani|biriyani\b/i, name: 'biryani' },
  { re: /\brice\s*and\s*curry\b/i, name: 'rice and curry' },
  { re: /\bmallung|gotu\s*kola\b/i, name: 'mallung' },
  { re: /\bsambol\b/i, name: 'sambol' },
  { re: /\btempered\s+\w+|onion\s*temper\b/i, name: 'tempered side' },
  { re: /\bchicken\s*fry|fish\s*fry\b/i, name: 'fry' },
];

const mealComponentSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    cook: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Dishes to cook at home (recipes + ingredient shopping)',
    },
    buy_ready: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Finished goods to buy (bread, yoghurt, etc.) — never bake/make from scratch',
    },
    unsure: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Items that could go either way',
    },
  },
  required: ['cook', 'buy_ready', 'unsure'],
};

/** Explicit “make/bake bread” overrides buy_ready. */
function wantsFromScratch(prompt: string, item: string): boolean {
  const lower = normalizeOrderTypos(prompt);
  const itemRe = item.split(/\s+/)[0];
  return new RegExp(
    `\\b(make|bake|cook|prepare|homemade|home[- ]made)\\b[\\w\\s]{0,20}\\b${itemRe}\\b|\\b${itemRe}\\b[\\w\\s]{0,12}\\b(from scratch|dough|knead)\\b`,
    'i'
  ).test(lower);
}

function componentKey(c: Pick<MealComponent, 'role' | 'name'>): string {
  return `${c.role}:${c.name.toLowerCase()}`;
}

function namesOverlap(a: string, b: string): boolean {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;
  const ax = x.split(/\s+/)[0];
  const by = y.split(/\s+/)[0];
  return ax.length > 2 && ax === by;
}

/**
 * Rule-based parse (sync). Used as high-confidence layer and LLM fallback.
 * Example: "bread and dhal curry" → buy Bread + cook dhal curry.
 */
export function parseMealComponents(prompt: string): MealComponent[] {
  const lower = normalizeOrderTypos(prompt);
  const components: MealComponent[] = [];
  const seen = new Set<string>();

  const add = (c: MealComponent) => {
    const key = componentKey(c);
    if (seen.has(key)) return;
    seen.add(key);
    components.push({ ...c, source: c.source ?? 'rules' });
  };

  for (const item of BUY_READY) {
    if (!item.re.test(lower)) continue;
    if (wantsFromScratch(lower, item.name)) {
      add({
        name: item.name,
        role: 'cook',
        reason: 'User asked to make/bake this from scratch',
        source: 'rules',
      });
    } else {
      add({
        name: item.name,
        role: 'buy_ready',
        reason: item.reason,
        buyQty: item.qty,
        buyUnit: item.unit,
        source: 'rules',
      });
    }
  }

  for (const dish of COOK_DISHES) {
    if (!dish.re.test(lower)) continue;
    if (/hopper/i.test(dish.name) && components.some((c) => c.role === 'buy_ready' && /hopper/i.test(c.name))) {
      continue;
    }
    add({
      name: dish.name,
      role: 'cook',
      reason: 'Home-cooked dish — recipe + ingredient shopping',
      source: 'rules',
    });
  }

  return components;
}

/** True when rules already cover each "X and Y" part of the prompt. */
function rulesLookComplete(prompt: string, rules: MealComponent[]): boolean {
  if (!rules.length) return false;
  const lower = normalizeOrderTypos(prompt);
  const parts = lower
    .split(/\s+and\s+|,\s*|\s+with\s+|\s*\+\s*/i)
    .map((s) => s.replace(/\b(i want to eat|want to eat|eat|cook|make|for dinner|tonight|please)\b/gi, '').trim())
    .filter((s) => s.length > 2);
  if (parts.length <= 1) return rules.length > 0;

  return parts.every(
    (part) =>
      rules.some((r) => namesOverlap(r.name, part) || part.includes(r.name.toLowerCase().split(' ')[0])) ||
      BUY_READY.some((b) => b.re.test(part)) ||
      COOK_DISHES.some((c) => c.re.test(part))
  );
}

function isMealLikePrompt(prompt: string): boolean {
  return /\b(eat|cook|make|want|dinner|lunch|breakfast|meal|curry|recipe|hungry)\b/i.test(prompt);
}

function shouldCallLlm(prompt: string, rules: MealComponent[]): boolean {
  if (!isMealLikePrompt(prompt)) return false;
  if (!rules.length) return true;
  if (!rulesLookComplete(prompt, rules)) return true;
  // Multi-item but rules only caught one side
  if (/\band\b|,|\bwith\b/i.test(prompt) && rules.length < 2) return true;
  return false;
}

interface LlmMealRoles {
  cook?: string[];
  buy_ready?: string[];
  unsure?: string[];
}

async function classifyMealComponentsWithGemini(
  prompt: string,
  rules: MealComponent[]
): Promise<LlmMealRoles | null> {
  const ruleHint = rules.length
    ? `Already classified by rules (keep these unless user clearly contradicts): ${JSON.stringify(rules.map((r) => ({ name: r.name, role: r.role })))}`
    : 'No rule hits yet.';

  return geminiJson<LlmMealRoles>(
    `User meal request: "${prompt}"
${ruleHint}

Classify every distinct food mentioned.`,
    `You classify Sri Lankan / South Asian home meals into roles.
- cook: dishes prepared at home (curries, fried rice, kottu, mallung). Needs a recipe.
- buy_ready: finished goods bought from a shop (bread, yoghurt, papadam, milk packets, store hoppers, pol roti packs). NEVER bake bread unless user says bake/make/homemade.
- unsure: only if truly ambiguous.
Default for Sri Lankan homes: cook curries at home; buy bread and similar staples.
Return JSON only.`,
    mealComponentSchema
  );
}

function mergeHybrid(rules: MealComponent[], llm: LlmMealRoles, prompt: string): MealComponentResolution {
  const merged: MealComponent[] = [...rules];
  const unsure = (llm.unsure ?? []).map((s) => s.trim()).filter(Boolean);

  const coveredByRules = (name: string) =>
    merged.some((r) => namesOverlap(r.name, name));

  for (const name of llm.buy_ready ?? []) {
    const n = name.trim();
    if (!n || coveredByRules(n)) continue;
    if (wantsFromScratch(prompt, n)) {
      merged.push({
        name: n,
        role: 'cook',
        reason: 'User asked to make this from scratch (LLM + override)',
        source: 'llm',
      });
    } else {
      merged.push({
        name: n,
        role: 'buy_ready',
        reason: 'LLM: buy ready-made — do not cook from scratch',
        buyQty: 1,
        buyUnit: /bread|loaf/i.test(n) ? 'loaf' : 'pcs',
        source: 'llm',
      });
    }
  }

  for (const name of llm.cook ?? []) {
    const n = name.trim();
    if (!n || coveredByRules(n)) continue;
    // Don't cook something rules already marked buy_ready under another wording
    if (merged.some((r) => r.role === 'buy_ready' && namesOverlap(r.name, n))) continue;
    merged.push({
      name: n,
      role: 'cook',
      reason: 'LLM: home-cooked dish',
      source: 'llm',
    });
  }

  // Unsure: default cook if it looks like a dish, else skip (ask later via next-steps)
  for (const name of unsure) {
    if (coveredByRules(name)) continue;
    if (/\b(curry|rice|fry|sambol|mallung|kottu|biryani)\b/i.test(name)) {
      merged.push({
        name,
        role: 'cook',
        reason: 'LLM unsure — defaulting to cook (dish-like)',
        source: 'llm',
      });
    }
  }

  // Deduplicate by role+name
  const seen = new Set<string>();
  const components = merged.filter((c) => {
    const k = componentKey(c);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const usedLlm = components.some((c) => c.source === 'llm');
  return {
    components,
    source: usedLlm && rules.length ? 'hybrid' : usedLlm ? 'llm' : 'rules',
    unsure: unsure.filter((u) => !components.some((c) => namesOverlap(c.name, u))),
  };
}

/**
 * Apply learned meal_role memory for foods mentioned in the prompt.
 * e.g. bread=buy_ready from a prior "bread and dhal" turn.
 */
export function mealRolesFromMemory(prompt: string, memory?: MemoryInput): MealComponent[] {
  if (!memory?.entries?.length) return [];
  const lower = normalizeOrderTypos(prompt);
  const out: MealComponent[] = [];

  for (const e of memory.entries) {
    if (e.category !== 'meal_role') continue;
    const role = e.value === 'cook' || e.value === 'buy_ready' ? e.value : null;
    if (!role) continue;
    const key = e.key.toLowerCase().trim();
    if (!key) continue;
    const mentioned =
      lower.includes(key) ||
      new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower) ||
      key.split(/\s+/).some((w) => w.length > 2 && new RegExp(`\\b${w}\\b`, 'i').test(lower));
    if (!mentioned) continue;

    if (role === 'buy_ready' && wantsFromScratch(lower, e.key)) {
      out.push({
        name: e.key,
        role: 'cook',
        reason: 'User asked to make from scratch (overrides learned buy-ready)',
        source: 'memory',
      });
    } else {
      out.push({
        name: e.key,
        role,
        reason: `Learned habit: usually ${role === 'buy_ready' ? 'buy ready' : 'cook'} ${e.key}`,
        buyQty: role === 'buy_ready' ? 1 : undefined,
        buyUnit: role === 'buy_ready' ? (/bread|loaf/i.test(e.key) ? 'loaf' : 'pcs') : undefined,
        source: 'memory',
      });
    }
  }
  return out;
}

function mergeMemoryAndRules(memoryComps: MealComponent[], rules: MealComponent[]): MealComponent[] {
  const out = [...memoryComps];
  for (const r of rules) {
    if (out.some((c) => namesOverlap(c.name, r.name))) continue; // memory wins
    out.push(r);
  }
  return out;
}

/**
 * Hybrid resolver: memory habits → rules → Gemini gaps.
 * Memory and rules win over LLM for the same food name.
 */
export async function resolveMealComponents(
  prompt: string,
  memory?: MemoryInput
): Promise<MealComponentResolution> {
  const fromMemory = mealRolesFromMemory(prompt, memory);
  const rules = parseMealComponents(prompt);
  const base = mergeMemoryAndRules(fromMemory, rules);

  if (!shouldCallLlm(prompt, base)) {
    planLog('meal-roles', `Rules/memory only — ${describeMealComponentPlan(base) || 'none'}`, {
      memoryHits: fromMemory.length,
    });
    return {
      components: base,
      source: fromMemory.length ? 'hybrid' : 'rules_only',
      unsure: [],
    };
  }

  planLog('meal-roles', 'Calling Gemini to fill meal roles…', {
    ruleCount: rules.length,
    memoryHits: fromMemory.length,
    base: base.map((r) => `${r.role}:${r.name}`),
  });

  try {
    const llm = await classifyMealComponentsWithGemini(prompt, base);
    if (!llm) {
      planWarn('meal-roles', 'Gemini unavailable — using rules/memory only');
      return { components: base, source: fromMemory.length ? 'hybrid' : 'rules', unsure: [] };
    }
    const resolved = mergeHybrid(base, llm, prompt);
    planLog('meal-roles', `Hybrid roles: ${describeMealComponentPlan(resolved.components)}`, {
      source: resolved.source,
      unsure: resolved.unsure,
    });
    return resolved;
  } catch (err) {
    planWarn('meal-roles', `Gemini meal-roles failed: ${err instanceof Error ? err.message : String(err)}`);
    return { components: base, source: fromMemory.length ? 'hybrid' : 'rules', unsure: [] };
  }
}

export function cookComponents(components: MealComponent[]): MealComponent[] {
  return components.filter((c) => c.role === 'cook');
}

export function buyReadyComponents(components: MealComponent[]): MealComponent[] {
  return components.filter((c) => c.role === 'buy_ready');
}

/** Dish names to search in TheMealDB / local recipes — excludes buy-ready staples. */
export function cookDishNamesForSearch(prompt: string, components?: MealComponent[]): string[] {
  const comps = components ?? parseMealComponents(prompt);
  return cookComponents(comps).map((c) => c.name);
}

export function describeMealComponentPlan(components: MealComponent[]): string {
  if (!components.length) return '';
  const cook = cookComponents(components).map((c) => c.name);
  const buy = buyReadyComponents(components).map((c) => c.name);
  const parts: string[] = [];
  if (cook.length) parts.push(`Cook at home: ${cook.join(', ')}`);
  if (buy.length) parts.push(`Buy ready: ${buy.join(', ')}`);
  return parts.join(' · ');
}
