export interface InventoryItem {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  expiryDays: number;
  weatherExpiryDays?: number; // adjusted expiry based on climate
  lastAdded: string; // ISO String
}

export interface FamilyMember {
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
}

export interface WeatherCondition {
  condition: 'monsoon' | 'rainy' | 'sunny' | 'humid';
  temperature: number;
  rainMm: number;
  spoilageModifier: number; // multiplier for expiry (e.g., 0.5 for monsoon)
}

export interface TrafficCondition {
  route: string;
  status: 'clear' | 'congested' | 'blocked';
  estimatedTimeMin: number;
  fuelAdjustedCostLkr: number;
  alternativeRoute?: string;
  alternativeTimeMin?: number;
}

export interface CrisisAlert {
  type: 'none' | 'flood' | 'storm' | 'strike';
  severity: 'none' | 'low' | 'medium' | 'high';
  affectedAreas: string[];
  expectedDurationDays: number;
  warningText: string;
}

export interface Recipe {
  id: string;
  name: string;
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
  agentName: string;
  status: 'pending' | 'active' | 'success' | 'warn';
  message: string;
  details?: any;
}

export interface MealPlanResponse {
  recipes: Recipe[];
  shoppingList: ShoppingListItem[];
  totalBudgetSpent: number;
  savingsVsSingleStore: number;
  inventorySavings: number;
  cookingSchedulerReason: string;
  orchestratorSummary: string;
}
