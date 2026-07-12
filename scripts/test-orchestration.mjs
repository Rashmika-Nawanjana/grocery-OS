/**
 * End-to-end orchestration smoke tests (typical user prompts).
 * Run: node scripts/test-orchestration.mjs
 */

const BASE = process.env.PLANGO_BASE_URL || 'http://localhost:3000';

const initialInventory = [
  { id: '1', item: 'White Rice', quantity: 500, unit: 'g', expiryDays: 30, lastAdded: '2026-06-18' },
  { id: '2', item: 'Fresh Tomatoes', quantity: 2, unit: 'pcs', expiryDays: 7, lastAdded: '2026-06-19' },
  { id: '3', item: 'Mysoor Dhal', quantity: 1000, unit: 'g', expiryDays: 60, lastAdded: '2026-06-15' },
  { id: '4', item: 'Red Onions', quantity: 4, unit: 'pcs', expiryDays: 14, lastAdded: '2026-06-17' },
  { id: '6', item: 'Farm Eggs', quantity: 6, unit: 'pcs', expiryDays: 12, lastAdded: '2026-06-19' },
];

const initialFamily = [
  {
    name: 'Nisha', age: 38,
    preferences: ['Vegetables', 'Dhal Curries', 'Low sugar'],
    allergies: ['Shellfish'],
    dietaryRestrictions: ['diabetic-friendly', 'low-carb'],
    favoriteIngredients: ['dhal', 'vegetables', 'eggs'],
    schedule: { workHours: '06:00 - 10:00', freeHours: '10:00 - 18:00', cookingAvailability: true, cookingSkill: 'high' },
  },
  {
    name: 'Raj', age: 42,
    preferences: ['Spicy food', 'Meat dishes'],
    allergies: [],
    dietaryRestrictions: [],
    favoriteIngredients: ['chicken', 'onions'],
    schedule: { workHours: '09:00 - 18:00', freeHours: '18:00 - 21:00', cookingAvailability: true, cookingSkill: 'medium' },
  },
];

const SCENARIOS = [
  {
    name: 'Decided menu',
    body: {
      prompt: 'I already decided to cook dhal curry and chicken fry tonight. Find prices and best route.',
      budgetLkr: 4000,
      inventory: initialInventory,
      family: initialFamily,
    },
  },
  {
    name: 'Need suggestions',
    body: {
      prompt: 'Suggest 3 diabetic-friendly dinners for family of 4, no fish, budget LKR 5000, use home inventory',
      budgetLkr: 5000,
      inventory: initialInventory,
      family: initialFamily,
    },
  },
  {
    name: 'Shopping trip',
    body: {
      prompt: 'I am going shopping now. Compare rice, dhal, eggs, chicken prices and check for flood warnings.',
      budgetLkr: 6000,
      inventory: initialInventory,
      family: initialFamily,
    },
  },
];

async function testHealth() {
  const res = await fetch(`${BASE}/api/health`);
  const data = await res.json();
  console.log('\n=== Health ===');
  console.log(JSON.stringify(data, null, 2));
  return data.status === 'ok';
}

async function testPlan(name, body) {
  console.log(`\n=== ${name} ===`);
  const start = Date.now();
  const res = await fetch(`${BASE}/api/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const ms = Date.now() - start;

  if (!data.success) {
    console.log('FAIL:', data.error || 'unknown');
    return { name, ok: false, ms };
  }

  const agentsRun = data.agentsRun || [];
  const logs = data.logs || [];
  const successCount = logs.filter((l) => l.status === 'success').length;
  const skippedCount = logs.filter((l) => l.status === 'skipped').length;
  const warnCount = logs.filter((l) => l.status === 'warn').length;

  console.log(`Scenario: ${data.scenario}`);
  console.log(`Agents run (${agentsRun.length}): ${agentsRun.join(', ')}`);
  console.log(`Logs: ${successCount} success, ${warnCount} warn, ${skippedCount} skipped (${ms}ms)`);
  console.log(`Summary: ${(data.data?.orchestratorSummary || '').slice(0, 200)}…`);
  console.log(`Recipes: ${data.data?.recipes?.length ?? 0}, Prices: ${data.prices?.length ?? 0}`);

  logs.forEach((l) => {
    const icon = l.status === 'success' ? '✓' : l.status === 'skipped' ? '–' : l.status === 'warn' ? '!' : '·';
    console.log(`  ${icon} ${l.agentName}: ${l.message.slice(0, 80)}`);
  });

  const orchestratorOk = logs.some((l) => l.agentId === 'orchestrator' && l.status === 'success');
  const hasActiveAgent = successCount >= 2;
  return { name, ok: orchestratorOk && hasActiveAgent, ms, scenario: data.scenario };
}

async function testFollowUp() {
  console.log('\n=== Follow-up (order after suggestions) ===');
  const first = await fetch(`${BASE}/api/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Suggest 2 easy dinners for tonight using home inventory',
      budgetLkr: 5000,
      inventory: initialInventory,
      family: initialFamily,
    }),
  }).then((r) => r.json());

  if (!first.success) {
    console.log('First turn failed');
    return { name: 'Follow-up', ok: false };
  }

  const second = await fetch(`${BASE}/api/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Order the ingredients for the first recipe',
      budgetLkr: 5000,
      inventory: initialInventory,
      family: initialFamily,
      isFollowUp: true,
      previousScenario: first.scenario,
      previousRecipes: first.data?.recipes,
      conversationHistory: [
        { role: 'user', text: 'Suggest 2 easy dinners for tonight using home inventory' },
        { role: 'assistant', text: first.data?.orchestratorSummary || '' },
      ],
    }),
  }).then((r) => r.json());

  const reusedRecipes = second.data?.recipes?.some((r) =>
    first.data?.recipes?.some((fr) => fr.name === r.name)
  );
  const skippedRecipe = second.logs?.some(
    (l) => l.agentId === 'recipe-compiler' && l.status === 'skipped'
  );
  console.log(`Reused recipes: ${reusedRecipes}, recipe-compiler skipped: ${skippedRecipe}`);
  console.log(`Agents: ${second.agentsRun?.join(', ')}`);
  return { name: 'Follow-up', ok: second.success && (reusedRecipes || skippedRecipe), ms: 0 };
}

async function main() {
  console.log(`Testing plango at ${BASE}`);
  const healthOk = await testHealth();
  if (!healthOk) {
    console.error('Health check failed — is the server running?');
    process.exit(1);
  }

  const results = [];
  for (const s of SCENARIOS) {
    results.push(await testPlan(s.name, s.body));
  }
  results.push(await testFollowUp());

  console.log('\n=== Summary ===');
  results.forEach((r) => console.log(`${r.ok ? 'PASS' : 'FAIL'} — ${r.name}${r.scenario ? ` (${r.scenario})` : ''}`));
  const allOk = results.every((r) => r.ok);
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
