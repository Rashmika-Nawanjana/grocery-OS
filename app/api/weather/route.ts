import { NextResponse } from 'next/server';
import { fetchWeather } from '@/lib/services/weather';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get('location') || 'Colombo';
  const weather = await fetchWeather(location);
  return NextResponse.json(weather);
}
