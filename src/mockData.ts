import { InventoryItem, FamilyMember, StorePrice, WeatherCondition, TrafficCondition, CrisisAlert, Recipe, ShoppingListItem } from './types';

export const initialInventory: InventoryItem[] = [
  { id: '1', item: 'White Rice', quantity: 500, unit: 'g', expiryDays: 30, lastAdded: '2026-06-18' },
  { id: '2', item: 'Fresh Tomatoes', quantity: 2, unit: 'pcs', expiryDays: 7, lastAdded: '2026-06-19' },
  { id: '3', item: 'Mysoor Dhal', quantity: 1000, unit: 'g', expiryDays: 60, lastAdded: '2026-06-15' },
  { id: '4', item: 'Red Onions', quantity: 4, unit: 'pcs', expiryDays: 14, lastAdded: '2026-06-17' },
  { id: '5', item: 'Fresh Sea Fish', quantity: 200, unit: 'g', expiryDays: 2, lastAdded: '2026-06-20' },
  { id: '6', item: 'Farm Eggs', quantity: 6, unit: 'pcs', expiryDays: 12, lastAdded: '2026-06-19' },
  { id: '7', item: 'Coconut Oil', quantity: 500, unit: 'ml', expiryDays: 180, lastAdded: '2026-06-10' },
];

export const initialFamily: FamilyMember[] = [
  {
    name: 'Nisha',
    age: 38,
    preferences: ['Vegetables', 'Dhal Curries', 'Low sugar', 'Organic'],
    allergies: ['Shellfish'],
    dietaryRestrictions: ['diabetic-friendly', 'low-carb'],
    favoriteIngredients: ['dhal', 'vegetables', 'eggs'],
    schedule: {
      workHours: '06:00 - 10:00',
      freeHours: '10:00 - 18:00, 20:00 - 22:00',
      cookingAvailability: true,
      cookingSkill: 'high'
    }
  },
  {
    name: 'Raj',
    age: 42,
    preferences: ['Spicy food', 'Meat dishes', 'Pol Sambol', 'Fried Rice'],
    allergies: [],
    dietaryRestrictions: [],
    favoriteIngredients: ['chicken', 'fish', 'onions'],
    schedule: {
      workHours: '09:00 - 18:00',
      freeHours: '18:00 - 21:00',
      cookingAvailability: true,
      cookingSkill: 'medium'
    }
  },
  {
    name: 'Kids (Saman & Maya)',
    age: 10,
    preferences: ['No spicy', 'Creamy dishes', 'Mild taste', 'Eggs', 'Potatoes'],
    allergies: [],
    dietaryRestrictions: [],
    favoriteIngredients: ['egg', 'chicken', 'potatoes', 'milk'],
    schedule: {
      workHours: 'School 08:00 - 15:00',
      freeHours: '15:00 - 20:00',
      cookingAvailability: false,
      cookingSkill: 'low'
    }
  }
];

export const initialPrices: StorePrice[] = [
  { itemName: 'White Rice', keellsPrice: 240, cargillsPrice: 235, polaPrice: 220, unit: 'per kg' },
  { itemName: 'Fresh Tomatoes', keellsPrice: 380, cargillsPrice: 395, polaPrice: 320, unit: 'per kg' },
  { itemName: 'Mysoor Dhal', keellsPrice: 420, cargillsPrice: 410, polaPrice: 390, unit: 'per kg' },
  { itemName: 'Red Onions', keellsPrice: 480, cargillsPrice: 490, polaPrice: 410, unit: 'per kg' },
  { itemName: 'Sea Fish (Tuna)', keellsPrice: 1800, cargillsPrice: 1850, polaPrice: 1650, unit: 'per kg' },
  { itemName: 'Farm Eggs', keellsPrice: 42, cargillsPrice: 45, polaPrice: 38, unit: 'per item' },
  { itemName: 'Chicken Breast', keellsPrice: 1450, cargillsPrice: 1400, polaPrice: 1350, unit: 'per kg' },
  { itemName: 'Coconut Oil', keellsPrice: 650, cargillsPrice: 660, polaPrice: 600, unit: 'per Litre' },
  { itemName: 'Green Chillies', keellsPrice: 900, cargillsPrice: 950, polaPrice: 750, unit: 'per kg' },
  { itemName: 'Carrots', keellsPrice: 450, cargillsPrice: 480, polaPrice: 380, unit: 'per kg' },
];

export const initialWeather: WeatherCondition = {
  condition: 'monsoon',
  temperature: 28,
  rainMm: 18,
  spoilageModifier: 0.5 // High humidity spoils tomatoes & leafy greens 50% faster!
};

export const initialTraffic: TrafficCondition = {
  route: 'Ratmalana (Home) ➔ Colombo 7 Supermarkets',
  status: 'congested',
  estimatedTimeMin: 95,
  fuelAdjustedCostLkr: 680,
  alternativeRoute: 'Ratmalana Road via Attidiya ➔ Cargills Battaramulla',
  alternativeTimeMin: 35
};

export const initialCrisis: CrisisAlert = {
  type: 'flood',
  severity: 'high',
  affectedAreas: ['Colombo 7', 'Thalawathugoda', 'Low lying parts of Ratmalana'],
  expectedDurationDays: 3,
  warningText: 'Active monsoon flooding around key low-lying roads. Keells route highly congested & partly flooded. Secure emergency grocery reserves now!'
};

