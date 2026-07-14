export interface InventoryItem {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  expiryDays: number;
  weatherExpiryDays?: number;
  lastAdded: string;
}

export interface FamilyMember {
  id?: string;
  name: string;
  age: number;
  preferences: string[];
  allergies: string[];
  dietaryRestrictions: string[];
  favoriteIngredients: string[];
  schedule: {
    workHours: string;
    freeHours: string;
    cookingAvailability: boolean;
    cookingSkill: 'high' | 'medium' | 'low';
  };
}

export interface StorePrice {
  itemName: string;
  keellsPrice: number;
  cargillsPrice: number;
  polaPrice: number;
  unit: string;
  sourceType?: 'catalog' | 'serpapi' | 'firecrawl' | 'estimate' | 'store_crawl' | 'pola_wholesale' | 'unavailable';
  sourceUrl?: string;
  storeSources?: {
    keells?: { price: number; url: string; provider: string };
    cargills?: { price: number; url: string; provider: string };
    pola?: { price: number; url: string; provider: string; note?: string };
  };
}

export interface DataSource {
  agentId: string;
  agentName: string;
  label: string;
  url?: string;
  kind: 'api' | 'database' | 'catalog' | 'ai' | 'scrape';
}

export interface WeatherCondition {
  condition: 'monsoon' | 'rainy' | 'sunny' | 'humid';
  temperature: number;
  rainMm: number;
  humidity?: number;
  spoilageModifier: number;
  forecast?: { date: string; condition: string; rainMm: number }[];
  location?: string;
  /** Whether readings came from OpenWeatherMap or offline placeholder. */
  source?: 'openweather' | 'fallback' | 'placeholder';
  fetchedAt?: string;
}

export interface TrafficCondition {
  route: string;
  status: 'clear' | 'congested' | 'blocked';
  estimatedTimeMin: number;
  fuelAdjustedCostLkr: number;
  alternativeRoute?: string;
  alternativeTimeMin?: number;
  recommendedStore?: string;
}

export interface CrisisAlert {
  type: 'none' | 'flood' | 'storm' | 'strike';
  severity: 'none' | 'low' | 'medium' | 'high';
  affectedAreas: string[];
  expectedDurationDays: number;
  warningText: string;
  newsHeadlines?: string[];
  shoppingRecommendation?: {
    action: string;
    items: string[];
    urgency: 'immediate' | 'tomorrow' | 'normal';
  };
  /** Whether headlines came from NewsAPI or offline placeholder. */
  source?: 'newsapi' | 'unconfigured' | 'error' | 'placeholder';
  fetchedAt?: string;
}

export interface Recipe {
  id: string;
  name: string;
  /** TheMealDB (or other) thumbnail URL when available. */
  imageUrl?: string;
  /** Source page when recipe came from Google / web scrape. */
  sourceUrl?: string;
  ingredients: { name: string; amount: number; unit: string; source: 'inventory' | 'shopping' }[];
  instructions: string[];
  prepTimeMin: number;
  cookTimeMin: number;
  assignedCook: string;
  reasonForSelection: string;
  dietaryTags: string[];
  nutritionalInfo: { calories: number; protein: string; sugar: string; fat: string };
}

export interface ShoppingListItem {
  item: string;
  requiredQty: number;
  unit: string;
  store: 'Keells' | 'Cargills' | 'Pola';
  unitPrice: number;
  totalPrice: number;
  spoilageRisk: 'low' | 'medium' | 'high';
}

export interface AgentExecutionLog {
  agentId: string;
  agentName: string;
  status: 'pending' | 'active' | 'success' | 'warn' | 'skipped';
  message: string;
  details?: unknown;
}

export interface MealRoutineMeta {
  mealName: string;
  daysPlanned: number;
  hasFridge: boolean;
  shoppingTrips: { when: string; items: string; reason: string }[];
  weeklyCostEstimateLkr: number;
  tips: string[];
}

export interface PlanComparisonMeta {
  variantLabel: string;
  previousLabel: string;
  previousTotalLkr: number;
  newTotalLkr: number;
  savingsLkr: number;
  daysPlanned: number;
}

