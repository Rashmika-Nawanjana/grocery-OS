'use client';

import React, { useState } from 'react';
import {
  RefreshCw,
  BarChart2,
  Ship,
  AlertCircle,
  Info,
  GitBranch,
  Users,
  FileText,
  MessageCircle,
  CheckCircle2,
  Lightbulb,
  Sparkles,
  Activity,
} from 'lucide-react';
import type { MiroFishSimulationResult } from '@/lib/types';
import MiroFishAnswer from '@/components/MiroFishAnswer';
import MiroFishInterpretation from '@/components/MiroFishInterpretation';
import MiroFishConfidence from '@/components/MiroFishConfidence';

const EXAMPLE_PROMPTS = [
  'String hoppers or plain hoppers for dinner tonight?',
  'If Keells raises rice prices next month, how should we adjust our weekly shop?',
  'Compare Peliyagoda auction vs Negombo direct boat for skipjack tuna during monsoon',
];

const WORKFLOW_STEPS = [
  { phase: 'seed' as const, label: 'Seed Material', desc: 'Your question becomes scenario input.' },
  { phase: 'graph' as const, label: 'Knowledge Graph', desc: 'Actors and relationships are mapped.' },
  { phase: 'simulation' as const, label: 'Agent Simulation', desc: 'Outcomes are explored under pressure.' },
  { phase: 'report' as const, label: 'Prediction Report', desc: 'Answer and confidence signals synthesized.' },
];

const WORKFLOW_ICONS = {
  seed: FileText,
  graph: GitBranch,
  simulation: Users,
  report: MessageCircle,
};

const TIPS = [
  'Name the decision — e.g. “switch rice brand” not just “rice prices”.',
  'Add a time frame: tonight, next week, or next month.',
  'Include constraints: budget, family size, or weather.',
  'Sri Lankan store/market names improve local accuracy.',
];

function formatMetricValue(value: number, unit: string): string {
  if (unit === '%') return `${Math.round(value)}%`;
  if (unit === 'LKR' || unit === 'LKR/kg') {
    const suffix = unit === 'LKR/kg' ? '/kg' : '';
    return `LKR ${Math.round(value).toLocaleString()}${suffix}`;
  }
  if (unit === 'min' || unit === 'days') return `${value % 1 ? value.toFixed(1) : Math.round(value)} ${unit}`;
  return `${value} ${unit}`;
}

function workflowIndexFromStep(step: string): number {
  const lower = step.toLowerCase();
  if (lower.includes('report') || lower.includes('prediction')) return 3;
  if (lower.includes('simulation') || lower.includes('agent')) return 2;
  if (lower.includes('graph') || lower.includes('knowledge')) return 1;
  return 0;
}

function parseActorCount(text: string): string | null {
  const match = text.match(/mapped (\d+) actor types/);
  return match?.[1] ?? null;
}