export const initialRecipes: Recipe[] = [
  {
    id: 'rec_1',
    name: 'Standard Dhal Curry & Red Unpolished Rice',
    prepTimeMin: 15,
    cookTimeMin: 20,
    assignedCook: 'Raj',
    reasonForSelection: 'Highly nutritional, extremely low sugar index suited for diabetic-friendly menu (Nisha), and uses existing 500g home rice + 1kg dhal, reducing grocery purchases down to LKR 0 for rice and dhal!',
    dietaryTags: ['Diabetic-Friendly', 'Vegetarian', 'High Protein', 'No Seafood'],
    nutritionalInfo: { calories: 380, protein: '14g', sugar: '1.2g', fat: '4.5g' },
    ingredients: [
      { name: 'White Rice', amount: 350, unit: 'g', source: 'inventory' },
      { name: 'Mysoor Dhal', amount: 200, unit: 'g', source: 'inventory' },
      { name: 'Red Onions', amount: 2, unit: 'pcs', source: 'inventory' },
      { name: 'Coconut Oil', amount: 15, unit: 'ml', source: 'inventory' }
    ],
    instructions: [
      'Wash unpolished rice thrice and boil on a medium flame with 2:1 water ratio until cooked.',
      'Sauté chopped red onions and curry leaves in warm coconut oil.',
      'Mix dhal with water, turmeric, and fenugreek seeds, boiling until soft.',
      'Pour tempered onions into the boiled dhal, add coconut milk, and simmer for 5 minutes.'
    ]
  },
  {
    id: 'rec_2',
    name: 'Sri Lankan Roasted Chicken with Tomato & Onion Sauté',
    prepTimeMin: 20,
    cookTimeMin: 30,
    assignedCook: 'Nisha',
    reasonForSelection: 'Nisha is available from 10:00 to 18:00. This handles Raj’s need for meat, and uses local Pola-sourced chicken and onions to minimize pricing. Avoids fish.',
    dietaryTags: ['Diabetic-Friendly', 'High Protein', 'No Seafood', 'Low Carb'],
    nutritionalInfo: { calories: 450, protein: '38g', sugar: '0.8g', fat: '12g' },
    ingredients: [
      { name: 'Chicken Breast', amount: 500, unit: 'g', source: 'shopping' },
      { name: 'Fresh Tomatoes', amount: 2, unit: 'pcs', source: 'inventory' },
      { name: 'Red Onions', amount: 2, unit: 'pcs', source: 'inventory' },
      { name: 'Coconut Oil', amount: 20, unit: 'ml', source: 'inventory' }
    ],
    instructions: [
      'Marinate chicken pieces with Jaffna curry powder, salt, lime, and black pepper for 15 minutes.',
      'Heat coconut oil in a pan and shallow-fry chicken until golden brown.',
      'In the same pan, toss sliced red onions and chopped fresh tomatoes, sautéing for 3 minutes on high heat.',
      'Serve warm alongside the dhal and unpolished rice.'
    ]
  },
  {
    id: 'rec_3',
    name: 'Sri Lankan Creamy Egg Curry with Mild Spices',
    prepTimeMin: 10,
    cookTimeMin: 15,
    assignedCook: 'Raj',
    reasonForSelection: 'Perfect recipe for the kids (Saman & Maya love eggs, no spicy) and uses eggs from home inventory. Easy preparation by Raj after office hours.',
    dietaryTags: ['Kids Favourite', 'Vegetarian', 'Diabetic-Friendly', 'No Seafood'],
    nutritionalInfo: { calories: 290, protein: '12g', sugar: '1.4g', fat: '18g' },
    ingredients: [
      { name: 'Farm Eggs', amount: 4, unit: 'pcs', source: 'inventory' },
      { name: 'Red Onions', amount: 1, unit: 'pcs', source: 'inventory' },
      { name: 'Coconut Oil', amount: 10, unit: 'ml', source: 'inventory' }
    ],
    instructions: [
      'Boil and peel farm eggs, making small vertical slits around them.',
      'Sauté minced onions and a pinch of fenugreek in coconut oil.',
      'Add light coconut milk, turmeric, and a tiny pinch of unroasted curry powder for color and aroma, avoiding red chillies.',
      'Gently place eggs into the curry and simmer on low for 8 minutes.'
    ]
  },
  {
    id: 'rec_4',
    name: 'High Protein Hot Lentil & Carrot Stew',
    prepTimeMin: 15,
    cookTimeMin: 25,
    assignedCook: 'Nisha',
    reasonForSelection: 'Suggested for monsoon weather. A warm, reassuring stew that keeps active monsoon bodies cozy and warm. Completely fish-free for Nisha.',
    dietaryTags: ['Monsoon Special', 'Diabetic-Friendly', 'Vegetarian', 'Warm Stew'],
    nutritionalInfo: { calories: 210, protein: '11g', sugar: '3g', fat: '3g' },
    ingredients: [
      { name: 'Mysoor Dhal', amount: 200, unit: 'g', source: 'inventory' },
      { name: 'Carrots', amount: 250, unit: 'g', source: 'shopping' },
      { name: 'Red Onions', amount: 1, unit: 'pcs', source: 'inventory' }
    ],
    instructions: [
      'Simmer dhal in water with turmeric and minced ginger until thick and soft.',
      'Add sliced carrots and onions to the stew, cook for another 12 minutes.',
      'Season with black pepper and a squeeze of lime before serving.'
    ]
  }
];

export const initialShoppingList: ShoppingListItem[] = [
  { item: 'Chicken Breast', requiredQty: 500, unit: 'g', store: 'Cargills', unitPrice: 1.4, totalPrice: 700, spoilageRisk: 'low' },
  { item: 'Carrots', requiredQty: 250, unit: 'g', store: 'Pola', unitPrice: 0.38, totalPrice: 95, spoilageRisk: 'medium' },
  { item: 'White Rice', requiredQty: 500, unit: 'g', store: 'Pola', unitPrice: 0.22, totalPrice: 110, spoilageRisk: 'low' },
];
