import type { Recipe } from '@/lib/types';
import type { InventoryItem } from '@/lib/types';

interface MealDbMeal {
  idMeal: string;
  strMeal: string;
  strInstructions?: string;
  strIngredient1?: string;
  strMeasure1?: string;
  [key: string]: string | undefined;
}

export async function searchMeals(query: string): Promise<Recipe[]> {
  const term = extractFoodTerm(query);
  try {
    const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(term)}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const data = await res.json();
    const meals: MealDbMeal[] = data.meals || [];
    return meals.slice(0, 4).map((m) => mealToRecipe(m));
  } catch {
    return [];
  }
}

export async function searchMealsByIngredient(ingredient: string): Promise<Recipe[]> {
  try {
    const url = `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ingredient)}`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const data = await res.json();
    const meals = data.meals || [];
    const full: Recipe[] = [];
    for (const m of meals.slice(0, 3)) {
      const detail = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${m.idMeal}`);
      const detailData = await detail.json();
      if (detailData.meals?.[0]) full.push(mealToRecipe(detailData.meals[0]));
    }
    return full;
  } catch {
    return [];
  }
}

function extractFoodTerm(query: string): string {
  const lower = query.toLowerCase();
  if (/fried\s*rice/.test(lower)) return 'rice';
  const foods = ['chicken', 'rice', 'egg', 'dhal', 'lentil', 'fish', 'curry', 'vegetable', 'pasta', 'beef'];
  for (const f of foods) if (lower.includes(f)) return f;
  const words = lower.split(/\W+/).filter((w) => w.length > 3);
  return words[0] || 'chicken';
}

function mealToRecipe(meal: MealDbMeal): Recipe {
  const ingredients: Recipe['ingredients'] = [];
  for (let i = 1; i <= 15; i++) {
    const name = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (name?.trim()) {
      ingredients.push({ name: name.trim(), amount: parseFloat(measure || '1') || 1, unit: 'portion', source: 'shopping' });
    }
  }
  const instructions = (meal.strInstructions || 'Prepare and cook as directed.')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  return {
    id: meal.idMeal,
    name: meal.strMeal,
    ingredients,
    instructions: instructions.length ? instructions : ['Cook according to standard recipe.'],
    prepTimeMin: 15,
    cookTimeMin: 25,
    assignedCook: 'Family cook',
    reasonForSelection: 'Matched from TheMealDB recipe database.',
    dietaryTags: ['Imported Recipe'],
    nutritionalInfo: { calories: 350, protein: '20g', sugar: '5g', fat: '12g' },
  };
}

export function matchInventoryToRecipes(recipes: Recipe[], inventory: InventoryItem[]): Recipe[] {
  return recipes.map((recipe) => {
    const ingredients = recipe.ingredients.map((ing) => {
      const home = inventory.find(
        (inv) =>
          inv.item.toLowerCase().includes(ing.name.toLowerCase()) ||
          ing.name.toLowerCase().includes(inv.item.toLowerCase().split(' ')[0])
      );
      return home ? { ...ing, source: 'inventory' as const } : ing;
    });
    const inventoryUsed = ingredients.filter((i) => i.source === 'inventory').length;
    return {
      ...recipe,
      ingredients,
      reasonForSelection: `${recipe.reasonForSelection} Uses ${inventoryUsed} items from home inventory.`,
    };
  });
}
