import type { LocalBusiness } from '@/lib/types';

/** Curated demo restaurants when SerpAPI is unavailable or rate-limited. */
export function demoPlacesForDish(dish: string | undefined, area = 'Negombo'): LocalBusiness[] {
  const location = area.includes('Sri Lanka') ? area : `${area}, Sri Lanka`;
  const lower = (dish || 'restaurant').toLowerCase();

  const biryani: LocalBusiness[] = [
    mk('Sri Lanka Buhari Hotel', 'Biryani · Rice & curry', 'Rs 800–1,500', location, 4.3, 1200),
    mk('Pilawoos Restaurant', 'Biryani · Short eats', 'Rs 600–1,200', location, 4.1, 890),
    mk('New Delmon Restaurant', 'Biryani · Indian', 'Rs 1,000–2,000', location, 4.2, 650),
    mk('Marine Grill Negombo', 'Biryani · Seafood', 'Rs 1,200–2,500', location, 4.0, 420),
  ];

  const kottu: LocalBusiness[] = [
    mk('Hotel de Plaza', 'Kottu roti · Short eats', 'Rs 500–900', location, 4.2, 780),
    mk('Street Kottu Corner', 'Kottu · Late night', 'Rs 400–800', location, 4.0, 540),
    mk('Pilawoos Restaurant', 'Kottu · Fried rice', 'Rs 600–1,200', location, 4.1, 890),
    mk('Green Cabin', 'Kottu · Sri Lankan', 'Rs 500–1,000', location, 4.3, 1100),
  ];

  const generic: LocalBusiness[] = [
    mk('Legacy Cafe & Restaurant', 'Sri Lankan · Rice & curry', 'Rs 1,000–2,000', location, 4.4, 980),
    mk('Teachers Choice Restaurant', 'Local · Short eats', 'Rs 800–1,500', location, 4.2, 720),
    mk('Palm Strip Restaurant', 'Seafood · Rice & curry', 'Rs 1,000–2,500', location, 4.1, 560),
    mk('Beach Wadiya', 'Sri Lankan · Seafood', 'Rs 1,200–3,000', location, 4.3, 840),
  ];

  if (/biriyani|biryani/.test(lower)) return biryani;
  if (/kottu|kothu/.test(lower)) return kottu;
  if (/fried rice/.test(lower)) return kottu.slice(0, 3);
  return generic;
}

function mk(
  name: string,
  category: string,
  priceLabel: string,
  location: string,
  rating: number,
  reviews: number
): LocalBusiness {
  const range = priceLabel.replace(/,/g, '').match(/(\d+)[–\-—to]+(\d+)/i);
  const minLkr = range ? parseInt(range[1], 10) : undefined;
  const maxLkr = range ? parseInt(range[2], 10) : undefined;
  const q = encodeURIComponent(`${name} ${location}`);
  return {
    name,
    rating,
    reviewCount: reviews,
    priceLabel,
    priceMinLkr: minLkr,
    priceMaxLkr: maxLkr,
    category,
    address: location,
    openState: 'Open · Closes 10 PM',
    services: ['Dine-in', 'Takeaway', 'Delivery'],
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${q}`,
    rank: 0,
  };
}
