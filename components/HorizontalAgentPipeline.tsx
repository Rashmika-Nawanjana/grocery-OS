'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, MinusCircle, Sparkles, XCircle } from 'lucide-react';
import type { AgentExecutionLog, MealPlanResponse } from '@/lib/types';

const PIPELINE_STEPS = [
  { id: 'orchestrator', short: 'Orch', label: 'Agent 4: Orchestrator' },
  { id: 'inventory-rag', short: 'Inv', label: 'Agent 1: Inventory RAG' },
  { id: 'dietary-guard', short: 'Diet', label: 'Agent 6: Dietary Guard' },
  { id: 'recipe-compiler', short: 'Rcpe', label: 'Agent 2: Recipe Compiler' },
  { id: 'price-catalog', short: 'Price', label: 'Agent 7: Price Catalog' },
  { id: 'route-optimizer', short: 'Route', label: 'Agent 3: Route Optimizer' },
  { id: 'sensory-decay', short: 'Decay', label: 'Agent 5: Sensory Decay' },
  { id: 'crisis-agent', short: 'Crisis', label: 'Agent 7: Crisis Intel' },
] as const;

interface HorizontalAgentPipelineProps {
  logs: AgentExecutionLog[];
  isRunning: boolean;
  mealsResult?: MealPlanResponse | null;
}

function StatusIcon({ status, compact }: { status: AgentExecutionLog['status']; compact?: boolean }) {
  const cls = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
  if (status === 'success') return <CheckCircle2 className={`${cls} text-[#16A34A]`} />;
  if (status === 'active') return <Loader2 className={`${cls} text-[#16A34A] animate-spin`} />;
  if (status === 'skipped') return <MinusCircle className={`${cls} text-stone-400`} />;
  if (status === 'warn') return <XCircle className={`${cls} text-amber-500`} />;
  return <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />;
}

function PipelineConnector({ active }: { active: boolean }) {
  return (
    <div className="relative h-0.5 flex-1 min-w-[12px] max-w-[28px] mx-px rounded-full overflow-hidden">
      <div className={`absolute inset-0 ${active ? 'bg-[#BBF7D0]' : 'bg-stone-200/80'}`} />
      {active && <div className="absolute inset-0 pipeline-flow" />}
    </div>
  );
}

function PipelineNode({
  log,
  step,
  compact,
}: {
  log: AgentExecutionLog;
  step: (typeof PIPELINE_STEPS)[number];
  compact?: boolean;
}) {
  const isActive = log.status === 'active';
  const isSuccess = log.status === 'success';
  const isSkipped = log.status === 'skipped';
  const isWarn = log.status === 'warn';
  const size = compact ? 'w-7 h-7' : 'w-8 h-8';

  return (
    <div className="group relative flex flex-col items-center w-[52px] shrink-0" title={`${log.agentName}\n${log.message}`}>
      <div
        className={`relative flex items-center justify-center ${size} rounded-full border transition-all duration-300 ${
          isSuccess
            ? 'bg-[#DCFCE7] border-[#16A34A]'
            : isActive
              ? 'bg-[#F0FDF4] border-[#16A34A] pipeline-node-pulse'
              : isWarn
                ? 'bg-amber-50 border-amber-400'
                : isSkipped
                  ? 'bg-stone-50 border-stone-200 opacity-45'
                  : 'bg-white border-stone-200'
        }`}
      >
        <StatusIcon status={log.status} compact />
      </div>
      <span className={`text-[8px] font-semibold text-center leading-none mt-0.5 truncate w-full ${isSkipped ? 'text-stone-400' : 'text-[#14532D]'}`}>
        {step.short}
      </span>
    </div>
  );
}

