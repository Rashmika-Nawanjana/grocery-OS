import {
  isCrisisNewsQuestion,
  isEnvironmentOnlyQuestion,
  isMealIntent,
  isWeatherQuestion,
} from '@/lib/orchestrator/intent';
import {
  isDineOutIntent,
  isPreparedFoodOrderIntent,
  normalizeOrderTypos,
} from '@/lib/orchestrator/meal-intent';
import { isPriceLookupRequest } from '@/lib/agents/price-query';

export type MealMode = 'cook_pantry' | 'cook_shop' | 'order' | 'eat_out';
export type CookEffort = 'quick' | 'normal';

export type ClarificationFieldId = 'budget' | 'servings' | 'days' | 'mealMode' | 'cookEffort';

export type ClarificationAnswerValue = number | string;

export interface ClarificationOption {
  label: string;
  value: ClarificationAnswerValue;
}

export interface ClarificationField {
  id: ClarificationFieldId;
  kind: 'choice' | 'number';
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

export interface ClarificationContext {
  mealMode?: MealMode;
  cookEffort?: CookEffort;
  budgetLkr?: number;
}

export type ClarificationAnswers = Partial<Record<ClarificationFieldId, ClarificationAnswerValue>>;

const MEAL_MODES: MealMode[] = ['cook_pantry', 'cook_shop', 'order', 'eat_out'];
const COOK_EFFORTS: CookEffort[] = ['quick', 'normal'];

function isMealMode(v: unknown): v is MealMode {
  return typeof v === 'string' && (MEAL_MODES as string[]).includes(v);
}

function isCookEffort(v: unknown): v is CookEffort {
  return typeof v === 'string' && (COOK_EFFORTS as string[]).includes(v);
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

function extractCookEffortFromPrompt(prompt: string): CookEffort | null {
  const lower = normalizeOrderTypos(prompt);
  if (/\b(quick|fast|20\s*min|under\s*30|simple|easy|no time|in a hurry)\b/i.test(lower)) return 'quick';
  if (/\b(elaborate|proper|full meal|take (my|our) time|normal cook)\b/i.test(lower)) return 'normal';
  return null;
}

/**
 * Infer meal mode from free text. Returns null when the user has not chosen
 * how they want dinner (open-ended “what should I eat”).
 */
export function extractMealModeFromPrompt(prompt: string): MealMode | null {
  const lower = normalizeOrderTypos(prompt);

  if (isPreparedFoodOrderIntent(prompt)) return 'order';

  if (
    /\b(eat\s*out|dine\s*out|restaurant|restaurants|takeaway|food\s*spot)\b/i.test(lower) ||
    (/\b(pickme|uber\s*eats)\b/i.test(lower) && !/\bingredients?\b/i.test(lower))
  ) {
    return 'eat_out';
  }

  if (
    /\b(want to|gonna|going to|plan to|I'd like to|i want to)\s+order\b/i.test(lower) ||
    (/\border\b/i.test(lower) &&
      /\b(tonight|dinner|lunch|food|meal|delivery)\b/i.test(lower) &&
      !/\b(ingredients|grocery|supermarket)\b/i.test(lower))
  ) {
    return 'order';
  }

  if (
    /\b(after (doing )?(some )?grocery shopping|shop (first|then)|buy (groceries|ingredients) then|grocery shopping then)\b/i.test(
      lower
    ) ||
    (/\b(shop|shopping|buy groceries|stock up)\b/i.test(lower) &&
      /\b(cook|make|dinner|meal)\b/i.test(lower) &&
      !/\border\b/i.test(lower))
  ) {
    return 'cook_shop';
  }

  if (
    /\b(considering what i have|based on (my|our) (pantry|inventory|home)|from (home|pantry)|use (home|pantry|what we have|what i have)|cook with what|pantry[- ]only)\b/i.test(
      lower
    )
  ) {
    return 'cook_pantry';
  }

  if (
    /\b(cook|make|prepare)\b/i.test(lower) &&
    !/\border\b/i.test(lower) &&
    !/\b(eat\s*out|restaurant)\b/i.test(lower)
  ) {
    if (/\b(shop|shopping|buy|grocery)\b/i.test(lower)) return 'cook_shop';
    return 'cook_pantry';
  }

  return null;
}

function mealModeField(): ClarificationField {
  return {
    id: 'mealMode',
    kind: 'choice',
    question: 'How do you want dinner tonight?',
    options: [
      { label: 'Cook with what we have', value: 'cook_pantry' },
      { label: 'Order in', value: 'order' },
      { label: 'Eat out', value: 'eat_out' },
      { label: 'Shop groceries then cook', value: 'cook_shop' },
    ],
    allowCustom: false,
  };
}

function cookEffortField(): ClarificationField {
  return {
    id: 'cookEffort',
    kind: 'choice',
    question: 'How much time do you have to cook?',
    options: [
      { label: 'Quick (~20 min)', value: 'quick' },
      { label: 'Normal', value: 'normal' },
    ],
    allowCustom: false,
  };
}

function resolveMealMode(
  prompt: string,
  answers?: ClarificationAnswers
): MealMode | null {
  return extractMealModeFromPrompt(prompt) ?? (isMealMode(answers?.mealMode) ? answers!.mealMode : null);
}

function needsMealModeQuestion(prompt: string, opts: { isFollowUp?: boolean }): boolean {
  if (isPriceLookupRequest(prompt)) return false;
  if (isEnvironmentOnlyQuestion(prompt) && !isMealIntent(prompt)) return false;
  if (extractMealModeFromPrompt(prompt)) return false;
  if (!isMealIntent(prompt)) return false;
  // Follow-ups that already imply mode (order this, shop for that) skip.
  if (opts.isFollowUp && !/\b(what (should|do|can) (i|we) eat|suggest|idea|tonight|dinner|hungry)\b/i.test(prompt)) {
    return false;
  }
  return true;
}

/**
 * Decide which details to collect in-chat before calling /api/plan.
 * Pass `answers` to branch the tree after the user picks a meal mode.
 */
export function detectMissingDetails(
  prompt: string,
  opts: {
    isFollowUp?: boolean;
    sessionBudgetLkr?: number;
    memoryBudgetLkr?: number;
    familyCount?: number;
    answers?: ClarificationAnswers;
  } = {}
): ClarificationField[] {
  const fields: ClarificationField[] = [];
  const trimmed = prompt.trim();
  if (!trimmed) return fields;

  const answers = opts.answers ?? {};

  if (needsMealModeQuestion(trimmed, opts) && !isMealMode(answers.mealMode)) {
    fields.push(mealModeField());
    return fields;
  }

  const mealMode = resolveMealMode(trimmed, answers);

  if (mealMode === 'cook_pantry' || mealMode === 'cook_shop') {
    const effort = extractCookEffortFromPrompt(trimmed) ?? (isCookEffort(answers.cookEffort) ? answers.cookEffort : null);
    if (!effort && !opts.isFollowUp) {
      fields.push(cookEffortField());
      return fields;
    }
  }

  const budgetInPrompt = extractBudgetFromPrompt(trimmed);
  const wantsBudgetChange =
    opts.isFollowUp && /\b(budget|cheaper|more expensive|spend less|spend more)\b/i.test(trimmed);

  const needBudget =
    isBudgetSensitive(trimmed) &&
    !budgetInPrompt &&
    typeof answers.budget !== 'number' &&
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
      kind: 'number',
      question: 'What is your budget for this plan?',
      options,
      allowCustom: true,
      customPlaceholder: 'e.g. 4500',
      unit: 'LKR',
    });
    return fields;
  }

