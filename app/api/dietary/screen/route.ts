import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFamily } from '@/lib/supabase/data';
import { getUserMemory } from '@/lib/supabase/memory';
import { screenIngredientForFamily, buildDietaryRulesSummary } from '@/lib/services/dietary-screen';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [family, memory] = await Promise.all([getFamily(user.id), getUserMemory(user.id)]);
  return NextResponse.json({
    familyCount: family.length,
    rules: buildDietaryRulesSummary(family, memory.entries),
    members: family.map((m) => ({
      name: m.name,
      allergies: m.allergies,
      dietaryRestrictions: m.dietaryRestrictions,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as { item?: string };
  const item = body.item?.trim();
  if (!item) return NextResponse.json({ error: 'item required' }, { status: 400 });

  const [family, memory] = await Promise.all([getFamily(user.id), getUserMemory(user.id)]);
  const result = await screenIngredientForFamily(item, family, memory.entries);
  return NextResponse.json(result);
}
