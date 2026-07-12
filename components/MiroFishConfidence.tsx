'use client';

import { Activity } from 'lucide-react';
import type { MiroFishConfidenceSignal } from '@/lib/types';

function formatValue(value: number, unit: string): string {
  if (unit === '%') return `${Math.round(value)}%`;
  if (unit === 'LKR' || unit === 'LKR/kg') {
    const prefix = unit === 'LKR/kg' ? 'LKR ' : 'LKR ';
    const suffix = unit === 'LKR/kg' ? '/kg' : '';
    return `${prefix}${Math.round(value).toLocaleString()}${suffix}`;
  }
  if (unit === 'min' || unit === 'days') return `${value % 1 ? value.toFixed(1) : Math.round(value)} ${unit}`;
  return `${value} ${unit}`;
}

function ConfidenceBar({ signal }: { signal: MiroFishConfidenceSignal }) {
  const { ciLower, ciUpper, value } = signal;
  const range = ciUpper - ciLower || 1;
  const pointPct = Math.min(100, Math.max(0, ((value - ciLower) / range) * 100));

  return (
    <div className="rounded-2xl border border-[#BBF7D0]/70 bg-[#FBFBFA] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[#14532D] leading-snug">{signal.metric}</p>
        <span className="shrink-0 text-sm font-bold text-[#16A34A] font-mono">
          {formatValue(signal.value, signal.unit)}
        </span>
      </div>

      <div className="relative h-2.5 rounded-full bg-[#E7E5E4] overflow-visible">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#DCFCE7] via-[#BBF7D0] to-[#DCFCE7]" />
        <div
          className="absolute top-1/2 z-10 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-[#16A34A] shadow-md"
          style={{ left: `calc(${pointPct}% - 8px)` }}
          title={`Estimate: ${formatValue(value, signal.unit)}`}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-stone-400">
        <span>{formatValue(ciLower, signal.unit)}</span>
        <span className="text-[#16A34A] font-bold tracking-wide">90% CI</span>
        <span>{formatValue(ciUpper, signal.unit)}</span>
      </div>

      <p className="text-xs text-stone-500 leading-relaxed">{signal.interpretation}</p>
    </div>
  );
}

export default function MiroFishConfidence({ signals }: { signals: MiroFishConfidenceSignal[] }) {
  if (!signals.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Activity className="h-4 w-4 text-[#16A34A]" />
        <p className="text-[10px] font-mono uppercase tracking-widest text-[#16A34A] font-bold">
          Confidence Intervals (90%)
        </p>
      </div>
      <p className="text-xs text-stone-500 px-1 -mt-2">
        Simulated ranges for key outcomes — the dot is the best estimate; the bar shows the likely spread.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {signals.map((s) => (
          <ConfidenceBar key={s.metric} signal={s} />
        ))}
      </div>
    </div>
  );
}