/** Google Maps / local business from SerpAPI (restaurants, cafes, etc.). */
export interface LocalBusiness {
  name: string;
  rating?: number;
  reviewCount?: number;
  priceLabel?: string;
  priceMinLkr?: number;
  priceMaxLkr?: number;
  category?: string;
  address?: string;
  openState?: string;
  phone?: string;
  website?: string;
  thumbnailUrl?: string;
  services?: string[];
  placeId?: string;
  mapsUrl: string;
  sourceUrl?: string;
  rank: number;
}

export interface MealPlanResponse {
  recipes: Recipe[];
  shoppingList: ShoppingListItem[];
  totalBudgetSpent: number;
  savingsVsSingleStore: number;
  inventorySavings: number;
  cookingSchedulerReason: string;
  orchestratorSummary: string;
  mealRoutineMeta?: MealRoutineMeta;
  planComparisonMeta?: PlanComparisonMeta;
  budgetDecision?: BudgetDecisionMeta;
  planCuration?: PlanCurationMeta;
  outputMode?: 'meal_plan' | 'grocery_order' | 'dine_out' | 'price_lookup';
  contextDish?: string;
  localBusinesses?: import('@/lib/types').LocalBusiness[];
  placesQuery?: string;
}

export interface PlanCurationMeta {
  primaryAction: 'order_out' | 'cook_at_home' | 'grocery_shop' | 'pantry_only';
  mealPeriod: 'breakfast' | 'lunch' | 'dinner';
  weatherContext: string;
  showCount: number;
  hiddenCount: number;
  recipeRankings: {
    name: string;
    shopCostLkr: number;
    homeCount: number;
    score: number;
    included: boolean;
    reason: string;
  }[];
  headline: string;
}

export interface BudgetDecisionMeta {
  recommendation: 'cook_at_home' | 'order_out' | 'pantry_meal' | 'trim_shopping';
  headline: string;
  reason: string;
  groceryTotalLkr: number;
  budgetLkr: number;
  overByLkr: number;
  spendRatio: number;
  tips: string[];
  affordablePlaces?: {
    name: string;
    priceLabel?: string;
    priceMinLkr?: number;
    priceMaxLkr?: number;
    mapsUrl: string;
    rating?: number;
  }[];
}

export type UserScenario = 'decided_menu' | 'needs_suggestions' | 'shopping_trip';

export interface SpoilageAlert {
  item: string;
  normalExpiryDays: number;
  weatherExpiryDays: number;
  warning: string;
  buyRecommendation: string;
  quantity?: number;
  unit?: string;
  inPantry?: boolean;
}

export interface DietaryScreenResult {
  item: string;
  status: 'pass' | 'warn' | 'fail';
  glycemicIndex: number | null;
  glycemicLoad: number | null;
  allergenWarnings: string[];
  restrictionWarnings: string[];
  description: string;
  source: 'family_db' | 'memory' | 'openfoodfacts' | 'inferred';
  matchedMembers: string[];
}

export interface DietaryVerdict {
  approved: boolean;
  blockedItems: string[];
  warnings: string[];
  memberNotes: string[];
}

export interface UserMemorySnapshot {
  defaultBudgetLkr: number;
  preferredStores: string[];
  homeArea: string;
  entries: {
    id: string;
    category: 'preference' | 'dietary' | 'store' | 'budget' | 'location' | 'dish' | 'avoid' | 'fact' | 'meal_role';
    key: string;
    value: string;
    source: 'user' | 'inferred' | 'system';
    confidence: number;
    createdAt: string;
    updatedAt: string;
  }[];
}

