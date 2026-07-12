import { NextResponse } from 'next/server';
import { searchGoogleMapsPlaces, buildPlacesSearchQuery } from '@/lib/services/google-maps-places';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const prompt = searchParams.get('prompt')?.trim() || q;
  const homeArea = searchParams.get('area')?.trim();

  if (!prompt) {
    return NextResponse.json(
      { success: false, error: 'Provide ?prompt= or ?q= (e.g. restaurants in Negombo)' },
      { status: 400 }
    );
  }

  const result = await searchGoogleMapsPlaces({ prompt, homeArea });
  return NextResponse.json({
    success: result.places.length > 0,
    query: result.query,
    source: result.source,
    places: result.places,
    mapsSearchUrl: `https://www.google.com/maps/search/${encodeURIComponent(buildPlacesSearchQuery(prompt, homeArea))}`,
  });
}
