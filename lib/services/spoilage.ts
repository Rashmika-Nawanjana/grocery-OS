import type { InventoryItem, SpoilageAlert, WeatherCondition } from '@/lib/types';

const PERISHABLE_HINT =
  /\b(tomato|onion|fish|leaf|green|egg|chicken|milk|bread|fruit|vegetable|meat|seafood|prawn|spinach|herb|curry|dhal|tuna|beef|pork|yogurt|cheese|banana|mango|papaya|lettuce|cabbage|carrot|potato)\b/i;

export function isPerishableItem(name: string, expiryDays: number): boolean {
  return expiryDays > 0 && (expiryDays <= 14 || PERISHABLE_HINT.test(name));
}

function recommendedBuyText(item: InventoryItem, weatherDays: number): string {
  const name = item.item;
  if (weatherDays <= 2) {
    return `Buy only what you will use in ${weatherDays} day(s) of ${name}`;
  }
  if (weatherDays <= 4) {
    return `Limit ${name} to a small batch (${weatherDays}-day shelf life in current weather)`;
  }
  return `Normal quantity OK for ${name} (~${weatherDays} days in current conditions)`;
}

function recommendedMaxQty(item: InventoryItem, weatherDays: number): string {
  const qty = item.quantity || 1;
  const unit = item.unit || 'units';
  if (weatherDays <= 3) {
    const cap = unit === 'kg' || unit === 'l' ? Math.min(qty, 1) : Math.min(qty, 3);
    return `${cap} ${unit}`;
  }
  if (unit === 'kg' || unit === 'l') return `${Math.min(qty * 1.5, 2)} ${unit}`;
  if (unit === 'g' || unit === 'ml') return `${Math.min(Math.round(qty * 0.5), 500)} ${unit}`;
  return `${Math.max(1, Math.round(qty))} ${unit}`;
}

/** Compute spoilage windows from pantry expiry_days (Supabase) and live weather modifier. */
export function computeSpoilageAlerts(inventory: InventoryItem[], weather: WeatherCondition): SpoilageAlert[] {
  const modifier = weather.spoilageModifier;
  const perishables = inventory.filter((i) => isPerishableItem(i.item, i.expiryDays));

  return perishables.map((item) => {
    const normalDays = Math.max(1, item.expiryDays);
    const weatherDays = Math.max(1, Math.round(normalDays * modifier));
    const humidNote = weather.humidity ? `, ${weather.humidity}% humidity` : '';

    return {
      item: item.item,
      normalExpiryDays: normalDays,
      weatherExpiryDays: weatherDays,
      quantity: item.quantity,
      unit: item.unit,
      inPantry: true,
      warning:
        weather.condition === 'monsoon' || weather.rainMm > 5
          ? `${item.item} may spoil in ~${weatherDays} days during ${weather.condition} (pantry baseline ${normalDays} days${humidNote})`
          : `${item.item}: ~${weatherDays} days at ${weather.temperature}°C (baseline ${normalDays} days)`,
      buyRecommendation: `${recommendedBuyText(item, weatherDays)}. Suggested max purchase: ${recommendedMaxQty(item, weatherDays)}.`,
    };
  });
}

export function spoilageRiskForItem(itemName: string, alerts: SpoilageAlert[], weather: WeatherCondition): 'low' | 'medium' | 'high' {
  const key = itemName.toLowerCase();
  const alert = alerts.find(
    (a) => key.includes(a.item.toLowerCase()) || a.item.toLowerCase().includes(key.split(' ')[0])
  );
  if (alert) {
    if (alert.weatherExpiryDays <= 3) return 'high';
    if (alert.weatherExpiryDays <= 5) return 'medium';
    return 'low';
  }
  if (weather.spoilageModifier < 0.7 && PERISHABLE_HINT.test(key)) return 'high';
  if (weather.spoilageModifier < 0.85 && PERISHABLE_HINT.test(key)) return 'medium';
  return 'low';
}
