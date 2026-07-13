import {
  isCrisisNewsQuestion,
  isEnvironmentOnlyQuestion,
  isMealIntent,
  isWeatherQuestion,
} from '@/lib/orchestrator/intent';
import { isDineOutIntent, isPreparedFoodOrderIntent } from '@/lib/orchestrator/meal-intent';
import { isPriceLookupRequest } from '@/lib/agents/price-query';

export type ClarificationFieldId = 'budget' | 'servings' | 'days';

export interface ClarificationOption {
  label: string;
  value: number;
}

export interface ClarificationField {
  id: ClarificationFieldId;
  question: string;
  options: ClarificationOption[];
  allowCustom: boolean;
  customPlaceholder?: string;
  unit?: string;
}

export interface ClarificationRequest {
  fields: ClarificationField[];
  /** Original user prompt waiting to run after answers. */
  pendingPrompt: string;
}

/** Extract an explicit budget amount from free text. */
export function extractBudgetFromPrompt(prompt: string): number | null {
  const patterns = [
    /(?:budget|lkr|rs\.?)\s*(?:of|:)?\s*(\d[\d,]*)/i,
    /(?:under|within|max(?:imum)?|up to|around|about)\s*(?:lkr|rs\.?)?\s*(\d[\d,]*)/i,
    /(\d[\d,]*)\s*(?:lkr|rupees?)\b/i,
  ];
  for (const re of patterns) {
    const m = prompt.match(re);
    if (!m) continue;
    const amount = parseInt(m[1].replace(/,/g, ''), 10);
    if (amount >= 500 && amount <= 500000) return amount;
  }
  return null;
}

function extractServingsFromPrompt(prompt: string): number | null {
  const m = prompt.match(
    /\b(?:for|feeds?|serve[sd]?|family of|people|persons?|pax)\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:people|persons?|pax|servings?)\b/i
  );
  if (!m) return null;
  const n = parseInt(m[1] || m[2], 10);
  return n >= 1 && n <= 20 ? n : null;
}

function extractDaysFromPrompt(prompt: string): number | null {
  const m = prompt.match(
    /\b(?:for|next|over)\s*(\d{1,2})\s*days?\b|\b(\d{1,2})\s*days?\b|\b(?:a |one )?week\b|\bweekend\b/i
  );
  if (!m) return null;
  if (/\bweek\b/i.test(prompt) && !m[1] && !m[2]) return 7;
  if (/\bweekend\b/i.test(prompt) && !m[1] && !m[2]) return 2;
  const n = parseInt(m[1] || m[2], 10);
  return n >= 1 && n <= 31 ? n : null;
}

function isShoppingOrPriceIntent(prompt: string): boolean {
  return (
    isPriceLookupRequest(prompt) ||
    /\b(shopping|shop for|grocery|compare prices|buy now|going shopping|best route|prices?)\b/i.test(prompt)
  );
}

function isBudgetSensitive(prompt: string): boolean {
  if (isEnvironmentOnlyQuestion(prompt)) return false;
  if (isWeatherQuestion(prompt) && !isMealIntent(prompt) && !isShoppingOrPriceIntent(prompt)) return false;
  if (isCrisisNewsQuestion(prompt) && !isMealIntent(prompt) && !isShoppingOrPriceIntent(prompt)) return false;
  return (
    isMealIntent(prompt) ||
    isShoppingOrPriceIntent(prompt) ||
    isDineOutIntent(prompt) ||
    isPreparedFoodOrderIntent(prompt) ||
    /\b(plan|suggest|budget|afford|cheap|menu|dinner|lunch|breakfast|recipe)\b/i.test(prompt)
  );
}

function isMultiDayPlan(prompt: string): boolean {
  return (
    /\b(every (morning|day|night)|daily|week|weekend|days?|routine|meal plan|plan (my )?meals)\b/i.test(prompt) &&
    isMealIntent(prompt)
  );
}

/**
 * Decide which details to collect in-chat before calling /api/plan.
 * Follow-ups reuse session budget unless the prompt asks to change it.
 */