export interface OrchestrationRequest {
  prompt: string;
  isFollowUp?: boolean;
  budgetLkr?: number;
  inventory?: InventoryItem[];
  family?: FamilyMember[];
  /** Authenticated user — enables vector inventory RAG RPC. */
  userId?: string;
  previousScenario?: UserScenario;
  /** Prior turns in this session — used for follow-up context. */
  conversationHistory?: { role: 'user' | 'assistant'; text: string }[];
  /** Recipes from the previous turn — reused for order/shop follow-ups. */
  previousRecipes?: Recipe[];
  /** Prior turn meal plan — used for routine comparison follow-ups (e.g. jam-only savings). */
  previousMealPlan?: Pick<MealPlanResponse, 'totalBudgetSpent' | 'shoppingList' | 'mealRoutineMeta' | 'recipes'>;
  /** Persistent user preferences and learned knowledge. */
  memory?: UserMemorySnapshot;
  /** Structured answers from the pre-plan decision tree (cook / order / eat out / shop). */
  clarificationContext?: {
    mealMode?: 'cook_pantry' | 'cook_shop' | 'order' | 'eat_out';
    cookEffort?: 'quick' | 'normal';
    budgetLkr?: number;
  };
}

export interface OrchestrationResult {
  success: boolean;
  scenario: UserScenario;
  agentsRun: string[];
  logs: AgentExecutionLog[];
  data: MealPlanResponse;
  weather: WeatherCondition;
  traffic: TrafficCondition;
  crisis: CrisisAlert;
  prices: StorePrice[];
  spoilageAlerts: SpoilageAlert[];
  dietaryVerdict?: DietaryVerdict;
  warning?: string;
  sources?: DataSource[];
  /** Updated persistent memory after this turn (if memory was loaded). */
  updatedMemory?: UserMemorySnapshot;
  /** Google Maps local results when user asks about restaurants / eat out / nearby places. */
  localBusinesses?: LocalBusiness[];
  placesQuery?: string;
  /** Meal cook/buy roles resolved this turn — used for memory learning. */
  mealComponents?: {
    name: string;
    role: 'cook' | 'buy_ready' | 'ingredient';
    reason: string;
  }[];
}

export interface AgentContext {
  prompt: string;
  /** Raw user message (without memory/history wrapper). */
  userPrompt?: string;
  scenario: UserScenario;
  budgetLkr: number;
  inventory: InventoryItem[];
  /** Ranked pantry subset for prompts — matching still uses full `inventory`. */
  relevantPantry?: InventoryItem[];
  /** Supabase user id for vector RAG lookups. */
  userId?: string;
  family: FamilyMember[];
  decidedItems?: string[];
  recipeNames?: string[];
  conversationHistory?: { role: 'user' | 'assistant'; text: string }[];
  previousRecipes?: Recipe[];
  isFollowUp?: boolean;
  memoryContext?: string;
  previousMealPlan?: Pick<MealPlanResponse, 'totalBudgetSpent' | 'shoppingList' | 'mealRoutineMeta' | 'recipes'>;
  memoryEntries?: UserMemorySnapshot['entries'];
  mealMode?: 'cook_pantry' | 'cook_shop' | 'order' | 'eat_out';
  cookEffort?: 'quick' | 'normal';
  /** Parsed cook-vs-buy roles for the meal (e.g. cook dhal, buy bread). */
  mealComponents?: {
    name: string;
    role: 'cook' | 'buy_ready' | 'ingredient';
    reason: string;
    buyQty?: number;
    buyUnit?: string;
  }[];
  /** Recently liked dishes from memory — bias recipe selection. */
  likedDishes?: string[];
  /** Preferred stores from memory — bias shopping list. */
  preferredStores?: string[];
}

export interface MiroFishWorkflowStep {
  phase: 'seed' | 'graph' | 'simulation' | 'report';
  label: string;
  message: string;
}

export interface MiroFishConfidenceSignal {
  metric: string;
  value: number;
  ciLower: number;
  ciUpper: number;
  unit: string;
  interpretation: string;
}

export interface MiroFishSimulationRequest {
  prompt: string;
}

export interface MiroFishSimulationResult {
  success: boolean;
  answer: string;
  promptInterpretation: string;
  workflowSteps: MiroFishWorkflowStep[];
  simulationSteps: string[];
  confidenceSignals?: MiroFishConfidenceSignal[];
  source?: 'live' | 'gemini' | 'local';
  warning?: string;
  error?: string;
}
