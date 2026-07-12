import type { InventoryItem, FamilyMember } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';
import { capFamilyForAgents, MAX_FAMILY_FOR_AGENTS } from '@/lib/family/cap-family';
import { planWarn } from '@/lib/plan-logger';
import { seedInventoryWithRAG, upsertInventoryWithRAG, searchInventoryRAG } from '@/lib/rag/inventory-rag';
import { dedupeInventory } from '@/lib/inventory-merge';
import { DEMO_FAMILY_SEED } from '@/lib/seed/demo-family';

function rowToItem(row: {
  id: string;
  item: string;
  quantity: number;
  unit: string;
  expiry_days: number;
  last_added: string;
}): InventoryItem {
  return {
    id: row.id,
    item: row.item,
    quantity: Number(row.quantity),
    unit: row.unit,
    expiryDays: row.expiry_days,
    lastAdded: row.last_added?.split('T')[0] || '',
  };
}

export async function getInventory(userId: string): Promise<InventoryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('inventory').select('*').eq('user_id', userId).order('last_added', { ascending: false });

  if (error?.code === '42P01') return [];
  if (!data?.length) return [];

  const items = data.map(rowToItem);
  const deduped = dedupeInventory(items);
  if (deduped.length < items.length) {
    await upsertInventoryWithRAG(userId, deduped);
  }
  return deduped;
}

export async function getInventoryForQuery(userId: string, query: string): Promise<InventoryItem[]> {
  const { items } = await searchInventoryRAG(userId, query, 7);
  if (items.length) return items;
  return getInventory(userId);
}

export async function getFamily(userId: string): Promise<FamilyMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('family_members').select('*').eq('user_id', userId);

  if (error?.code === '42P01') return [];
  if (!data?.length) return [];

  const deduped = data.map((row) => ({
    id: row.id,
    name: row.name,
    age: row.age,
    preferences: row.preferences || [],
    allergies: row.allergies || [],
    dietaryRestrictions: row.dietary_restrictions || [],
    favoriteIngredients: row.favorite_ingredients || [],
    schedule: row.schedule || { workHours: '', freeHours: '', cookingAvailability: false, cookingSkill: 'low' },
  })).filter((member, index, arr) => arr.findIndex((m) => m.name === member.name) === index);

  if (deduped.length > MAX_FAMILY_FOR_AGENTS) {
    planWarn('family', `DB returned ${deduped.length} family rows — capping to ${MAX_FAMILY_FOR_AGENTS}`);
  }
  return capFamilyForAgents(deduped);
}

async function seedFamily(userId: string) {
  const supabase = await createClient();
  await supabase.from('family_members').insert(
    DEMO_FAMILY_SEED.map((m) => ({
      user_id: userId,
      name: m.name,
      age: m.age,
      preferences: m.preferences,
      allergies: m.allergies,
      dietary_restrictions: m.dietaryRestrictions,
      favorite_ingredients: m.favoriteIngredients,
      schedule: m.schedule,
    }))
  );
}

export async function seedFamilyIfEmpty(userId: string): Promise<FamilyMember[]> {
  const existing = await getFamily(userId);
  if (existing.length) return existing;
  await seedFamily(userId);
  return getFamily(userId);
}

export async function saveInventory(userId: string, items: InventoryItem[]) {
  await upsertInventoryWithRAG(userId, dedupeInventory(items));
}

export async function saveFamily(userId: string, members: FamilyMember[]) {
  const supabase = await createClient();
  await supabase.from('family_members').delete().eq('user_id', userId);
  if (!members.length) return;
  await supabase.from('family_members').insert(
    members.map((m) => ({
      user_id: userId,
      name: m.name,
      age: m.age,
      preferences: m.preferences,
      allergies: m.allergies,
      dietary_restrictions: m.dietaryRestrictions,
      favorite_ingredients: m.favoriteIngredients,
      schedule: m.schedule,
    }))
  );
}

export { seedInventoryWithRAG };
