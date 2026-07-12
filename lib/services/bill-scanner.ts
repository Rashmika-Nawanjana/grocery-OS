import { geminiJsonWithImage, SchemaType, type ResponseSchema } from '@/lib/services/gemini';
import type { ScannedBillItem } from '@/lib/inventory-merge';

export interface BillScanResult {
  items: ScannedBillItem[];
  storeName?: string;
  billDate?: string;
  notes?: string;
}

const billScanSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    storeName: { type: SchemaType.STRING },
    billDate: { type: SchemaType.STRING },
    notes: { type: SchemaType.STRING },
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          item: { type: SchemaType.STRING },
          quantity: { type: SchemaType.NUMBER },
          unit: { type: SchemaType.STRING },
          expiryDays: { type: SchemaType.INTEGER },
        },
        required: ['item', 'quantity', 'unit', 'expiryDays'],
      },
    },
  },
  required: ['items'],
};

const BILL_SCAN_SYSTEM = `You are a grocery receipt OCR assistant for Sri Lankan supermarkets (Keells, Cargills, Arpico, local pola).
Read the receipt image and extract every food/grocery line item purchased.
Skip non-food items (bags, discounts, VAT, payment totals).
Normalize item names for a home pantry (e.g. "TOMATO 1KG" → "Fresh Tomatoes").
Units must be one of: g, ml, pcs, item. Convert kg→quantity in grams with unit g, litres→ml.
Estimate typical shelf expiryDays: fresh fish/meat 2-3, vegetables 5-10, eggs 12, rice/dhal 30-60, oil 180, spices 365.
Return JSON only.`;

export async function scanBillImage(base64: string, mimeType: string): Promise<BillScanResult | null> {
  const parsed = await geminiJsonWithImage<BillScanResult>(
    base64,
    mimeType,
    'Extract all grocery items from this shopping bill/receipt photo.',
    BILL_SCAN_SYSTEM,
    billScanSchema
  );

  if (!parsed?.items?.length) return null;

  const items = parsed.items
    .filter((row) => row.item?.trim() && row.quantity > 0)
    .map((row) => ({
      item: row.item.trim(),
      quantity: row.quantity,
      unit: row.unit || 'item',
      expiryDays: row.expiryDays || 14,
    }));

  if (!items.length) return null;

  return {
    items,
    storeName: parsed.storeName?.trim() || undefined,
    billDate: parsed.billDate?.trim() || undefined,
    notes: parsed.notes?.trim() || undefined,
  };
}
