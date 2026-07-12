import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getInventory, saveInventory } from '@/lib/supabase/data';
import { mergeBillItemsIntoInventory, type ScannedBillItem } from '@/lib/inventory-merge';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as { items?: ScannedBillItem[] };
  const items = body.items?.filter((row) => row.item?.trim() && row.quantity > 0) ?? [];

  if (!items.length) {
    return NextResponse.json({ error: 'Add at least one item with a name and quantity' }, { status: 400 });
  }

  const existing = await getInventory(user.id);
  const { inventory, added, updated } = mergeBillItemsIntoInventory(existing, items);
  await saveInventory(user.id, inventory);

  return NextResponse.json({
    success: true,
    inventory,
    added,
    updated,
    appliedCount: items.length,
  });
}
