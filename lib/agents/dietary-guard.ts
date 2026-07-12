import type { AgentContext, AgentExecutionLog, DietaryVerdict } from '@/lib/types';
import { geminiJson } from '@/lib/services/gemini';
import { capFamilyForAgents } from '@/lib/family/cap-family';
import { screenIngredientForFamily } from '@/lib/services/dietary-screen';

/** True when the user wants fish/seafood in the meal — not when they exclude it. */
export function promptRequestsFish(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  if (/\b(no|without|avoid|exclude|don't|do not)\s+(fish|seafood)\b/i.test(lower)) return false;
  if (/\bfish[\s-]free\b/i.test(lower)) return false;
  if (/\bno\s+fish\b/i.test(lower)) return false;
  return /\bfish\b|\bseafood\b|\bprawn/i.test(lower);
}

export function promptRequestsSugar(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  if (/\b(low[\s-]?sugar|diabetic|no sugar|sugar[\s-]free)\b/i.test(lower)) return false;
  return /\bsugar\b|\bdessert\b|\bsweet\b/i.test(lower);
}

function extractIngredientCandidates(prompt: string): string[] {
  return [...prompt.matchAll(/\b(rice|dhal|chicken|fish|prawn|egg|milk|sugar|bread|tomato|onion|curry|noodle|pasta)\b/gi)].map(
    (m) => m[0]
  );
}

export async function runDietaryGuard(ctx: AgentContext): Promise<{ log: AgentExecutionLog; verdict: DietaryVerdict }> {
  const family = capFamilyForAgents(ctx.family);
  const userPrompt = ctx.userPrompt || ctx.prompt;

  const log: AgentExecutionLog = {
    agentId: 'dietary-guard',
    agentName: 'Agent 6: Dietary Guard',
    status: 'active',
    message: 'Checking Supabase household allergies and dietary restrictions...',
  };

  if (!family.length) {
    log.status = 'warn';
    log.message = 'No family members in database — add profiles under Preferences for dietary screening.';
    return {
      log,
      verdict: {
        approved: true,
        blockedItems: [],
        warnings: ['Add household members in Preferences to enable dietary guard.'],
        memberNotes: [],
      },
    };
  }

  const blockedItems: string[] = [];
  const warnings: string[] = [];
  const memberNotes: string[] = [];

  const wantsFish = promptRequestsFish(userPrompt);
  const wantsSugar = promptRequestsSugar(userPrompt);

  if (/\bno\s+fish\b|\bwithout\s+fish\b|\bfish[\s-]free\b/i.test(userPrompt.toLowerCase())) {
    memberNotes.push('User requested no fish — recipes will exclude seafood.');
  }

  for (const member of family) {
    for (const allergy of member.allergies) {
      memberNotes.push(`${member.name}: allergy — ${allergy}`);
    }
    for (const restriction of [...member.dietaryRestrictions, ...member.preferences]) {
      const rLower = restriction.toLowerCase();
      if (rLower.includes('diabetic') || rLower.includes('diabetes')) {
        if (wantsSugar) {
          blockedItems.push('high-sugar items');
          warnings.push(`${member.name}: diabetic — avoid high sugar`);
        }
        memberNotes.push(`${member.name}: low sugar required`);
      }
      if (rLower.includes('no fish') || rLower.includes('shellfish') || rLower.includes('fish')) {
        if (wantsFish) {
          blockedItems.push('fish/seafood');
          warnings.push(`${member.name}: fish/seafood excluded`);
        }
        memberNotes.push(`${member.name}: no fish/seafood`);
      }
      if (rLower.includes('no spicy') && /\bspicy\b|\bchilli\b/i.test(userPrompt)) {
        warnings.push(`${member.name}: avoid spicy`);
      }
    }
  }

  const candidates = [...new Set(extractIngredientCandidates(userPrompt))];
  for (const item of candidates.slice(0, 5)) {
    const screen = await screenIngredientForFamily(item, family, ctx.memoryEntries);
    if (screen.status === 'fail') {
      blockedItems.push(item);
      warnings.push(...screen.allergenWarnings, ...screen.restrictionWarnings);
    } else if (screen.status === 'warn') {
      warnings.push(...screen.restrictionWarnings);
    }
  }

  const aiVerdict = await geminiJson<{ approved: boolean; blockedItems: string[]; warnings: string[] }>(
    `Prompt: "${userPrompt}"\nFamily (${family.length}): ${JSON.stringify(family.slice(0, 6).map((m) => ({ name: m.name, allergies: m.allergies, dietaryRestrictions: m.dietaryRestrictions })))}${family.length > 6 ? '…' : ''}\nMemory dietary notes: ${JSON.stringify((ctx.memoryEntries ?? []).filter((e) => e.category === 'dietary' || e.category === 'avoid').map((e) => e.value))}\nUser excludes fish: ${!wantsFish && /fish/i.test(userPrompt)}\nAlready blocked: ${blockedItems.join(', ')}`,
    'You are a dietary safety agent for Sri Lankan families. Use ONLY the family JSON and memory notes provided — do not invent members. "no fish" in the prompt means fish should be EXCLUDED, not flagged as a violation. Return JSON with approved (boolean), blockedItems (array), warnings (array).'
  );

  const verdict: DietaryVerdict = {
    approved: blockedItems.length === 0 && (aiVerdict?.approved ?? true),
    blockedItems: [...new Set([...blockedItems, ...(aiVerdict?.blockedItems || [])])],
    warnings: [...new Set([...warnings, ...(aiVerdict?.warnings || [])])],
    memberNotes,
  };

  log.status = verdict.approved ? 'success' : 'warn';
  log.message = verdict.approved
    ? `Dietary checks passed for ${family.length} household member(s).`
    : `Review needed: ${verdict.blockedItems.join(', ')}. ${verdict.warnings.slice(0, 2).join('; ')}`;
  log.details = { ...verdict, source: 'supabase_family' };

  return { log, verdict };
}
