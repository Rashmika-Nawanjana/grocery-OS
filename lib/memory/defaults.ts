import type { UserMemory } from '@/lib/memory/types';

export function createDefaultMemory(userId?: string): UserMemory {
  const now = new Date().toISOString();
  return {
    userId,
    defaultBudgetLkr: 5000,
    preferredStores: [],
    homeArea: 'Colombo',
    entries: [],
    updatedAt: now,
  };
}