  const servingsInPrompt = extractServingsFromPrompt(trimmed);
  const hasFamily = (opts.familyCount ?? 0) > 0;
  if (
    isMealIntent(trimmed) &&
    !servingsInPrompt &&
    !hasFamily &&
    !opts.isFollowUp &&
    typeof answers.servings !== 'number'
  ) {
    fields.push({
      id: 'servings',
      kind: 'number',
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
    return fields;
  }

  const daysInPrompt = extractDaysFromPrompt(trimmed);
  if (isMultiDayPlan(trimmed) && !daysInPrompt && !opts.isFollowUp && typeof answers.days !== 'number') {
    fields.push({
      id: 'days',
      kind: 'number',
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
    return fields;
  }

  return fields;
}

/** True when every currently-required field has a valid answer. */
export function clarificationComplete(
  fields: ClarificationField[],
  answers: ClarificationAnswers
): boolean {
  return fields.every((f) => {
    const v = answers[f.id];
    if (f.kind === 'choice') return typeof v === 'string' && v.length > 0;
    return typeof v === 'number' && v > 0;
  });
}

/** Merge clarification answers into the prompt so agents see them explicitly. */
export function applyClarificationAnswers(
  prompt: string,
  answers: ClarificationAnswers
): { enrichedPrompt: string; budgetLkr?: number; clarificationContext: ClarificationContext } {
  const extras: string[] = [];
  let budgetLkr: number | undefined;
  const clarificationContext: ClarificationContext = {};

  const mealMode = resolveMealMode(prompt, answers);
  if (mealMode) {
    clarificationContext.mealMode = mealMode;
    const modePhrases: Record<MealMode, string> = {
      cook_pantry: 'use pantry / cook with what we have at home',
      cook_shop: 'grocery shopping then cook',
      order: 'order delivery prepared food',
      eat_out: 'eat out restaurants nearby',
    };
    if (!extractMealModeFromPrompt(prompt)) {
      extras.push(modePhrases[mealMode]);
    }
  }

  const cookEffort =
    extractCookEffortFromPrompt(prompt) ?? (isCookEffort(answers.cookEffort) ? answers.cookEffort : undefined);
  if (cookEffort) {
    clarificationContext.cookEffort = cookEffort;
    if (!extractCookEffortFromPrompt(prompt)) {
      extras.push(cookEffort === 'quick' ? 'quick meal under 20 minutes' : 'normal cook time');
    }
  }

  if (typeof answers.budget === 'number' && answers.budget > 0) {
    budgetLkr = answers.budget;
    clarificationContext.budgetLkr = answers.budget;
    if (!extractBudgetFromPrompt(prompt)) {
      extras.push(`budget LKR ${answers.budget}`);
    }
  }
  if (typeof answers.servings === 'number' && answers.servings > 0 && !extractServingsFromPrompt(prompt)) {
    extras.push(`for ${answers.servings} people`);
  }
  if (typeof answers.days === 'number' && answers.days > 0 && !extractDaysFromPrompt(prompt)) {
    extras.push(`for ${answers.days} days`);
  }

  const enrichedPrompt = extras.length ? `${prompt.trim()} (${extras.join(', ')})` : prompt.trim();
  return { enrichedPrompt, budgetLkr, clarificationContext };
}
