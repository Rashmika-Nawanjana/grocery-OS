'use client';

import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  CloudRain,
  Package,
  Receipt,
  ShoppingBag,
  Thermometer,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import type { MealPlanResponse, StorePrice, WeatherCondition } from '@/lib/types';
import { safeLkr, priceSourceBadge } from '@/lib/services/price-units';
import LocalPlacesView from '@/components/LocalPlacesView';

interface PlanArtifactViewProps {
  mealsResult: MealPlanResponse;
  prices: StorePrice[];
  weather?: WeatherCondition;
  budgetLkr: number;
  animate?: boolean;
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-[#14532D]">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function Section({
  index,
  visible,
  children,
  className = '',
}: {
  index: number;
  visible: number;
  children: React.ReactNode;
  className?: string;
}) {
  if (visible < index) return null;
  return (
    <div className={`animate-fade-in ${className}`} style={{ animationDelay: `${(index - 1) * 90}ms`, opacity: 0 }}>
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'green',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'green' | 'amber' | 'blue';
}) {
  const styles = {
    green: { card: 'from-[#F0FDF4] to-white border-[#BBF7D0] text-[#14532D]', icon: 'text-[#16A34A]' },
    amber: { card: 'from-amber-50 to-white border-amber-200 text-amber-950', icon: 'text-amber-600' },
    blue: { card: 'from-sky-50 to-white border-sky-200 text-sky-950', icon: 'text-sky-600' },
  };
  const s = styles[accent];
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${s.card}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-widest opacity-70 font-bold">{label}</p>
          <p className="text-xl font-serif font-bold mt-1">{value}</p>
          {sub && <p className="text-[10px] mt-1 opacity-75 font-medium">{sub}</p>}
        </div>
        <Icon className={`h-5 w-5 shrink-0 opacity-80 ${s.icon}`} />
      </div>
    </div>
  );
}

