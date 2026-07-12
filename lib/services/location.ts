/** Resolve home area from memory snapshot or orchestrator memory context block. */
export function homeAreaFromContext(memoryContext?: string, memoryHomeArea?: string): string {
  if (memoryHomeArea?.trim()) return memoryHomeArea.trim();
  const match = memoryContext?.match(/Home area: ([^\n]+)/);
  return match?.[1]?.trim() || 'Colombo';
}

export function newsLocationLabel(homeArea: string): string {
  return `Sri Lanka ${homeArea}`;
}
