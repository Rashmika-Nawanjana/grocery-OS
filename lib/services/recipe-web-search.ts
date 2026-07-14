/**
 * Google recipe fallback when TheMealDB has no match (e.g. Sri Lankan hoppers).
 * SerpAPI organic results → scrape page → Gemini normalizes to Recipe shape.
 */

import type { Recipe } from '@/lib/types';
import { geminiJson, SchemaType, type ResponseSchema } from '@/lib/services/gemini';
import { fetchPageContent } from '@/lib/services/store-crawlers';
import { planLog, planWarn } from '@/lib/plan-logger';

const recipeSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING },
    ingredients: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          amount: { type: SchemaType.NUMBER },
          unit: { type: SchemaType.STRING },
        },
        required: ['name', 'amount', 'unit'],
      },
    },
    instructions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    prepTimeMin: { type: SchemaType.NUMBER },
    cookTimeMin: { type: SchemaType.NUMBER },
  },
  required: ['name', 'ingredients', 'instructions'],
};

interface SerpOrganic {
  title?: string;
  link?: string;
  snippet?: string;
}

interface ParsedRecipe {
  name?: string;
  ingredients?: { name?: string; amount?: number; unit?: string }[];
  instructions?: string[];
  prepTimeMin?: number;
  cookTimeMin?: number;
}

function shortId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

async function searchGoogleRecipeUrls(dish: string): Promise<{ title: string; url: string; snippet: string }[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];

  try {
    const q = encodeURIComponent(`${dish} recipe Sri Lankan OR South Asian ingredients instructions`);
    const url = `https://serpapi.com/search.json?q=${q}&api_key=${key}&num=5&hl=en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { organic_results?: SerpOrganic[] };
    return (data.organic_results || [])
      .filter((r) => r.link && r.title)
      .slice(0, 4)
      .map((r) => ({
        title: r.title!,
        url: r.link!,
        snippet: r.snippet || '',
      }));
  } catch {
    return [];
  }
}

function toRecipe(parsed: ParsedRecipe, dish: string, sourceUrl: string): Recipe | null {
  const ingredients = (parsed.ingredients || [])
    .filter((i) => i.name?.trim())
    .map((i) => ({
      name: i.name!.trim(),
      amount: typeof i.amount === 'number' && i.amount > 0 ? i.amount : 1,
      unit: (i.unit || 'pcs').trim() || 'pcs',
      source: 'shopping' as const,
    }));

  if (!ingredients.length) return null;

  const instructions = (parsed.instructions || [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);

  const prep = Number(parsed.prepTimeMin);
  const cook = Number(parsed.cookTimeMin);

  return {
    id: `google_${shortId(sourceUrl)}`,
    name: (parsed.name || dish).trim(),
    ingredients,
    instructions: instructions.length ? instructions : ['Follow the linked recipe steps.'],
    prepTimeMin: Number.isFinite(prep) ? Math.min(120, Math.max(5, prep)) : 20,
    cookTimeMin: Number.isFinite(cook) ? Math.min(120, Math.max(5, cook)) : 25,
    assignedCook: 'Family cook',
    reasonForSelection: `From Google recipe search — ${sourceUrl}`,
    dietaryTags: ['Google', 'Web recipe'],
    nutritionalInfo: { calories: 350, protein: '—', sugar: '—', fat: '—' },
    imageUrl: undefined,
    sourceUrl,
  };
}

/**
 * Fetch a home-cookable recipe for a named dish via Google + page scrape.
 * Returns null if SerpAPI/scrape/Gemini are unavailable.
 */
export async function fetchRecipeFromGoogle(
  dish: string,
  opts?: { servings?: number; prompt?: string }
): Promise<Recipe | null> {
  const servings = opts?.servings ?? 4;
  const hits = await searchGoogleRecipeUrls(dish);
  if (!hits.length) {
    planWarn('recipe-web', `No Google results for "${dish}" (check SERPAPI_KEY)`);
    return null;
  }

  planLog('recipe-web', `Google recipe search — ${hits.length} hit(s) for "${dish}"`, {
    urls: hits.map((h) => h.url),
  });

  // Prefer recipe-looking domains; try up to 2 pages
  const ranked = [...hits].sort((a, b) => {
    const score = (u: string) =>
      /allrecipes|bbc|seriouseats|tasty|simplyrecipes|foodnetwork|recipetineats|hotels|youtube/i.test(u)
        ? /youtube/i.test(u)
          ? -1
          : 2
        : 1;
    return score(b.url) - score(a.url);
  });

  for (const hit of ranked.slice(0, 2)) {
    const page = await fetchPageContent(hit.url, 12_000);
    const text = (page || `${hit.title}\n${hit.snippet}`).slice(0, 12_000);
    if (text.length < 80) continue;

    const parsed = await geminiJson<ParsedRecipe>(
      `User asked for: "${opts?.prompt || dish}"
Dish to extract: ${dish}
Serve ~${servings} people.
Source URL: ${hit.url}
Page / snippet text:
${text}`,
      `Extract ONE practical home recipe for "${dish}" suitable for a Sri Lankan family kitchen.
Prefer Sri Lankan / South Asian method when the page allows.
Return JSON with name, ingredients[{name,amount,unit}], instructions[], prepTimeMin, cookTimeMin.
Skip ads, nutrition widgets, and unrelated dishes. Use metric or common kitchen units.`,
      recipeSchema
    );

    if (!parsed) {
      // Snippet-only fallback when Gemini unavailable but SerpAPI returned text
      if (hit.snippet && /ingredient|recipe|flour|coconut|hoppers|appa/i.test(`${hit.title} ${hit.snippet}`)) {
        const snippetRecipe = await geminiJson<ParsedRecipe>(
          `Create a practical "${dish}" recipe for ${servings} people from this Google result only:\nTitle: ${hit.title}\nSnippet: ${hit.snippet}\nURL: ${hit.url}`,
          `Return JSON recipe for Sri Lankan home cooking. Be concrete with ingredients and steps.`,
          recipeSchema
        );
        const fromSnippet = snippetRecipe ? toRecipe(snippetRecipe, dish, hit.url) : null;
        if (fromSnippet) {
          planLog('recipe-web', `Google snippet recipe — ${fromSnippet.name}`);
          return fromSnippet;
        }
      }
      continue;
    }

    const recipe = toRecipe(parsed, dish, hit.url);
    if (recipe) {
      planLog('recipe-web', `Google recipe OK — ${recipe.name} (${recipe.ingredients.length} ingredients)`, {
        url: hit.url,
      });
      return recipe;
    }
  }

  planWarn('recipe-web', `Could not parse a recipe page for "${dish}"`);
  return null;
}

export async function fetchRecipesFromGoogle(
  dishes: string[],
  opts?: { servings?: number; prompt?: string }
): Promise<Recipe[]> {
  const unique = [...new Set(dishes.map((d) => d.trim()).filter(Boolean))].slice(0, 2);
  const out: Recipe[] = [];
  for (const dish of unique) {
    const r = await fetchRecipeFromGoogle(dish, opts);
    if (r) out.push(r);
  }
  return out;
}