function WorkflowPipeline({
  activeIndex,
  complete,
}: {
  activeIndex: number;
  complete: boolean;
}) {
  return (
    <div className="bg-white border border-[#BBF7D0] rounded-[24px] p-5 space-y-4 shadow-sm">
      <p className="text-[10px] font-mono uppercase tracking-widest text-[#16A34A] font-bold">How MiroFish Works</p>
      <div className="space-y-3">
        {WORKFLOW_STEPS.map((step, i) => {
          const Icon = WORKFLOW_ICONS[step.phase];
          const isDone = complete || i < activeIndex;
          const isActive = !complete && i === activeIndex;
          return (
            <div key={step.phase} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                    isDone
                      ? 'bg-[#16A34A] border-[#16A34A] text-white'
                      : isActive
                        ? 'bg-[#F0FDF4] border-[#16A34A] text-[#16A34A]'
                        : 'bg-[#FBFBFA] border-[#BBF7D0] text-stone-400'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className={`w-px flex-1 min-h-[12px] mt-1 ${isDone ? 'bg-[#16A34A]' : 'bg-[#BBF7D0]'}`} />
                )}
              </div>
              <div className="pb-1 pt-0.5">
                <p className={`text-xs font-bold ${isDone || isActive ? 'text-[#14532D]' : 'text-stone-400'}`}>
                  0{i + 1} {step.label}
                </p>
                <p className="text-[10px] text-stone-500 leading-snug mt-0.5">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportSnapshot({
  result,
  sourceLabel,
}: {
  result: MiroFishSimulationResult;
  sourceLabel: string;
}) {
  const actorCount = parseActorCount(result.promptInterpretation);
  const topSignals = result.confidenceSignals?.slice(0, 2) ?? [];

  return (
    <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[24px] p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[#16A34A] font-bold">Report Snapshot</p>
        <span className="text-[9px] font-mono uppercase bg-white text-[#16A34A] px-2 py-0.5 rounded-full border border-[#BBF7D0]">
          Complete
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {actorCount && (
          <div className="rounded-xl bg-white border border-[#BBF7D0]/80 p-3">
            <p className="text-[9px] font-mono text-stone-400 uppercase">Actors</p>
            <p className="text-lg font-bold text-[#14532D] font-mono">{actorCount}</p>
          </div>
        )}
        {result.confidenceSignals && (
          <div className="rounded-xl bg-white border border-[#BBF7D0]/80 p-3">
            <p className="text-[9px] font-mono text-stone-400 uppercase">Signals</p>
            <p className="text-lg font-bold text-[#14532D] font-mono">{result.confidenceSignals.length}</p>
          </div>
        )}
      </div>

      {sourceLabel && (
        <p className="text-[10px] text-stone-500 font-mono flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-[#16A34A]" />
          {sourceLabel}
        </p>
      )}

      {topSignals.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-mono uppercase text-[#15803D] font-bold flex items-center gap-1">
            <Activity className="h-3 w-3" /> Top signals
          </p>
          {topSignals.map((s) => (
            <div key={s.metric} className="rounded-xl bg-white border border-[#BBF7D0]/80 px-3 py-2">
              <div className="flex justify-between gap-2 items-start">
                <p className="text-[10px] text-[#14532D] leading-snug line-clamp-2">{s.metric}</p>
                <span className="text-[10px] font-bold text-[#16A34A] font-mono shrink-0">
                  {formatMetricValue(s.value, s.unit)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {result.workflowSteps.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-[#BBF7D0]">
          {result.workflowSteps.map((step, i) => {
            const Icon = WORKFLOW_ICONS[step.phase];
            return (
              <div key={step.phase} className="flex items-start gap-2">
                <Icon className="h-3 w-3 text-[#16A34A] shrink-0 mt-0.5" />
                <p className="text-[9px] text-stone-500 leading-snug">
                  <span className="font-bold text-[#14532D]">0{i + 1}</span> {step.message}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TipsCard() {
  return (
    <div className="bg-white border border-[#BBF7D0] rounded-[24px] p-5 space-y-3 shadow-sm">
      <p className="text-[10px] font-mono uppercase tracking-widest text-[#16A34A] font-bold flex items-center gap-1.5">
        <Lightbulb className="h-3.5 w-3.5" /> Better predictions
      </p>
      <ul className="space-y-2">
        {TIPS.map((tip) => (
          <li key={tip} className="text-[11px] text-stone-600 leading-relaxed flex gap-2">
            <span className="text-[#16A34A] shrink-0">•</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MiroFishView() {
  const [prompt, setPrompt] = useState('');
  const [runningSim, setRunningSim] = useState(false);
  const [simStep, setSimStep] = useState('');
  const [result, setResult] = useState<MiroFishSimulationResult | null>(null);
  const [error, setError] = useState('');

  const executeSimulation = async () => {
    if (!prompt.trim()) {
      setError('Enter a question to run through MiroFish.');
      return;
    }

    setError('');
    setRunningSim(true);
    setResult(null);
    setSimStep('Seed Material: sending your question to MiroFish...');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);

      const res = await fetch('/api/mirofish/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = (await res.json()) as MiroFishSimulationResult;

      if (!res.ok || !data.success) {
        setError(data.error || 'Simulation failed. Please try again.');
        setRunningSim(false);
        setSimStep('');
        return;
      }

      const steps = data.simulationSteps?.length
        ? data.simulationSteps
        : data.workflowSteps.map((s) => `${s.label}: ${s.message}`);

      for (let i = 0; i < steps.length; i++) {
        setSimStep(steps[i]);
        await new Promise((r) => setTimeout(r, 600));
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error && err.name === 'AbortError'
          ? 'Request timed out. Try a shorter question or check your connection.'
          : 'Could not reach MiroFish API. Check your connection and try again.'
      );
    } finally {
      setRunningSim(false);
      setSimStep('');
    }
  };

  const sourceLabel =
    result?.source === 'live'
      ? 'MiroFish live seed + prediction'
      : result?.source === 'gemini'
        ? 'MiroFish prediction engine'
        : result?.source === 'local'
          ? 'Offline fallback'
          : '';

  const activeWorkflowIndex = result
    ? WORKFLOW_STEPS.length
    : runningSim
      ? workflowIndexFromStep(simStep)
      : 0;

  return (
    <div className="space-y-8 animate-fade-in text-[#2D332D]" id="mirofish-viewport">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#16A34A] font-extrabold font-sans">Scenario Prediction</p>
        <h2 className="text-3xl font-serif italic font-bold text-[#14532D] mt-1">MiroFish</h2>
        <p className="text-[#15803D] mt-2 text-sm leading-relaxed max-w-3xl">
          Ask anything. MiroFish runs seed → knowledge graph → agent simulation → prediction report on your scenario.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8 items-start">
        <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 space-y-5 shadow-sm">
            <h3 className="font-serif font-bold text-base text-[#14532D] flex items-center gap-2">
              <Ship className="text-[#16A34A] h-5 w-5" /> Your Question
            </h3>

            <div className="space-y-1.5 text-xs">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                placeholder="Ask MiroFish anything — food, shopping, pricing, logistics, family decisions..."
                className="w-full text-xs border border-[#BBF7D0] rounded-xl p-3 bg-[#FBFBFA] focus:outline-none focus:ring-2 focus:ring-[#16A34A] resize-none leading-relaxed"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setPrompt(ex)}
                    className="text-[9px] px-2 py-1 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D] hover:bg-[#DCFCE7] transition-colors text-left"
                  >
                    {ex.slice(0, 52)}…
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={executeSimulation}
              disabled={runningSim}
              className="w-full bg-[#16A34A] hover:bg-[#14532D] disabled:opacity-60 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              {runningSim ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
              {runningSim ? 'Running...' : 'Ask MiroFish'}
            </button>
          </div>

          {runningSim && (
            <div className="bg-[#2D332D] border border-stone-800 rounded-[24px] p-5 font-mono text-xs text-[#E8F5E9] space-y-2 shadow-inner">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#16A34A] animate-ping" />
                <span className="text-[#10B981]">MIROFISH: SEED → GRAPH → SIMULATION → REPORT</span>
              </div>
              <p className="text-white">➔ {simStep}</p>
            </div>
          )}

          {result ? (
            <ReportSnapshot result={result} sourceLabel={sourceLabel} />
          ) : (
            <TipsCard />
          )}

          <WorkflowPipeline activeIndex={activeWorkflowIndex} complete={Boolean(result)} />
        </div>

        <div className="lg:col-span-3 space-y-6 min-w-0">
          <div className="flex justify-between items-center pb-3 border-b border-[#BBF7D0]">
            <h3 className="font-serif font-bold text-lg text-[#14532D]">Prediction Report</h3>
            <span className="text-[10px] font-mono uppercase bg-[#F0FDF4] text-[#16A34A] px-2.5 py-0.5 rounded-full border border-[#BBF7D0]">
              {result ? 'Complete' : runningSim ? 'Running' : 'Awaiting Question'}
            </span>
          </div>

          {!result && !runningSim && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 border border-dashed border-[#BBF7D0] rounded-[32px] bg-[#FBFBFA]">
              <Info className="h-8 w-8 text-[#BBF7D0]" />
              <p className="text-sm text-[#15803D] font-medium">Ask MiroFish a question</p>
              <p className="text-xs text-stone-400 max-w-md">
                MiroFish predicts how your scenario could unfold — meals, shopping, pricing, logistics, or any decision.
              </p>
            </div>
          )}

          {runningSim && !result && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 border border-[#BBF7D0] rounded-[32px] bg-[#F0FDF4]/50">
              <RefreshCw className="h-8 w-8 text-[#16A34A] animate-spin" />
              <p className="text-sm text-[#15803D] font-medium">Building your prediction report…</p>
              <p className="text-xs text-stone-500 max-w-sm font-mono">{simStep}</p>
            </div>
          )}

          {result && (
            <div className="space-y-6 animate-fade-in">
              {result.promptInterpretation && (
                <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-[#16A34A] font-bold">What we understood</p>
                    {sourceLabel && (
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white border border-[#BBF7D0] text-stone-500">
                        {sourceLabel}
                      </span>
                    )}
                  </div>
                  <MiroFishInterpretation text={result.promptInterpretation} />
                </div>
              )}

              {result.confidenceSignals && result.confidenceSignals.length > 0 && (
                <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 shadow-sm">
                  <MiroFishConfidence signals={result.confidenceSignals} />
                </div>
              )}

              <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 space-y-4 shadow-sm">
                {result.warning && (
                  <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{result.warning}</span>
                  </div>
                )}
                <p className="text-[10px] font-mono uppercase tracking-widest text-[#16A34A] font-bold">MiroFish Answer</p>
                <MiroFishAnswer answer={result.answer} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
