import { NextResponse } from 'next/server';
import { fetchDashboardEnv } from '@/lib/services/dashboard-env';

export async function GET() {
  try {
    const env = await fetchDashboardEnv();
    return NextResponse.json(env);
  } catch (error) {
    console.error('Dashboard env error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard environment data' }, { status: 500 });
  }
}
