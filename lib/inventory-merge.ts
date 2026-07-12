import type { InventoryItem } from '@/lib/types';

export interface ScannedBillItem {
  item: string;
  quantity: number;
  unit: string;
  expiryDays: number;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bfresh\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().trim();
  if (u === 'kg') return 'g';
  if (u === 'l' || u === 'litre' || u === 'liter') return 'ml';
  if (u === 'piece' || u === 'pieces' || u === 'pc') return 'pcs';
  if (['g', 'ml', 'pcs', 'item'].includes(u)) return u;
  return 'item';
}

function scaleQuantity(quantity: number, unit: string): { quantity: number; unit: string } {
  const normalized = normalizeUnit(unit);
  if (unit.toLowerCase() === 'kg') return { quantity: quantity * 1000, unit: 'g' };
  if (unit.toLowerCase() === 'l' || unit.toLowerCase() === 'litre' || unit.toLowerCase() === 'liter') {
    return { quantity: quantity * 1000, unit: 'ml' };
  }
  return { quantity: Math.max(0, quantity), unit: normalized };
}

/** Merge rows that share the same item name + unit (case-insensitive). */
export function dedupeInventory(items: InventoryItem[]): InventoryItem[] {
  const merged: InventoryItem[] = [];

  for (const item of items) {
    const key = normalizeName(item.item);
    const unit = normalizeUnit(item.unit);
    const matchIdx = merged.findIndex(
      (it) => normalizeName(it.item) === key && normalizeUnit(it.unit) === unit
    );

    if (matchIdx >= 0) {
      const current = merged[matchIdx];
      merged[matchIdx] = {
        ...current,
        quantity: current.quantity + item.quantity,
        expiryDays: Math.min(current.expiryDays, item.expiryDays),
        lastAdded: item.lastAdded > current.lastAdded ? item.lastAdded : current.lastAdded,
      };
      continue;
    }

    merged.push({ ...item });
  }

  return merged;
}

export function mergeBillItemsIntoInventory(
  existing: InventoryItem[],
  scanned: ScannedBillItem[]
): { inventory: InventoryItem[]; added: string[]; updated: string[] } {
  const today = new Date().toISOString().split('T')[0];
  const inventory = dedupeInventory(existing.map((item) => ({ ...item })));
  const added: string[] = [];
  const updated: string[] = [];

  for (const raw of scanned) {
    const name = raw.item?.trim();
    if (!name || !raw.quantity) continue;

    const { quantity, unit } = scaleQuantity(raw.quantity, raw.unit || 'item');
    const expiryDays = Math.min(365, Math.max(1, Math.round(raw.expiryDays || 14)));
    const key = normalizeName(name);

    const matchIdx = inventory.findIndex(
      (it) => normalizeName(it.item) === key && normalizeUnit(it.unit) === unit
    );

    if (matchIdx >= 0) {
      const current = inventory[matchIdx];
      inventory[matchIdx] = {
        ...current,
        quantity: current.quantity + quantity,
        expiryDays: Math.min(current.expiryDays, expiryDays),
        lastAdded: today,
      };
      updated.push(name);
      continue;
    }

    inventory.push({
      id: crypto.randomUUID(),
      item: name,
      quantity,
      unit,
      expiryDays,
      lastAdded: today,
    });
    added.push(name);
  }

  return { inventory, added, updated };
}
