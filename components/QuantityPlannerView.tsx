'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Droplets, Thermometer, ShieldAlert, RefreshCw, BarChart2 } from 'lucide-react';
import type { SpoilageAlert, WeatherCondition } from '@/lib/types';
import { AGENT_DISPLAY_NAMES } from '@/lib/agent-display-names';

interface SpoilagePayload {
  weather: WeatherCondition;
  alerts: SpoilageAlert[];
  inventoryCount: number;
  location?: string;
}

interface QuantityPlannerViewProps {
  weather: WeatherCondition;
}

export default function QuantityPlannerView({ weather: initialWeather }: QuantityPlannerViewProps) {
  const [payload, setPayload] = useState<SpoilagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSpoilage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/spoilage');
      if (!res.ok) throw new Error('Failed to load spoilage data');
      const data = (await res.json()) as SpoilagePayload;
      setPayload(data);
    } catch {
      setError('Could not load pantry spoilage data. Check Supabase inventory and weather API keys.');
      setPayload({
        weather: initialWeather,
        alerts: [],
        inventoryCount: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [initialWeather]);

  useEffect(() => {
    loadSpoilage();
  }, [loadSpoilage]);

  const weather = payload?.weather ?? initialWeather;
  const alerts = payload?.alerts ?? [];
  const humidity = weather.humidity ?? 75;

  return (
    <div className="space-y-8 animate-fade-in text-[#2D332D]" id="agent5-viewport">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#16A34A] font-extrabold font-sans">AI Sensory Diagnostics</p>
        <h2 className="text-3xl font-serif italic font-bold text-[#14532D] mt-1">{AGENT_DISPLAY_NAMES.sensoryDecay}</h2>
        <p className="text-[#15803D] mt-2 text-sm leading-relaxed max-w-3xl">
          Shelf-life windows from your Supabase pantry expiry days, adjusted by live OpenWeather readings. No simulated product catalog — only items you track at home.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 space-y-5 shadow-sm">
            <h3 className="font-serif font-bold text-lg text-[#14532D] flex items-center gap-2">
              <Thermometer className="text-[#16A34A] h-5 w-5" /> Live Climate
            </h3>

            <div className="p-3 bg-[#F0FDF4] rounded-2xl border border-[#BBF7D0] text-xs space-y-2">
              <div className="flex justify-between items-center text-[#14532D]">
                <span>Location:</span>
                <span className="font-bold">{payload?.location || weather.location || 'Colombo'}</span>
              </div>
              <div className="flex justify-between items-center text-[#14532D]">
                <span>Condition:</span>
                <span className="font-bold capitalize">{weather.condition}</span>
              </div>
              <div className="flex justify-between items-center text-[#14532D]">
                <span className="flex items-center gap-1">
                  <Thermometer className="h-3.5 w-3.5" /> Temp
                </span>
                <span className="font-mono font-bold">{weather.temperature}°C</span>
              </div>
              <div className="flex justify-between items-center text-[#14532D]">
                <span className="flex items-center gap-1">
                  <Droplets className="h-3.5 w-3.5" /> Humidity
                </span>
                <span className="font-mono font-bold">{humidity}% RH</span>
              </div>
              <div className="flex justify-between items-center text-[#14532D]">
                <span>Spoilage modifier:</span>
                <span className="font-mono font-bold text-[#16A34A]">×{weather.spoilageModifier.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-[#14532D]">
                <span>Source:</span>
                <span className="font-bold">{weather.source === 'openweather' ? 'OpenWeatherMap' : weather.source || 'fallback'}</span>
              </div>
            </div>

            <button
              onClick={loadSpoilage}
              disabled={loading}
              className="w-full bg-[#16A34A] hover:bg-[#14532D] text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
              {loading ? 'Refreshing...' : 'Refresh from pantry + weather'}
            </button>

            {error && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">{error}</p>}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <h3 className="font-serif font-bold text-lg text-[#14532D] pb-3 border-b border-[#BBF7D0] flex items-center gap-2">
            <Calendar className="text-[#16A34A] h-5 w-5" /> Pantry Spoilage Forecast
          </h3>

          {loading && !alerts.length ? (
            <p className="text-sm text-[#15803D]">Loading inventory expiry profiles...</p>
          ) : alerts.length === 0 ? (
            <div className="bg-white border border-[#BBF7D0] rounded-[24px] p-6 text-sm text-[#15803D]">
              No perishable items in Supabase inventory yet. Add groceries with expiry days under Inventory — Agent 5 uses those values with live weather.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {alerts.map((alert) => (
                <div key={alert.item} className="bg-white border border-[#BBF7D0] rounded-[24px] p-5 space-y-3">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-[#15803D]">{alert.item}</p>
                  <p className="text-3xl font-serif font-bold text-[#14532D]">{alert.weatherExpiryDays} days</p>
                  <div className="w-full bg-[#F0FDF4] h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${alert.weatherExpiryDays <= 3 ? 'bg-red-500' : 'bg-[#16A34A]'}`}
                      style={{ width: `${Math.min(100, (alert.weatherExpiryDays / Math.max(alert.normalExpiryDays, 1)) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#15803D] leading-relaxed">{alert.warning}</p>
                  <p className="text-[10px] font-semibold text-[#14532D]">{alert.buyRecommendation}</p>
                  {alert.quantity != null && (
                    <p className="text-[10px] text-[#15803D]">
                      In pantry: {alert.quantity} {alert.unit}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="p-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[24px] text-xs text-[#14532D] space-y-2">
            <p className="font-bold flex items-center gap-1">
              <ShieldAlert className="h-4 w-4" /> How Agent 5 works
            </p>
            <p className="leading-relaxed">
              Baseline shelf life comes from each item&apos;s <strong>expiry_days</strong> in Supabase. Live weather applies a spoilage modifier (monsoon/rain/humidity). Shopping lists use these windows to flag high-risk perishables.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
