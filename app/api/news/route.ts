import { NextResponse } from 'next/server';
import { fetchCrisisNews } from '@/lib/services/news';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get('location') || 'Sri Lanka Colombo';
  const question = searchParams.get('q') || undefined;
  const crisis = await fetchCrisisNews(location, question);
  return NextResponse.json(crisis);
}
