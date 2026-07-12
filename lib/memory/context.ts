import type { UserMemory } from '@/lib/memory/types';
import type { UserMemorySnapshot } from '@/lib/types';

type MemoryInput = UserMemory | UserMemorySnapshot | undefined;

/** Compact block injected into agent prompts and intent classification. */
export function buildMemoryContext(memory: MemoryInput): string {
  if (!memory) return '';

  const lines: string[] = ['User memory (persistent preferences):'];

  if (memory.defaultBudgetLkr) {
    lines.push(`- Default budget: LKR ${memory.defaultBudgetLkr}`);
  }
  if (memory.homeArea) {
    lines.push(`- Home area: ${memory.homeArea}`);
  }
  if (memory.preferredStores.length) {
    lines.push(`- Preferred stores: ${memory.preferredStores.join(', ')}`);
  }

  const byCategory = (cat: string) => memory.entries.filter((e) => e.category === cat);
  const avoids = byCategory('avoid');
  const prefs = byCategory('preference');
  const dishes = byCategory('dish').slice(-5);
  const dietary = byCategory('dietary').slice(-4);

  if (avoids.length) {
    lines.push(`- Avoids: ${avoids.map((e) => e.value).join('; ')}`);
  }
  if (dietary.length) {
    lines.push(`- Dietary notes: ${dietary.map((e) => e.value).join('; ')}`);
  }
  if (prefs.length) {
    lines.push(`- Preferences: ${prefs.map((e) => e.value).join('; ')}`);
  }
  if (dishes.length) {
    lines.push(`- Recently liked dishes: ${dishes.map((e) => e.value).join(', ')}`);
  }

  return lines.length > 1 ? lines.join('\n') : '';
}

export function mergeBudgetWithMemory(requested: number | undefined, memory: MemoryInput): number {
  if (requested && requested > 0) return requested;
  return memory?.defaultBudgetLkr ?? 5000;
}
