import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getInventory, saveInventory, seedInventoryWithRAG } from '@/lib/supabase/data';
import type { InventoryItem } from '@/lib/types';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const inventory = await getInventory(user.id);
  return NextResponse.json({ inventory });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { inventory } = (await request.json()) as { inventory: InventoryItem[] };
  await saveInventory(user.id, inventory);
  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const force = body?.force === true;

  const inventory = await seedInventoryWithRAG(user.id, force);
  return NextResponse.json({ success: true, inventory, message: `Seeded ${inventory.length} items with RAG embeddings` });
}
