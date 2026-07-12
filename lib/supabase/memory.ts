import type { MemoryEntry, MemoryPatch, UserMemory } from '@/lib/memory/types';
import { createDefaultMemory } from '@/lib/memory/defaults';
import { createClient } from '@/lib/supabase/server';

interface MemoryRow {
  user_id: string;
  default_budget_lkr: number;
  preferred_stores: string[];
  home_area: string;
  entries: MemoryEntry[];
  updated_at: string;
}

function rowToMemory(row: MemoryRow): UserMemory {
  return {
    userId: row.user_id,
    defaultBudgetLkr: row.default_budget_lkr,
    preferredStores: row.preferred_stores ?? [],
    homeArea: row.home_area ?? 'Colombo',
    entries: row.entries ?? [],
    updatedAt: row.updated_at,
  };
}

export async function getUserMemory(userId: string): Promise<UserMemory> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('user_memory').select('*').eq('user_id', userId).maybeSingle();

  if (error?.code === '42P01') return createDefaultMemory(userId);
  if (!data) {
    const seeded = createDefaultMemory(userId);
    await saveUserMemory(userId, seeded);
    return seeded;
  }
  return rowToMemory(data as MemoryRow);
}

export async function saveUserMemory(userId: string, memory: UserMemory): Promise<UserMemory> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    default_budget_lkr: memory.defaultBudgetLkr,
    preferred_stores: memory.preferredStores,
    home_area: memory.homeArea,
    entries: memory.entries,
    updated_at: now,
  };

  const { error } = await supabase.from('user_memory').upsert(payload, { onConflict: 'user_id' });
  if (error?.code === '42P01') return memory;
  return { ...memory, userId, updatedAt: now };
}

export async function patchUserMemory(userId: string, patch: MemoryPatch): Promise<UserMemory> {
  const current = await getUserMemory(userId);
  const now = new Date().toISOString();
  let entries = [...current.entries];

  if (patch.removeEntryIds?.length) {
    entries = entries.filter((e) => !patch.removeEntryIds!.includes(e.id));
  }
  if (patch.entries) {
    entries = patch.entries;
  }
  if (patch.addEntries?.length) {
    for (const add of patch.addEntries) {
      entries.push({
        ...add,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  const updated: UserMemory = {
    ...current,
    defaultBudgetLkr: patch.defaultBudgetLkr ?? current.defaultBudgetLkr,
    preferredStores: patch.preferredStores ?? current.preferredStores,
    homeArea: patch.homeArea ?? current.homeArea,
    entries,
    updatedAt: now,
  };

  return saveUserMemory(userId, updated);
}
