import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getInventory, getFamily } from '@/lib/supabase/data';
import { getUserMemory } from '@/lib/supabase/memory';
import { fetchWeather } from '@/lib/services/weather';
import { computeSpoilageAlerts } from '@/lib/services/spoilage';
import { homeAreaFromContext, newsLocationLabel } from '@/lib/services/location';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [inventory, memory] = await Promise.all([getInventory(user.id), getUserMemory(user.id)]);
  const homeArea = homeAreaFromContext(undefined, memory.homeArea);
  const weather = await fetchWeather(homeArea);
  const alerts = computeSpoilageAlerts(inventory, weather);

  return NextResponse.json({
    weather,
    alerts,
    inventoryCount: inventory.length,
    location: newsLocationLabel(homeArea),
  });
}
