import type { FamilyMember } from '@/lib/types';
import { planWarn } from '@/lib/plan-logger';

export const MAX_FAMILY_FOR_AGENTS = 12;

/** Cap family rows sent to agents — prevents 1000+ member DB rows from blowing up Gemini. */
export function capFamilyForAgents(family: FamilyMember[]): FamilyMember[] {
  if (family.length <= MAX_FAMILY_FOR_AGENTS) return family;
  planWarn('family', `Capping family ${family.length} → ${MAX_FAMILY_FOR_AGENTS} for agent context`);
  return family.slice(0, MAX_FAMILY_FOR_AGENTS);
}