export function detectMissingDetails(
  prompt: string,
  opts: {
    isFollowUp?: boolean;
    sessionBudgetLkr?: number;
    memoryBudgetLkr?: number;
    familyCount?: number;
  } = {}
): ClarificationField[] {
  const fields: ClarificationField[] = [];
  const trimmed = prompt.trim();
  if (!trimmed) return fields;

  const budgetInPrompt = extractBudgetFromPrompt(trimmed);
  const wantsBudgetChange =
    opts.isFollowUp && /\b(budget|cheaper|more expensive|spend less|spend more)\b/i.test(trimmed);

  const needBudget =
    isBudgetSensitive(trimmed) &&
    !budgetInPrompt &&
    (!opts.isFollowUp || wantsBudgetChange || !opts.sessionBudgetLkr);

  if (needBudget) {
    const memory = opts.memoryBudgetLkr && opts.memoryBudgetLkr > 0 ? opts.memoryBudgetLkr : null;
    const options: ClarificationOption[] = [
      { label: 'LKR 3,000', value: 3000 },
      { label: 'LKR 5,000', value: 5000 },
      { label: 'LKR 8,000', value: 8000 },
    ];
    if (memory && !options.some((o) => o.value === memory)) {
      options.unshift({ label: `Usual · LKR ${memory.toLocaleString()}`, value: memory });
    } else if (memory) {
      const idx = options.findIndex((o) => o.value === memory);
      if (idx >= 0) options[idx] = { label: `Usual · LKR ${memory.toLocaleString()}`, value: memory };
    }

    fields.push({
      id: 'budget',
      question: 'What is your budget for this plan?',
      options,
      allowCustom: true,
      customPlaceholder: 'e.g. 4500',
      unit: 'LKR',
    });
  }

  const servingsInPrompt = extractServingsFromPrompt(trimmed);
  const hasFamily = (opts.familyCount ?? 0) > 0;
  if (isMealIntent(trimmed) && !servingsInPrompt && !hasFamily && !opts.isFollowUp) {
    fields.push({
      id: 'servings',
      question: 'How many people should we plan for?',
      options: [
        { label: 'Just me', value: 1 },
        { label: '2 people', value: 2 },
        { label: '4 people', value: 4 },
      ],
      allowCustom: true,
      customPlaceholder: 'e.g. 3',
      unit: 'people',
    });
  }

  const daysInPrompt = extractDaysFromPrompt(trimmed);
  if (isMultiDayPlan(trimmed) && !daysInPrompt && !opts.isFollowUp) {
    fields.push({
      id: 'days',
      question: 'How many days should we cover?',
      options: [
        { label: '3 days', value: 3 },
        { label: '5 days', value: 5 },
        { label: '7 days', value: 7 },
      ],
      allowCustom: true,
      customPlaceholder: 'e.g. 4',
      unit: 'days',
    });
  }

  return fields;
}

/** Merge clarification answers into the prompt so agents see them explicitly. */
export function applyClarificationAnswers(
  prompt: string,
  answers: Partial<Record<ClarificationFieldId, number>>
): { enrichedPrompt: string; budgetLkr?: number } {
  const extras: string[] = [];
  let budgetLkr: number | undefined;

  if (answers.budget && answers.budget > 0) {
    budgetLkr = answers.budget;
    if (!extractBudgetFromPrompt(prompt)) {
      extras.push(`budget LKR ${answers.budget}`);
    }
  }
  if (answers.servings && answers.servings > 0 && !extractServingsFromPrompt(prompt)) {
    extras.push(`for ${answers.servings} people`);
  }
  if (answers.days && answers.days > 0 && !extractDaysFromPrompt(prompt)) {
    extras.push(`for ${answers.days} days`);
  }

  const enrichedPrompt = extras.length ? `${prompt.trim()} (${extras.join(', ')})` : prompt.trim();
  return { enrichedPrompt, budgetLkr };
}
