import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserMemory, patchUserMemory } from '@/lib/supabase/memory';
import type { MemoryPatch } from '@/lib/memory/types';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const memory = await getUserMemory(user.id);
  return NextResponse.json(memory);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const patch = (await request.json()) as MemoryPatch;
  const memory = await patchUserMemory(user.id, patch);
  return NextResponse.json(memory);
}
