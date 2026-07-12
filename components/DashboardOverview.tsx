'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CloudRain,
  Sun,
  AlertTriangle,
  Route,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  Clock,
  RefreshCw,
  Cloud,
} from 'lucide-react';
import type { CrisisAlert, FamilyMember, MealPlanResponse, TrafficCondition, WeatherCondition } from '@/lib/types';

interface DashboardOverviewProps {
  weather: WeatherCondition;
  setWeather: (w: WeatherCondition) => void;
  traffic: TrafficCondition;
  setTraffic: (t: TrafficCondition) => void;
  crisis: CrisisAlert;
  setCrisis: (c: CrisisAlert) => void;
  family: FamilyMember[];
  inventoryValue: number;
  unpurchasedItems: number;
  mealsResult: MealPlanResponse | null;
  visibleHouseholdNames: string[];
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Not refreshed yet';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diffMs / 60000));
  if (mins < 1) return 'Updated just now';
  if (mins === 1) return 'Updated 1 min ago';
  if (mins < 60) return `Updated ${mins} mins ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? 'Updated 1 hour ago' : `Updated ${hrs} hours ago`;
}

function weatherSourceLabel(source?: WeatherCondition['source']) {
  if (source === 'openweather') return 'Live · OpenWeatherMap';
  if (source === 'fallback') return 'Offline fallback — set WEATHER_API_KEY';
  return 'Awaiting live fetch';
}

function crisisSourceLabel(source?: CrisisAlert['source']) {
  if (source === 'newsapi') return 'Live · NewsAPI';
  if (source === 'unconfigured') return 'Set NEWS_API_KEY in .env';
  if (source === 'error') return 'NewsAPI fetch failed';
  return 'Awaiting live fetch';
}

function weatherLabel(condition: WeatherCondition['condition'], location?: string) {
  const place = location ? ` · ${location}` : '';
  if (condition === 'monsoon') return `Monsoon${place}`;
  if (condition === 'rainy') return `Rainy${place}`;
  if (condition === 'humid') return `Humid${place}`;
  return `Sunny${place}`;
}

function spoilageLabel(modifier: number, condition: WeatherCondition['condition']) {
  if (modifier <= 0.55 || condition === 'monsoon') return 'Accelerated spoilage — buy less perishables';
  if (modifier < 0.85) return 'Moderate spoilage risk';
  return 'Normal decay rate';
}

function climateDetail(weather: WeatherCondition) {
  if (weather.rainMm > 10) return `Rain ${weather.rainMm} mm/hr · spoilage ×${weather.spoilageModifier.toFixed(2)}`;
  if (weather.condition === 'humid') return `Humidity high · spoilage ×${weather.spoilageModifier.toFixed(2)}`;
  return `Spoilage modifier ×${weather.spoilageModifier.toFixed(2)}`;
}

function crisisDetail(crisis: CrisisAlert) {
  if (crisis.type === 'none') return crisis.warningText || 'No active alerts in live news feeds';
  return crisis.warningText;
}

export default function DashboardOverview({
  weather,
  setWeather,
  traffic,
  setTraffic,
  crisis,
  setCrisis,
  family,
  inventoryValue,
  unpurchasedItems,
  mealsResult,
  visibleHouseholdNames,
}: DashboardOverviewProps) {
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const refreshEnv = useCallback(async () => {
    setRefreshing(true);
    setFetchError('');
    try {
      const res = await fetch('/api/dashboard/env');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refresh failed');
      setWeather(data.weather);
      setTraffic(data.traffic);
      setCrisis(data.crisis);
      setFetchedAt(data.fetchedAt);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Could not refresh live data');
    } finally {
      setRefreshing(false);
    }
  }, [setWeather, setTraffic, setCrisis]);

  useEffect(() => {
    refreshEnv();
  }, [refreshEnv]);

  const activeHousehold = useMemo(() => {
    const seen = new Set<string>();
    const members: FamilyMember[] = [];
    for (const name of visibleHouseholdNames) {
      if (seen.has(name)) continue;
      const member = family.find((m) => m.name === name);
      if (member) {
        seen.add(name);
        members.push(member);
      }
    }
    return members;
  }, [family, visibleHouseholdNames]);

  const hasDiabeticFilter = activeHousehold.some((m) =>
    m.dietaryRestrictions.some((r) => /diabetic|low-carb|low-sugar/i.test(r))
  );
  const hasAllergenFilter = activeHousehold.some((m) => m.allergies.length > 0);

  const inventorySavingsText = useMemo(() => {
    if (!mealsResult?.inventorySavings) return null;
    const total = mealsResult.totalBudgetSpent + mealsResult.inventorySavings;
    if (total <= 0) return `Home stock used — LKR ${mealsResult.inventorySavings.toLocaleString()} saved`;
    const pct = Math.round((mealsResult.inventorySavings / total) * 100);
    return `Home stock offset ${pct}% of last plan (LKR ${mealsResult.inventorySavings.toLocaleString()})`;
  }, [mealsResult]);

  const wasteScore = useMemo(() => {
    if (mealsResult?.savingsVsSingleStore != null && mealsResult.totalBudgetSpent > 0) {
      const base = mealsResult.totalBudgetSpent + mealsResult.savingsVsSingleStore;
      return Math.min(99, Math.round((mealsResult.savingsVsSingleStore / base) * 100));
    }
    if (weather.spoilageModifier < 1) {
      return Math.round(weather.spoilageModifier * 100);
    }
    return null;
  }, [mealsResult, weather.spoilageModifier]);

  const wasteDescription = mealsResult?.savingsVsSingleStore
    ? `Multi-store routing saved LKR ${mealsResult.savingsVsSingleStore.toLocaleString()} vs single-store shopping.`
    : weather.spoilageModifier < 1
      ? spoilageLabel(weather.spoilageModifier, weather.condition)
      : 'Run a meal query to measure waste mitigation from your latest plan.';

  const WeatherIcon =
    weather.condition === 'monsoon' || weather.condition === 'rainy'
      ? CloudRain
      : weather.condition === 'humid'
        ? Cloud
        : Sun;

  return (
    <div className="space-y-8 animate-fade-in text-[#2D332D]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#16A34A] font-extrabold font-sans">Active Status Control</p>
          <h2 className="text-3xl font-serif italic font-bold text-[#14532D] mt-1">SaaS Family Dashboard</h2>
          <p className="text-[#15803D] mt-2 text-sm leading-relaxed max-w-3xl">
            Live inventory, household, weather, traffic, and crisis signals from your plango pipeline and external APIs.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshEnv}
          disabled={refreshing}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#16A34A] text-white hover:bg-[#14532D] disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh live data'}
        </button>
      </div>

      {fetchError && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{fetchError}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-[#BBF7D0] relative overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="absolute right-4 top-4 text-[#BBF7D0] opacity-40">
            <Sparkles className="h-16 w-16" />
          </div>
          <p className="text-[10px] uppercase tracking-wider text-[#15803D] font-bold">Home Stock Value</p>
          <p className="text-3xl font-light text-[#2D332D] mt-2">
            {inventoryValue.toLocaleString()} <span className="text-lg opacity-60">LKR</span>
          </p>
          {inventorySavingsText ? (
            <div className="text-xs text-[#15803D] mt-4 flex items-center gap-1.5 bg-[#F0FDF4] py-1.5 px-3 rounded-xl w-max border border-[#BBF7D0]">
              <TrendingDown className="h-3.5 w-3.5 text-[#16A34A]" />
              <span>{inventorySavingsText}</span>
            </div>
          ) : (
            <p className="text-[11px] text-stone-500 mt-4">Estimated from pantry items and latest catalog prices.</p>
          )}
        </div>

        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-[#BBF7D0] relative overflow-hidden transition-all duration-305 hover:shadow-md">
          <p className="text-[10px] uppercase tracking-wider text-[#15803D] font-bold">Active Household Profiles</p>
          <p className="text-3xl font-light text-[#2D332D] mt-2">
            {activeHousehold.length}{' '}
            <span className="text-lg opacity-60">{activeHousehold.length === 1 ? 'Person' : 'Persons'}</span>
          </p>
          <p className="text-[11px] text-stone-500 mt-2">Profiles shown on Preferences Panel</p>
          <div className="flex gap-2 mt-4 flex-wrap">
            {hasDiabeticFilter && (
              <span className="text-[10px] bg-[#F0FDF4] text-[#16A34A] px-2.5 py-0.5 rounded-full font-semibold border border-[#BBF7D0]">
                diabetic filter active
              </span>
            )}
            {hasAllergenFilter && (
              <span className="text-[10px] bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full font-semibold border border-red-100 font-sans">
                allergen filter active
              </span>
            )}
            {!hasDiabeticFilter && !hasAllergenFilter && (
              <span className="text-[10px] text-stone-500">No dietary filters configured yet.</span>
            )}
          </div>
          {unpurchasedItems > 0 && (
            <p className="text-[11px] text-[#15803D] mt-3 font-mono">{unpurchasedItems} items on active shopping list</p>
          )}
        </div>

        <div className="bg-[#16A34A] rounded-[32px] p-6 shadow-sm text-white flex flex-col justify-between transition-all duration-300 hover:shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider opacity-90 font-bold">Food Waste Mitigation</span>
              {wasteScore != null && (
                <span className="text-xs font-mono font-bold text-[#14532D] bg-[#DCFCE7] px-2.5 py-0.5 rounded-md border border-[#BBF7D0]">
                  {wasteScore}% score
                </span>
              )}
            </div>
            {wasteScore != null && (
              <div className="w-full bg-white/20 h-1.5 mt-3 rounded-full overflow-hidden">
                <div className="bg-white h-full rounded-full transition-all duration-500" style={{ width: `${wasteScore}%` }} />
              </div>
            )}
            <p className="text-white/90 text-[11px] mt-2">{wasteDescription}</p>
          </div>
          <div className="text-[10px] text-white/75 mt-2 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> {formatRelativeTime(fetchedAt)}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 shadow-sm">
        <h3 className="text-xs font-bold text-[#14532D] tracking-widest uppercase mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#16A34A]" />
          Live Data Feeds
        </h3>
        <p className="text-xs text-[#15803D] mb-5 leading-relaxed">
          Weather from OpenWeatherMap; crisis headlines from NewsAPI; traffic from live routing or the Route Optimizer after each chat run.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col items-start p-4 rounded-2xl border border-[#BBF7D0] bg-[#FBFBFA] text-left">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-[#C6F6D5] text-[#14532D]">
                <WeatherIcon className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-[#2D332D] capitalize">{weatherLabel(weather.condition, weather.location)}</span>
            </div>
            <span className="text-[10px] text-[#15803D]">{climateDetail(weather)}</span>
            <span className="text-[9px] font-mono text-[#16A34A] mt-2">{weatherSourceLabel(weather.source)}</span>
          </div>

          <div className="flex flex-col items-start p-4 rounded-2xl border border-[#BBF7D0] bg-[#FBFBFA] text-left">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`p-1.5 rounded-lg ${
                  traffic.status === 'blocked'
                    ? 'bg-red-50 text-red-700'
                    : traffic.status === 'congested'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-[#C6F6D5] text-[#14532D]'
                }`}
              >
                <Route className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-[#2D332D] capitalize">Traffic: {traffic.status}</span>
            </div>
            <span className="text-[10px] text-[#15803D]">
              {traffic.estimatedTimeMin > 0
                ? `Commute ~${traffic.estimatedTimeMin} mins · LKR ${traffic.fuelAdjustedCostLkr}`
                : 'Awaiting live traffic snapshot'}
            </span>
            <span className="text-[9px] font-mono text-[#16A34A] mt-2">From Route Optimizer agent</span>
          </div>

          <div className="flex flex-col items-start p-4 rounded-2xl border border-[#BBF7D0] bg-[#FBFBFA] text-left">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`p-1.5 rounded-lg ${
                  crisis.type !== 'none' ? 'bg-orange-50 text-orange-700' : 'bg-[#C6F6D5] text-[#14532D]'
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-[#2D332D] capitalize">
                Alert: {crisis.type === 'none' ? 'none' : crisis.type}
              </span>
            </div>
            <span className="text-[10px] text-[#15803D] line-clamp-2">{crisisDetail(crisis)}</span>
            <span className="text-[9px] font-mono text-[#16A34A] mt-2">{crisisSourceLabel(crisis.source)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-[#BBF7D0] rounded-[32px] p-6 bg-white shadow-sm space-y-4">
          <h4 className="font-serif text-lg font-bold text-[#14532D] flex items-center gap-2">
            <CloudRain className="text-[#16A34A] h-5 w-5" /> Weather Spoilage Sensors
          </h4>
          <p className="text-[#15803D] text-xs leading-relaxed">
            Perishable quantities adjust when humidity or rain increases decay risk in {weather.location || 'your area'}.
          </p>

          <div className="grid grid-cols-2 gap-3 text-xs bg-[#FBFBFA] p-4 rounded-2xl border border-[#BBF7D0]">
            <div>
              <p className="text-[#15803D] font-mono text-[10px] uppercase">Condition</p>
              <p className="text-[#2D332D] font-semibold mt-1 capitalize">{weatherLabel(weather.condition)}</p>
            </div>
            <div>
              <p className="text-[#15803D] font-mono text-[10px] uppercase">Temperature</p>
              <p className="text-[#2D332D] font-semibold mt-1">{weather.temperature}°C</p>
            </div>
            <div className="mt-2">
              <p className="text-[#15803D] font-mono text-[10px] uppercase">Rain Vol</p>
              <p className="text-[#2D332D] font-semibold mt-1">{weather.rainMm} mm/hr</p>
            </div>
            <div className="mt-2">
              <p className="text-[#15803D] font-mono text-[10px] uppercase">Spoilage</p>
              <p className="text-[#2D332D] font-semibold mt-1 text-[#16A34A] font-mono">
                {spoilageLabel(weather.spoilageModifier, weather.condition)}
              </p>
            </div>
          </div>

          {weather.forecast && weather.forecast.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase text-[#15803D] font-bold">Short forecast</p>
              <div className="flex flex-wrap gap-2">
                {weather.forecast.map((f) => (
                  <span
                    key={f.date}
                    className="text-[10px] px-2.5 py-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#14532D]"
                  >
                    {f.date}: {f.condition} {f.rainMm > 0 ? `· ${f.rainMm}mm` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border border-[#BBF7D0] rounded-[32px] p-6 bg-white shadow-sm space-y-4">
          <h4 className="font-serif text-lg font-bold text-[#14532D] flex items-center gap-2">
            <AlertTriangle className="text-orange-600 h-5 w-5" /> Transit and Emergency Alerts
          </h4>
          <p className="text-[#15803D] text-xs leading-relaxed">
            Route and crisis signals reroute shopping when corridors are congested or alerts are active.
          </p>

          <div className="space-y-3">
            <div className="bg-[#FBFBFA] p-3.5 rounded-2xl border border-[#BBF7D0] text-xs">
              <div className="flex justify-between items-center gap-2">
                <span className="font-semibold text-[#2D332D]">{traffic.route || 'Route pending'}</span>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono shrink-0 ${
                    traffic.status === 'blocked'
                      ? 'bg-red-50 text-red-700 border border-red-100'
                      : traffic.status === 'congested'
                        ? 'bg-amber-50 text-amber-700 border border-amber-100'
                        : 'bg-green-50 text-green-700 border border-green-100'
                  }`}
                >
                  {traffic.status.toUpperCase()}
                </span>
              </div>
              {traffic.estimatedTimeMin > 0 && (
                <p className="text-[#15803D] text-[11px] mt-1">
                  Commute ~{traffic.estimatedTimeMin} mins · fuel LKR {traffic.fuelAdjustedCostLkr}
                  {traffic.recommendedStore ? ` · prefer ${traffic.recommendedStore}` : ''}
                </p>
              )}
              {traffic.alternativeRoute && (
                <div className="mt-2 p-2 bg-[#F0FDF4] rounded-xl text-[10px] text-[#14532D] border-l-2 border-[#16A34A]">
                  Alternative: {traffic.alternativeRoute}
                  {traffic.alternativeTimeMin ? ` (~${traffic.alternativeTimeMin} mins)` : ''}
                </div>
              )}
            </div>

            {crisis.type !== 'none' ? (
              <div className="bg-orange-50 border border-orange-100 p-3 rounded-2xl flex gap-3 text-xs">
                <ShieldAlert className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-orange-950 uppercase text-[10px]">
                    {crisis.type} alert · {crisis.severity}
                  </p>
                  <p className="text-stone-600 text-[11px] mt-0.5 leading-relaxed">{crisis.warningText}</p>
                  {crisis.affectedAreas.length > 0 && (
                    <p className="text-[10px] text-orange-800 mt-1">Areas: {crisis.affectedAreas.join(', ')}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-stone-500 bg-[#FBFBFA] border border-[#BBF7D0] rounded-xl px-3 py-2">
                {crisis.warningText}
              </p>
            )}

            {crisis.newsHeadlines && crisis.newsHeadlines.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-mono uppercase text-[#15803D] font-bold">Live headlines</p>
                {crisis.newsHeadlines.slice(0, 3).map((headline) => (
                  <p key={headline} className="text-[10px] text-stone-600 leading-snug">
                    · {headline}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
