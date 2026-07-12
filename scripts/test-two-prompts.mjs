/** Quick smoke test for chicken curry + biryani order prompts */
const BASE = process.env.PLANGO_BASE_URL || 'http://localhost:3000';

const inventory = [
  { id: '1', item: 'White Rice', quantity: 500, unit: 'g', expiryDays: 30, lastAdded: '2026-06-18' },
  { id: '4', item: 'Red Onions', quantity: 4, unit: 'pcs', expiryDays: 14, lastAdded: '2026-06-17' },
];

const family = [
  { name: 'Raj', age: 42, preferences: ['Spicy food'], allergies: [], dietaryRestrictions: [], favoriteIngredients: ['chicken'], schedule: { workHours: '09:00-18:00', freeHours: '18:00-21:00', cookingAvailability: true, cookingSkill: 'medium' } },
];

async function test(prompt, budget) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, budgetLkr: budget, inventory, family }),
    signal: AbortSignal.timeout(120000),
  });
  const j = await res.json();
  const d = j.data || {};
  console.log(`\n=== ${prompt} (${((Date.now() - t0) / 1000).toFixed(1)}s) ===`);
  console.log('outputMode:', d.outputMode);
  console.log('recipes:', (d.recipes || []).map((r) => r.name).join(' + ') || '(none)');
  console.log('shop items:', (d.shoppingList || []).length, (d.shoppingList || []).slice(0, 5).map((i) => i.itemName || i.name).join(', '));
  console.log('total LKR:', d.totalBudgetSpent);
  console.log('contextDish:', d.contextDish);
  console.log('places:', (d.localBusinesses || []).length, '| query:', d.placesQuery);
  if (d.localBusinesses?.length) console.log('  restaurants:', d.localBusinesses.slice(0, 4).map((p) => p.name).join(', '));
  console.log('headline:', d.planCuration?.headline);
  const hidden = (d.planCuration?.recipeRankings || []).filter((r) => !r.included).map((r) => r.name);
  if (hidden.length) console.log('hidden:', hidden.join(', '));
  return d;
}

const biryani = await test('i want to order a biriyani', 5000);
const curry = await test('i want to eat rice and chicken curry tonight', 1000);

const okBiryani = biryani.outputMode === 'dine_out' && (biryani.localBusinesses?.length || 0) > 0 && biryani.totalBudgetSpent > 0;
const okCurry =
  (curry.recipes || []).some((r) => /chicken curry/i.test(r.name)) &&
  (curry.recipes || []).some((r) => /rice/i.test(r.name));

console.log('\n--- RESULT ---');
console.log('Biryani order:', okBiryani ? 'PASS' : 'FAIL');
console.log('Rice + chicken curry:', okCurry ? 'PASS' : 'FAIL');
process.exit(okBiryani && okCurry ? 0 : 1);
