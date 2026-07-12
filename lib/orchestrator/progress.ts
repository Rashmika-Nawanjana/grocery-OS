import type { AgentExecutionLog, OrchestrationResult } from '@/lib/types';

export type OrchestrationStreamEvent =
  | { type: 'logs'; logs: AgentExecutionLog[] }
  | { type: 'result'; result: OrchestrationResult };

export type OrchestrationProgressCallback = (event: OrchestrationStreamEvent) => void;

export function upsertAgentLog(logs: AgentExecutionLog[], entry: AgentExecutionLog): AgentExecutionLog[] {
  const index = logs.findIndex((l) => l.agentId === entry.agentId);
  if (index >= 0) {
    const next = [...logs];
    next[index] = entry;
    return next;
  }
  return [...logs, entry];
}
