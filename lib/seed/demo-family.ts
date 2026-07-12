import type { FamilyMember } from '@/lib/types';

/** Demo household seed — only inserted via explicit POST /api/data, not used by agents at runtime. */
export const DEMO_FAMILY_SEED: Omit<FamilyMember, 'id'>[] = [
  {
    name: 'Nisha',
    age: 38,
    preferences: ['Vegetables', 'Dhal Curries', 'Low sugar'],
    allergies: ['Shellfish'],
    dietaryRestrictions: ['diabetic-friendly', 'low-carb'],
    favoriteIngredients: ['dhal', 'vegetables', 'eggs'],
    schedule: { workHours: '06:00 - 10:00', freeHours: '10:00 - 18:00', cookingAvailability: true, cookingSkill: 'high' },
  },
  {
    name: 'Raj',
    age: 42,
    preferences: ['Spicy food', 'Meat dishes'],
    allergies: [],
    dietaryRestrictions: [],
    favoriteIngredients: ['chicken', 'onions'],
    schedule: { workHours: '09:00 - 18:00', freeHours: '18:00 - 21:00', cookingAvailability: true, cookingSkill: 'medium' },
  },
  {
    name: 'Kids',
    age: 10,
    preferences: ['No spicy', 'Mild taste', 'Eggs'],
    allergies: [],
    dietaryRestrictions: [],
    favoriteIngredients: ['egg', 'chicken', 'potatoes'],
    schedule: { workHours: 'School 08:00 - 15:00', freeHours: '15:00 - 20:00', cookingAvailability: false, cookingSkill: 'low' },
  },
];
