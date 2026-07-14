/** Categories of persistent user knowledge beyond family/inventory tables. */
export type MemoryCategory =
  | 'preference'
  | 'dietary'
  | 'store'
  | 'budget'
  | 'location'
  | 'dish'
  | 'avoid'
  | 'fact'
  | 'meal_role';

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  source: 'user' | 'inferred' | 'system';
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserMemory {
  userId?: string;
  defaultBudgetLkr: number;
  preferredStores: string[];
  homeArea: string;
  entries: MemoryEntry[];
  updatedAt: string;
}

export interface MemoryPatch {
  defaultBudgetLkr?: number;
  preferredStores?: string[];
  homeArea?: string;
  entries?: MemoryEntry[];
  addEntries?: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>[];
  removeEntryIds?: string[];
}
