import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getInventory, getFamily, seedInventoryWithRAG, seedFamilyIfEmpty } from '@/lib/supabase/data';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [inventory, family] = await Promise.all([getInventory(user.id), getFamily(user.id)]);
  return NextResponse.json({ inventory, family });
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const inventory = await seedInventoryWithRAG(user.id, true);
  const family = await seedFamilyIfEmpty(user.id);
  return NextResponse.json({ success: true, inventory, family });
}
