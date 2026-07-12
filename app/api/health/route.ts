import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isVertexConfigured } from '@/lib/services/gemini';
import { isNewsApiConfigured } from '@/lib/services/news';

export async function GET() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );

  let supabaseStatus: 'ok' | 'error' | 'not_configured' = 'not_configured';

  if (supabaseConfigured) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.getSession();
      supabaseStatus = error ? 'error' : 'ok';
    } catch {
      supabaseStatus = 'error';
    }
  }

  return NextResponse.json({
    status: 'ok',
    time: new Date().toISOString(),
    supabase: supabaseStatus,
    vertexAi: isVertexConfigured(),
    gemini: isVertexConfigured(),
    newsApi: isNewsApiConfigured(),
    weatherApi: Boolean(process.env.WEATHER_API_KEY || process.env.OPENWEATHER_API_KEY),
  });
}