function PriceCompareBar({ row }: { row: StorePrice }) {
  const max = Math.max(safeLkr(row.keellsPrice), safeLkr(row.cargillsPrice), safeLkr(row.polaPrice), 1);
  const bars = [
    { label: 'Keells', price: row.keellsPrice, color: 'bg-[#14532D]' },
    { label: 'Cargills', price: row.cargillsPrice, color: 'bg-[#16A34A]' },
    { label: 'Pola', price: row.polaPrice, color: 'bg-[#4ADE80]' },
  ];
  const cheapest = bars.reduce((a, b) => (a.price <= b.price ? a : b));
  const badge = priceSourceBadge(row.sourceType);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-[#14532D]">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="truncate">{row.itemName}</span>
          {badge && (
            <span className={`shrink-0 text-[8px] px-1.5 py-0.5 rounded-full font-mono border ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </span>
        <span className="font-mono text-[#15803D] opacity-80 shrink-0">{row.unit}</span>
      </div>
      {bars.map((b) => (
        <div key={b.label} className="flex items-center gap-2">
          <span className="text-[9px] w-14 shrink-0 font-mono text-[#15803D]">{b.label}</span>
          <div className="flex-1 h-2 bg-[#F0FDF4] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${b.color}`}
              style={{ width: `${Math.max(8, (b.price / max) * 100)}%` }}
            />
          </div>
          <span className={`text-[10px] font-mono w-16 text-right ${b.label === cheapest.label ? 'font-bold text-[#14532D]' : 'text-[#15803D]'}`}>
            {b.price}
            {b.label === cheapest.label && ' ✓'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PlanArtifactView({
  mealsResult,
  prices,
  weather,
  budgetLkr,
  animate = true,
}: PlanArtifactViewProps) {
  const [visible, setVisible] = useState(animate ? 0 : 6);
  const { shoppingList, savingsVsSingleStore, inventorySavings, recipes, mealRoutineMeta, planComparisonMeta, budgetDecision, planCuration, outputMode, contextDish, localBusinesses, placesQuery } =
    mealsResult;
  const totalBudgetSpent = safeLkr(mealsResult.totalBudgetSpent);
  const budget = safeLkr(budgetLkr, 5000);

  const isDineOut = outputMode === 'dine_out';
  const orderOutOnly = isDineOut || (planCuration?.primaryAction === 'order_out' && planCuration.showCount === 0);
  const hasShopping = shoppingList.length > 0 && !orderOutOnly;
  const hasPrices = prices.length > 0 && !orderOutOnly;
  const hasRoutine = Boolean(mealRoutineMeta);
  const hasComparison = Boolean(planComparisonMeta);
  const hasBudgetAdvice = Boolean(budgetDecision && budgetDecision.recommendation !== 'cook_at_home');
  const hasCuration = Boolean(planCuration && planCuration.hiddenCount > 0);
  const perDay = mealRoutineMeta ? Math.round(totalBudgetSpent / mealRoutineMeta.daysPlanned) : null;
  const underBudget = totalBudgetSpent <= budget;

  const hasPlaces = Boolean(localBusinesses?.length);

  useEffect(() => {
    if (!animate) {
      setVisible(6);
      return;
    }
    setVisible(0);
    const max = 6;
    const timers = Array.from({ length: max }, (_, i) =>
      setTimeout(() => setVisible(i + 1), 120 + i * 180)
    );
    return () => timers.forEach(clearTimeout);
  }, [mealsResult, animate]);

  if (!hasShopping && !hasPrices && !recipes.length && !hasBudgetAdvice && !isDineOut) return null;

  return (
    <div className="space-y-4 w-full">
      {isDineOut && contextDish && (
        <Section index={1} visible={visible}>
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-[#14532D]">
            <p className="font-serif font-bold">Ordering instead of cooking</p>
            <p className="text-xs text-[#15803D] mt-1">
              You planned {contextDish} at home — here are nearby spots that may serve it ready-made.
            </p>
          </div>
        </Section>
      )}

      {hasBudgetAdvice && budgetDecision && (
        <Section index={1} visible={visible}>
          <div
            className={`rounded-2xl border p-4 ${
              budgetDecision.recommendation === 'order_out'
                ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-white'
                : 'border-sky-200 bg-gradient-to-r from-sky-50 to-white'
            }`}
          >
            <p className="text-[9px] font-mono uppercase tracking-widest font-bold text-amber-800">
              Orchestrator decision · {budgetDecision.recommendation.replace(/_/g, ' ')}
            </p>
            <p className="text-base font-serif font-bold text-[#14532D] mt-1">{budgetDecision.headline}</p>
            <p className="text-xs text-[#15803D] mt-2 leading-relaxed">{budgetDecision.reason}</p>
            {planCuration && (
              <p className="text-[10px] text-amber-900/80 mt-2 font-mono">
                {planCuration.mealPeriod} · {planCuration.weatherContext}
                {planCuration.hiddenCount > 0 && ` · ${planCuration.hiddenCount} other idea(s) hidden`}
              </p>
            )}
            <div className="flex flex-wrap gap-3 mt-3 text-xs font-mono">
              <span className="bg-white/80 px-2 py-1 rounded-lg border border-amber-200">
                Grocery: LKR {budgetDecision.groceryTotalLkr.toLocaleString()}
              </span>
              <span className="bg-white/80 px-2 py-1 rounded-lg border border-amber-200">
                Budget: LKR {budgetDecision.budgetLkr.toLocaleString()}
              </span>
            </div>
            {budgetDecision.affordablePlaces && budgetDecision.affordablePlaces.length > 0 && !hasPlaces && (
              <ul className="mt-3 space-y-1 text-xs text-[#14532D]">
                {budgetDecision.affordablePlaces.map((p) => (
                  <li key={p.name}>
                    <a href={p.mapsUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#16A34A]">
                      {p.name}
                    </a>
                    {' — '}
                    {p.priceLabel || (p.priceMinLkr ? `from Rs ${p.priceMinLkr}` : 'see Maps')}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      )}

      {isDineOut && !hasPlaces && (
        <Section index={2} visible={visible}>
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900">
            No Maps results for &quot;{placesQuery || contextDish}&quot; — check SERPAPI_KEY or try PickMe / Uber Eats for {contextDish || 'delivery'}.
          </div>
        </Section>
      )}

      {hasPlaces && localBusinesses && (
        <Section index={2} visible={visible}>
          <LocalPlacesView places={localBusinesses} query={placesQuery} animate={animate} />
        </Section>
      )}

      {hasComparison && planComparisonMeta && (
        <Section index={1} visible={visible}>
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4">
            <p className="text-[9px] font-mono uppercase tracking-widest text-emerald-700 font-bold">Savings comparison</p>
            <p className="text-lg font-serif font-bold text-[#14532D] mt-1">
              {planComparisonMeta.savingsLkr > 0
                ? `Save LKR ${planComparisonMeta.savingsLkr.toLocaleString()} with ${planComparisonMeta.variantLabel.toLowerCase()}`
                : `${planComparisonMeta.variantLabel} — LKR ${planComparisonMeta.newTotalLkr.toLocaleString()}`}
            </p>
            <p className="text-xs text-[#15803D] mt-1">
              {planComparisonMeta.previousLabel}: LKR {planComparisonMeta.previousTotalLkr.toLocaleString()} →{' '}
              {planComparisonMeta.variantLabel}: LKR {planComparisonMeta.newTotalLkr.toLocaleString()} ({planComparisonMeta.daysPlanned} days)
            </p>
          </div>
        </Section>
      )}

      <Section index={hasComparison ? 2 : 1} visible={visible}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <MetricCard
            label="Total spend"
            value={orderOutOnly || isDineOut ? 'Order out' : `LKR ${totalBudgetSpent.toLocaleString()}`}
            sub={
              isDineOut && contextDish
                ? `vs ~LKR ${totalBudgetSpent.toLocaleString()} to cook ${contextDish}`
                : orderOutOnly
                  ? `Best cook option ~LKR ${totalBudgetSpent.toLocaleString()}`
                  : perDay
                    ? `~LKR ${perDay}/day`
                    : underBudget
                      ? 'Within budget'
                      : 'Over budget'
            }
            icon={Wallet}
          />
          <MetricCard
            label="Budget"
            value={`LKR ${budget.toLocaleString()}`}
            sub={underBudget && budget > 0 ? `${Math.round(((budget - totalBudgetSpent) / budget) * 100)}% headroom` : 'Consider trimming list'}
            icon={Receipt}
            accent={underBudget ? 'green' : 'amber'}
          />
          {savingsVsSingleStore > 0 && (
            <MetricCard
              label="Multi-store save"
              value={`LKR ${savingsVsSingleStore}`}
              sub="vs one supermarket"
              icon={TrendingDown}
              accent="blue"
            />
          )}
          {inventorySavings > 0 && (
            <MetricCard
              label="Pantry save"
              value={`LKR ${inventorySavings}`}
              sub="from home stock"
              icon={Package}
              accent="green"
            />
          )}
        </div>
      </Section>

      {weather && (
        <Section index={2} visible={visible}>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4]/60 px-4 py-2.5 text-xs text-[#14532D]">
            <Thermometer className="h-3.5 w-3.5 text-[#16A34A]" />
            <span className="font-semibold capitalize">{weather.condition}</span>
            <span>{weather.temperature}°C</span>
            {weather.rainMm > 0 && (
              <>
                <CloudRain className="h-3.5 w-3.5 text-sky-600" />
                <span>{weather.rainMm}mm rain</span>
              </>
            )}
            {mealRoutineMeta && !mealRoutineMeta.hasFridge && (
              <span className="ml-auto text-[10px] font-mono uppercase tracking-wide text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                No fridge — buy fresh often
              </span>
            )}
          </div>
        </Section>
      )}

      {hasShopping && (
        <Section index={3} visible={visible}>
          <div className="rounded-2xl border border-[#BBF7D0] overflow-hidden bg-white">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#F0FDF4] border-b border-[#BBF7D0]">
              <ShoppingBag className="h-4 w-4 text-[#16A34A]" />
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#16A34A] font-bold">Shopping list</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#15803D] border-b border-[#F0FDF4]">
                    <th className="text-left font-mono uppercase tracking-wider px-4 py-2 font-bold">Item</th>
                    <th className="text-right px-3 py-2 font-bold">Qty</th>
                    <th className="text-left px-3 py-2 font-bold">Store</th>
                    <th className="text-right px-4 py-2 font-bold">LKR</th>
                  </tr>
                </thead>
                <tbody>
                  {shoppingList.map((row, i) => (
                    <tr
                      key={`${row.item}-${i}`}
                      className="border-b border-[#F0FDF4] last:border-0 hover:bg-[#F0FDF4]/40 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-semibold text-[#14532D]">{row.item}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#15803D]">
                        {row.requiredQty} {row.unit}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block bg-[#DCFCE7] text-[#14532D] px-2 py-0.5 rounded-full text-[10px] font-bold">
                          {row.store}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-[#14532D]">{row.totalPrice}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F0FDF4]/80">
                    <td colSpan={3} className="px-4 py-2.5 font-bold text-[#14532D]">
                      Total
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-extrabold text-[#16A34A]">
                      LKR {totalBudgetSpent.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </Section>
      )}

      {hasRoutine && mealRoutineMeta && (
        <Section index={4} visible={visible}>
          <div className="rounded-2xl border border-[#BBF7D0] bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#F0FDF4] border-b border-[#BBF7D0]">
              <CalendarDays className="h-4 w-4 text-[#16A34A]" />
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#16A34A] font-bold">
                Shopping schedule — {mealRoutineMeta.daysPlanned} days
              </p>
            </div>
            <div className="p-4 space-y-0">
              {mealRoutineMeta.shoppingTrips.map((trip, i) => (
                <div key={trip.when} className="flex gap-3 pb-4 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-3 rounded-full bg-[#16A34A] ring-4 ring-[#DCFCE7]" />
                    {i < mealRoutineMeta.shoppingTrips.length - 1 && (
                      <div className="w-0.5 flex-1 bg-[#BBF7D0] min-h-[2rem] mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-1">
                    <p className="text-xs font-bold text-[#14532D]">{trip.when}</p>
                    <p className="text-sm text-[#15803D] mt-0.5 font-medium">{trip.items}</p>
                    <p className="text-[11px] text-[#15803D]/80 mt-1 leading-relaxed">{trip.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {hasPrices && (
        <Section index={5} visible={visible}>
          <div className="rounded-2xl border border-[#BBF7D0] bg-white p-4 space-y-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-[#16A34A] font-bold">Store price comparison</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prices.slice(0, 6).map((row) => (
                <PriceCompareBar key={row.itemName} row={row} />
              ))}
            </div>
          </div>
        </Section>
      )}

      {hasCuration && planCuration && (
        <Section index={2} visible={visible}>
          <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4]/50 px-4 py-2.5 text-xs text-[#14532D]">
            <p className="font-semibold">{planCuration.headline}</p>
            {planCuration.recipeRankings.filter((r) => !r.included).length > 0 && (
              <p className="text-[10px] text-[#15803D] mt-1">
                Hidden: {planCuration.recipeRankings.filter((r) => !r.included).map((r) => r.name).join(', ')}
              </p>
            )}
          </div>
        </Section>
      )}

      {recipes.length > 0 && !hasRoutine && (
        <Section index={4} visible={visible}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recipes.slice(0, 3).map((r) => {
              const home = r.ingredients.filter((i) => i.source === 'inventory');
              const shop = r.ingredients.filter((i) => i.source === 'shopping');
              const fromMealDb = /^\d+$/.test(r.id);
              const fromGoogle = r.id.startsWith('google_') || Boolean(r.sourceUrl);
              return (
                <div key={r.id} className="rounded-2xl border border-[#BBF7D0] bg-[#FBFBFA] overflow-hidden">
                  {r.imageUrl ? (
                    <div className="relative aspect-[16/10] bg-[#ECFDF5]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.imageUrl}
                        alt={r.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      {fromMealDb && (
                        <span className="absolute bottom-2 left-2 text-[9px] font-mono uppercase tracking-wider bg-white/90 text-[#14532D] px-1.5 py-0.5 rounded">
                          TheMealDB
                        </span>
                      )}
                      {fromGoogle && !fromMealDb && (
                        <span className="absolute bottom-2 left-2 text-[9px] font-mono uppercase tracking-wider bg-white/90 text-[#14532D] px-1.5 py-0.5 rounded">
                          Google
                        </span>
                      )}
                    </div>
                  ) : null}
                  <div className="p-4 space-y-2">
                    <p className="font-serif font-bold text-[#14532D]">{r.name}</p>
                    <p className="text-[10px] text-[#15803D]">
                      ~{r.prepTimeMin + r.cookTimeMin} min · {r.assignedCook}
                      {!r.imageUrl && fromMealDb ? ' · TheMealDB' : ''}
                      {!r.imageUrl && fromGoogle && !fromMealDb ? ' · Google' : ''}
                    </p>
                    {home.length > 0 && (
                      <p className="text-[11px] text-[#16A34A]">
                        <span className="font-bold">From home:</span> {home.map((i) => i.name).join(', ')}
                      </p>
                    )}
                    {shop.length > 0 && (
                      <p className="text-[11px] text-[#15803D]">
                        <span className="font-bold">Buy:</span>{' '}
                        {shop.map((i) => `${i.name} (${i.amount}${i.unit})`).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {hasRoutine && mealRoutineMeta && mealRoutineMeta.tips.length > 0 && (
        <Section index={6} visible={visible}>
          <div className="rounded-2xl border-2 border-[#16A34A]/25 bg-gradient-to-br from-[#F0FDF4] to-white p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#16A34A] font-bold">Storage & weather tips</p>
            </div>
            <ul className="space-y-2">
              {mealRoutineMeta.tips.map((tip) => (
                <li key={tip} className="flex gap-2 text-xs text-[#14532D] leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#16A34A]" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}
    </div>
  );
}

export function shouldShowNarrativeSummary(mealsResult: MealPlanResponse, assistantText?: string): boolean {
  if (!assistantText?.trim()) return false;
  if (mealsResult.planComparisonMeta) return true;
  if (mealsResult.mealRoutineMeta && mealsResult.shoppingList.length > 0) return false;
  return true;
}

/** Hide duplicate summary when places cards already show the main content. */
export function shouldShowNarrativeWithPlaces(
  mealsResult: MealPlanResponse,
  assistantText?: string,
  localBusinesses?: { length: number }
): boolean {
  if (mealsResult.outputMode === 'dine_out') return Boolean(assistantText?.trim());
  if (mealsResult.budgetDecision?.recommendation === 'order_out') return Boolean(assistantText?.trim());
  if (localBusinesses?.length && !mealsResult.shoppingList.length) return Boolean(assistantText?.trim());
  return shouldShowNarrativeSummary(mealsResult, assistantText);
}

export function PlanNarrativeSummary({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (!paragraphs.length) return null;

  return (
    <div className="space-y-3 text-sm text-[#2D332D] leading-relaxed">
      {paragraphs.map((p) => (
        <p key={p.slice(0, 40)}>{renderInline(p)}</p>
      ))}
    </div>
  );
}
