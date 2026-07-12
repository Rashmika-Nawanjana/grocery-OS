'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Shield, Sparkles, AlertTriangle, Heart, RefreshCw } from 'lucide-react';
import type { DietaryScreenResult, FamilyMember } from '@/lib/types';
import { AGENT_DISPLAY_NAMES } from '@/lib/agent-display-names';

interface DietaryFilterViewProps {
  family: FamilyMember[];
  setFamily: React.Dispatch<React.SetStateAction<FamilyMember[]>>;
}

export default function DietaryFilterView({ family }: DietaryFilterViewProps) {
  const [selectedIngredient, setSelectedIngredient] = useState('');
  const [customItem, setCustomItem] = useState('');
  const [testResult, setTestResult] = useState<DietaryScreenResult | null>(null);
  const [rules, setRules] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [loadingRules, setLoadingRules] = useState(true);

  const pantrySuggestions = React.useMemo(() => {
    const fromFamily = family.flatMap((m) => m.favoriteIngredients);
    return [...new Set([...fromFamily, 'rice', 'dhal', 'chicken', 'eggs', 'milk', 'prawns'].filter(Boolean))];
  }, [family]);

  useEffect(() => {
    if (!selectedIngredient && pantrySuggestions.length) {
      setSelectedIngredient(pantrySuggestions[0]);
    }
  }, [pantrySuggestions, selectedIngredient]);

  const loadRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const res = await fetch('/api/dietary/screen');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } finally {
      setLoadingRules(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules, family]);

  const runTest = async (item: string) => {
    if (!item.trim()) return;
    setTesting(true);
    try {
      const res = await fetch('/api/dietary/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: item.trim() }),
      });
      if (res.ok) {
        setTestResult(await res.json());
      }
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    if (selectedIngredient) runTest(selectedIngredient);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIngredient]);

  const activeItem = testResult?.item || selectedIngredient;

  return (
    <div className="space-y-8 animate-fade-in text-[#2D332D]" id="agent6-viewport">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#16A34A] font-extrabold font-sans">AI Dietary Guard</p>
        <h2 className="text-3xl font-serif italic font-bold text-[#14532D] mt-1">{AGENT_DISPLAY_NAMES.dietary}</h2>
        <p className="text-[#15803D] mt-2 text-sm leading-relaxed max-w-3xl">
          Screens ingredients against your Supabase household allergies and restrictions, plus memory dietary notes. Glycemic estimates use Open Food Facts when available.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 space-y-6 shadow-sm">
          <h3 className="font-serif font-bold text-lg text-[#14532D] flex items-center gap-2">
            <Heart className="text-[#16A34A] h-5 w-5" /> Screen Ingredient
          </h3>

          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] block">From household favorites</label>
              <select
                value={selectedIngredient}
                onChange={(e) => setSelectedIngredient(e.target.value)}
                className="w-full text-xs border border-[#BBF7D0] rounded-xl p-3 bg-[#FBFBFA] focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
              >
                {pantrySuggestions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] block">Or type any item</label>
              <div className="flex gap-2">
                <input
                  value={customItem}
                  onChange={(e) => setCustomItem(e.target.value)}
                  placeholder="e.g. white rice"
                  className="flex-1 text-xs border border-[#BBF7D0] rounded-xl p-3 bg-[#FBFBFA] focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                />
                <button
                  type="button"
                  onClick={() => runTest(customItem)}
                  disabled={testing || !customItem.trim()}
                  className="px-3 rounded-xl bg-[#16A34A] text-white text-xs font-bold disabled:opacity-50"
                >
                  Test
                </button>
              </div>
            </div>

            <button
              onClick={() => runTest(selectedIngredient)}
              disabled={testing || !selectedIngredient}
              className="w-full bg-[#16A34A] hover:bg-[#14532D] text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
            >
              {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              {testing ? 'Screening...' : 'Re-run screen'}
            </button>
          </div>

          <div className="pt-4 border-t border-[#BBF7D0] space-y-2.5 text-xs text-[#15803D]">
            <p className="font-bold uppercase tracking-wider text-[9px] text-[#14532D]">Active rules (Supabase + memory)</p>
            {loadingRules ? (
              <p>Loading household rules...</p>
            ) : rules.length ? (
              <div className="space-y-1">
                {rules.map((rule) => (
                  <p key={rule}>• {rule}</p>
                ))}
              </div>
            ) : family.length ? (
              <p>No allergies or restrictions stored yet — edit Profiles under Preferences.</p>
            ) : (
              <p>No family members in database. Add them under Preferences, or POST /api/data to seed demo data.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <h3 className="font-serif font-bold text-lg text-[#14532D] pb-3 border-b border-[#BBF7D0] flex items-center gap-2">
            <Sparkles className="text-[#16A34A] h-5 w-5 animate-pulse" /> Filter Outcome
          </h3>

          {testResult && (
            <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 space-y-6 shadow-sm animate-fade-in">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xl font-bold font-serif text-[#14532D] leading-tight">{activeItem}</h4>
                  <p className="text-[10px] text-[#15803D] uppercase tracking-wider font-mono mt-1">
                    Source: {testResult.source}
                    {testResult.matchedMembers.length ? ` · ${testResult.matchedMembers.join(', ')}` : ''}
                  </p>
                </div>

                <span
                  className={`px-4 py-1.5 rounded-full font-sans text-xs font-bold uppercase tracking-wide border ${
                    testResult.status === 'pass'
                      ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
                      : testResult.status === 'warn'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  {testResult.status === 'pass' ? '✓ SAFE' : testResult.status === 'warn' ? '⚠ REVIEW' : '🚫 BLOCKED'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-[#F0FDF4] p-4 rounded-2xl border border-[#BBF7D0] text-center">
                  <p className="text-[#15803D] text-[10px] uppercase font-mono">Est. Glycemic Index</p>
                  <p className="text-2xl font-bold font-mono text-[#14532D] mt-1">{testResult.glycemicIndex ?? '—'}</p>
                </div>
                <div className="bg-[#F0FDF4] p-4 rounded-2xl border border-[#BBF7D0] text-center">
                  <p className="text-[#15803D] text-[10px] uppercase font-mono">Est. Glycemic Load</p>
                  <p className="text-2xl font-bold font-mono text-[#14532D] mt-1">{testResult.glycemicLoad ?? '—'}</p>
                </div>
                <div className="bg-[#F0FDF4] p-4 rounded-2xl border border-[#BBF7D0] text-center col-span-2 sm:col-span-1">
                  <p className="text-[#15803D] text-[10px] uppercase font-mono">Household hits</p>
                  <p className="text-xs font-semibold text-[#14532D] mt-1.5">
                    {testResult.allergenWarnings.length + testResult.restrictionWarnings.length || 'None'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-[#F0FDF4] rounded-2xl border border-[#BBF7D0] text-xs leading-relaxed text-[#14532D]">
                {testResult.description}
              </div>

              {[...testResult.allergenWarnings, ...testResult.restrictionWarnings].map((warning) => (
                <div key={warning} className="flex gap-2.5 p-4 bg-orange-50 border border-orange-200 text-orange-950 rounded-2xl text-xs">
                  <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <p>{warning}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
