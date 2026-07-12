'use client';

import type { MemoryPatch, UserMemory } from '@/lib/memory/types';
import { createDefaultMemory } from '@/lib/memory/defaults';

const STORAGE_PREFIX = 'plango_user_memory';

function storageKey(userKey: string): string {
  return `${STORAGE_PREFIX}:${userKey}`;
}

export function loadLocalMemory(userKey: string): UserMemory {
  if (typeof window === 'undefined') return createDefaultMemory();
  try {
    const raw = localStorage.getItem(storageKey(userKey));
    if (!raw) return createDefaultMemory();
    return JSON.parse(raw) as UserMemory;
  } catch {
    return createDefaultMemory();
  }
}

export function saveLocalMemory(userKey: string, memory: UserMemory): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(userKey), JSON.stringify(memory));
}

export async function fetchUserMemory(): Promise<UserMemory | null> {
  const res = await fetch('/api/memory');
  if (res.status === 401) return null;
  if (!res.ok) return null;
  return (await res.json()) as UserMemory;
}

export async function patchUserMemory(patch: MemoryPatch): Promise<UserMemory | null> {
  const res = await fetch('/api/memory', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  return (await res.json()) as UserMemory;
}
