'use client';

import { ExternalLink, MapPin, Star, UtensilsCrossed } from 'lucide-react';
import type { LocalBusiness } from '@/lib/types';

interface LocalPlacesViewProps {
  places: LocalBusiness[];
  query?: string;
  animate?: boolean;
}

function priceDisplay(p: LocalBusiness): string {
  if (p.priceLabel) return p.priceLabel.replace(/^Rs\.?\s*/i, 'Rs ');
  if (p.priceMinLkr != null && p.priceMaxLkr != null) {
    if (p.priceMinLkr === p.priceMaxLkr) return `Rs ${p.priceMinLkr.toLocaleString()}`;
    return `Rs ${p.priceMinLkr.toLocaleString()}–${p.priceMaxLkr.toLocaleString()}`;
  }
  return 'Price not listed';
}

export default function LocalPlacesView({ places, query, animate = true }: LocalPlacesViewProps) {
  if (!places.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <UtensilsCrossed className="h-4 w-4 text-[#16A34A]" />
        <p className="text-[9px] font-mono uppercase tracking-widest text-[#15803D] font-bold">
          Google Maps · {query || 'nearby places'}
        </p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {places.map((p, i) => (
          <a
            key={p.placeId || p.name}
            href={p.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`group block rounded-2xl border border-[#BBF7D0] bg-white hover:border-[#16A34A] hover:shadow-md transition-all overflow-hidden ${
              animate ? 'animate-fade-in' : ''
            }`}
            style={animate ? { animationDelay: `${i * 80}ms`, opacity: 0 } : undefined}
          >
            <div className="flex gap-3 p-3">
              {p.thumbnailUrl ? (
                <img
                  src={p.thumbnailUrl}
                  alt=""
                  className="w-16 h-16 rounded-xl object-cover shrink-0 bg-[#F0FDF4]"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-[#F0FDF4] flex items-center justify-center shrink-0">
                  <MapPin className="h-6 w-6 text-[#16A34A]/60" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-serif font-bold text-[#14532D] text-sm leading-tight group-hover:text-[#16A34A]">
                    {p.name}
                  </p>
                  <ExternalLink className="h-3.5 w-3.5 text-[#15803D]/40 shrink-0 group-hover:text-[#16A34A]" />
                </div>
                {p.rating != null && (
                  <p className="text-xs text-[#15803D] mt-0.5 flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {p.rating}
                    {p.reviewCount != null && (
                      <span className="text-[#15803D]/60">({p.reviewCount.toLocaleString()})</span>
                    )}
                  </p>
                )}
                <p className="text-xs font-semibold text-[#14532D] mt-1">{priceDisplay(p)}</p>
                {p.category && <p className="text-[10px] text-[#15803D]/70 mt-0.5">{p.category}</p>}
                {p.openState && <p className="text-[10px] text-amber-700 mt-0.5">{p.openState}</p>}
                {p.services?.length ? (
                  <p className="text-[10px] text-[#15803D]/60 mt-1">{p.services.join(' · ')}</p>
                ) : null}
              </div>
            </div>
            {p.address && (
              <p className="text-[10px] text-[#15803D]/60 px-3 pb-3 truncate border-t border-[#F0FDF4] pt-2 mx-3 mb-1">
                {p.address}
              </p>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

export function shouldShowPlacesSummary(places?: LocalBusiness[]): boolean {
  return Boolean(places?.length);
}
