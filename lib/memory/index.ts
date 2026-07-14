export type { MemoryCategory, MemoryEntry, UserMemory, MemoryPatch } from '@/lib/memory/types';
export { createDefaultMemory } from '@/lib/memory/defaults';
export { buildMemoryContext, mergeBudgetWithMemory, getMemoryPreference, prefersHomeInventory, likedDishNames } from '@/lib/memory/context';
export { extractMemoryFromPrompt, extractMemoryFromResult } from '@/lib/memory/extract';
export type { MemoryExtractExtras } from '@/lib/memory/extract';
export { loadLocalMemory, saveLocalMemory, fetchUserMemory, patchUserMemory } from '@/lib/memory/client';
export { buildMemoryGraph, CATEGORY_META, isRecentlyUpdated } from '@/lib/memory/graph-nodes';
export type { GraphNode, GraphEdge, MemoryGraph } from '@/lib/memory/graph-nodes';