export default function HorizontalAgentPipeline({ logs, isRunning, mealsResult }: HorizontalAgentPipelineProps) {
  const [collapsed, setCollapsed] = useState(false);

  const displayLogs = useMemo(() => {
    const byId = new Map(logs.map((l) => [l.agentId, l]));
    return PIPELINE_STEPS.map((step) => {
      const found = byId.get(step.id);
      return (
        found ?? {
          agentId: step.id,
          agentName: step.label,
          status: 'pending' as const,
          message: isRunning ? 'Queued...' : 'Not run',
        }
      );
    });
  }, [logs, isRunning]);

  const activeAgents = displayLogs.filter((l) => l.status === 'active');
  const completedCount = displayLogs.filter((l) => l.status === 'success' || l.status === 'warn' || l.status === 'skipped').length;

  useEffect(() => {
    if (isRunning) setCollapsed(false);
    else if (logs.some((l) => l.status === 'success' || l.status === 'skipped' || l.status === 'warn')) {
      setCollapsed(true);
    }
  }, [isRunning, logs]);

  const totalSaved = mealsResult ? mealsResult.savingsVsSingleStore + mealsResult.inventorySavings : 0;

  return (
    <div className="border-b border-[#BBF7D0] bg-[#F0FDF4]/30 px-3 py-1.5 shrink-0">
      <div className="flex items-center gap-2 min-h-[28px]">
        <Sparkles className="h-3.5 w-3.5 text-[#16A34A] shrink-0" />
        <span className="text-[9px] font-mono uppercase tracking-wider font-bold text-[#14532D] shrink-0 hidden sm:inline">Pipeline</span>
        {isRunning && (
          <span className="text-[8px] font-semibold text-[#16A34A] bg-[#DCFCE7] px-1.5 py-0.5 rounded-full shrink-0">
            Running · {completedCount}/{PIPELINE_STEPS.length}
          </span>
        )}
        {mealsResult && !isRunning && (
          <span className="text-[9px] text-[#15803D]/80 truncate hidden md:inline shrink-0">
            LKR {Number.isFinite(mealsResult.totalBudgetSpent) ? mealsResult.totalBudgetSpent : 0} spent · +{totalSaved} saved
          </span>
        )}
        <div className="flex-1 min-w-0" />
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-[9px] text-[#15803D] hover:text-[#16A34A] flex items-center gap-0.5 shrink-0 px-1"
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{collapsed ? 'Show' : 'Hide'}</span>
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="overflow-x-auto pb-0.5 -mx-1 px-1 mt-1">
            <div className="flex items-center min-w-max">
              {PIPELINE_STEPS.map((step, index) => {
                const log = displayLogs[index];
                const connectorActive =
                  log.status === 'success' ||
                  log.status === 'active' ||
                  log.status === 'warn' ||
                  (index > 0 && ['success', 'warn', 'skipped'].includes(displayLogs[index - 1]?.status ?? ''));

                return (
                  <div key={step.id} className="flex items-center">
                    <PipelineNode log={log} step={step} compact />
                    {index < PIPELINE_STEPS.length - 1 && <PipelineConnector active={connectorActive} />}
                  </div>
                );
              })}
            </div>
          </div>

          {(isRunning || logs.length > 0) && (
            <div className="mt-1.5 space-y-0.5 max-h-24 overflow-y-auto">
              {activeAgents.length > 0 ? (
                activeAgents.map((l) => (
                  <p key={l.agentId} className="text-[9px] text-[#14532D] flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin text-[#16A34A] shrink-0" />
                    <span className="font-semibold">{l.agentName}:</span>
                    <span className="text-[#15803D] truncate">{l.message}</span>
                  </p>
                ))
              ) : (
                displayLogs
                  .filter((l) => l.status !== 'pending' && l.status !== 'active')
                  .slice(-3)
                  .map((l) => (
                    <p key={`${l.agentId}-${l.status}`} className="text-[9px] text-[#15803D] truncate">
                      <span className="font-semibold text-[#14532D]">{l.agentName}:</span> {l.message}
                    </p>
                  ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
