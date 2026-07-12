import { extractItemsFromPrompt, isPriceLookupRequest } from '@/lib/agents/price-query';
import { isDineOutIntent, isPreparedFoodOrderIntent } from '@/lib/orchestrator/meal-intent';
import {
  detectScenarioFallback,
  enrichAgents,
  isDecidedMealIntent,
  isEnvironmentOnlyQuestion,
  isGroceryOrderFollowUp,
  pickFollowUpAgents,
  shouldReusePreviousRecipes,
  wantsNewRecipes,
  type IntentResult,
} from '@/lib/orchestrator/intent';
import {
  isMealRoutinePlanRequest,
  isRoutineComparisonFollowUp,
  routineCatalogItems,
  detectSandwichFillingVariant,
} from '@/lib/orchestrator/meal-routine';
import type { OrchestrationRequest } from '@/lib/types';

function isRoutineComparison(req: OrchestrationRequest): boolean {
  return isRoutineComparisonFollowUp(req.prompt, {
    isFollowUp: req.isFollowUp,
    previousRecipes: req.previousRecipes,
    hadMealRoutine: Boolean(req.previousMealPlan?.mealRoutineMeta),
  });
}

/** Regex-first intent — skips Gemini when the prompt pattern is unambiguous. */
export function tryFastPathIntent(req: OrchestrationRequest): IntentResult | null {
  const { prompt } = req;

  if (req.isFollowUp && req.previousScenario) {
    if (isRoutineComparison(req)) {
      return enrichAgents(detectScenarioFallback(prompt, req), prompt);
    }
    if (shouldReusePreviousRecipes(req) || isGroceryOrderFollowUp(prompt) || isPriceLookupRequest(prompt)) {
      return enrichAgents(
        {
          scenario: req.previousScenario,
          agentsToRun: pickFollowUpAgents(prompt, req.previousScenario),
          reasoning: 'Follow-up fast path — reuse context',
        },
        prompt
      );
    }
    if (wantsNewRecipes(prompt)) return null;
    const agents = pickFollowUpAgents(prompt, req.previousScenario);
    if (agents.length >= 2) {
      return enrichAgents(
        { scenario: req.previousScenario, agentsToRun: agents, reasoning: 'Follow-up fast path' },
        prompt
      );
    }
    return null;
  }

  if (isMealRoutinePlanRequest(prompt)) return enrichAgents(detectScenarioFallback(prompt), prompt);
  if (isEnvironmentOnlyQuestion(prompt)) return enrichAgents(detectScenarioFallback(prompt), prompt);
  if (isPriceLookupRequest(prompt)) return enrichAgents(detectScenarioFallback(prompt), prompt);
  if (isPreparedFoodOrderIntent(prompt) || isDineOutIntent(prompt)) {
    return enrichAgents(detectScenarioFallback(prompt, req), prompt);
  }
  if (isDecidedMealIntent(prompt)) return enrichAgents(detectScenarioFallback(prompt), prompt);
  if (isGroceryOrderFollowUp(prompt)) return enrichAgents(detectScenarioFallback(prompt), prompt);

  const lower = prompt.toLowerCase();
  if (/\b(buy|shopping|shop for|grocery list|compare prices)\b/i.test(lower)) {
    return enrichAgents(detectScenarioFallback(prompt), prompt);
  }

  return null;
}

export function earlyPriceItems(prompt: string, req?: OrchestrationRequest): string[] {
  if (req && isRoutineComparison(req)) {
    return routineCatalogItems(prompt, detectSandwichFillingVariant(prompt));
  }
  if (isPriceLookupRequest(prompt)) return extractItemsFromPrompt(prompt);
  if (isMealRoutinePlanRequest(prompt)) return routineCatalogItems(prompt);
  return [];
}
