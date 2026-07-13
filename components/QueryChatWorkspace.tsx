'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import type { InventoryItem, FamilyMember, AgentExecutionLog, UserMemorySnapshot, OrchestrationResult } from '@/lib/types';
import type { QuerySession, QueryTurn } from '@/lib/chat-sessions';
import { createEmptyTurn, getActiveTurn, sessionTitleFromPrompt } from '@/lib/chat-sessions';
import {
  applyClarificationAnswers,
  detectMissingDetails,
  extractBudgetFromPrompt,
  type ClarificationFieldId,
} from '@/lib/query-clarification';
import HorizontalAgentPipeline from '@/components/HorizontalAgentPipeline';
import AgentSourcesFooter from '@/components/AgentSourcesFooter';
import PlanArtifactView, { PlanNarrativeSummary, shouldShowNarrativeWithPlaces } from '@/components/PlanArtifactView';
import LocalPlacesView from '@/components/LocalPlacesView';
import ClarificationCard from '@/components/ClarificationCard';

interface QueryChatWorkspaceProps {
  session: QuerySession;
  onSessionUpdate: (session: QuerySession) => void;
  onSelectTurn: (turnId: string) => void;
  inventory: InventoryItem[];
  family: FamilyMember[];
  memory?: UserMemorySnapshot;
  onMemoryUpdate?: (memory: UserMemorySnapshot) => void;
}

const PRESETS = [
  { title: '🥪 Daily Sandwiches', text: 'I am planning to eat sandwiches every morning from tomorrow. I dont have a fridge — how much should I buy and how often?' },
  { title: '🍽️ Already Decided', text: 'I already decided to cook dhal curry and chicken fry tonight. Find prices and best route.' },
  { title: '💡 Need Suggestions', text: 'Suggest 3 diabetic-friendly dinners for family of 4, no fish, budget LKR 5000, use home inventory' },
  { title: '🛒 Shopping Trip', text: 'I am going shopping now. Compare rice, dhal, eggs, chicken prices and check for flood warnings.' },
];

const PENDING_LOGS: AgentExecutionLog[] = [
  { agentId: 'orchestrator', agentName: 'Agent 4: Orchestrator', status: 'active', message: 'Classifying intent...' },
  { agentId: 'inventory-rag', agentName: 'Agent 1: Home Inventory RAG', status: 'pending', message: 'Queued...' },
  { agentId: 'dietary-guard', agentName: 'Agent 6: Dietary Guard', status: 'pending', message: 'Queued...' },
  { agentId: 'recipe-compiler', agentName: 'Agent 2: Recipe Compiler', status: 'pending', message: 'Queued...' },
  { agentId: 'price-catalog', agentName: 'Agent 7: Price Catalog', status: 'pending', message: 'Queued...' },
  { agentId: 'route-optimizer', agentName: 'Agent 3: Route Optimizer', status: 'pending', message: 'Queued...' },
  { agentId: 'sensory-decay', agentName: 'Agent 5: Sensory Decay', status: 'pending', message: 'Queued...' },
  { agentId: 'crisis-agent', agentName: 'Agent 7: Crisis Intelligence', status: 'pending', message: 'Queued...' },
];

export default function QueryChatWorkspace({
  session,
  onSessionUpdate,
  onSelectTurn,
  inventory,
  family,
  memory,
  onMemoryUpdate,
}: QueryChatWorkspaceProps) {
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const isNewSession = session.turns.length === 0;
  const hasStarted = session.turns.some((t) => t.status === 'complete' || t.status === 'pending');
  const panelTurn = getActiveTurn(session);
  const pipelineRunning = running || panelTurn?.status === 'pending';
  const awaitingTurn = [...session.turns].reverse().find((t) => t.status === 'awaiting_input');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.turns, running]);

  const runQuery = async (
    text: string,
    opts?: {
      budgetLkr?: number;
      displayText?: string;
      replaceTurnId?: string;
      baseSession?: QuerySession;
    }
  ) => {
    if (running || !text.trim()) return;
    setRunning(true);
    setErrorText(null);

    const base = opts?.baseSession ?? sessionRef.current;
    const budgetLkr = opts?.budgetLkr ?? extractBudgetFromPrompt(text) ?? base.budgetLkr;
    const isFollowUp = base.turns.some((t) => t.status === 'complete');
    const displayText = opts?.displayText ?? text.trim();

    let turn: QueryTurn;
    let updatedSession: QuerySession;

    if (opts?.replaceTurnId) {
      const existing = base.turns.find((t) => t.id === opts.replaceTurnId);
      turn = {
        ...(existing ?? createEmptyTurn(displayText, isFollowUp)),
        id: opts.replaceTurnId,
        userText: displayText,
        assistantText: '',
        isFollowUp,
        status: 'pending',
        agentLogs: PENDING_LOGS.map((l) => ({
          ...l,
          message: isFollowUp && l.agentId === 'orchestrator' ? 'Processing follow-up...' : l.message,
        })),
        mealsResult: null,
        clarification: undefined,
      };
      updatedSession = {
        ...base,
        title: isFollowUp ? base.title : sessionTitleFromPrompt(displayText),
        budgetLkr,
        turns: base.turns.map((t) => (t.id === opts.replaceTurnId ? turn : t)),
        activeTurnId: turn.id,
        updatedAt: new Date().toISOString(),
      };
    } else {
      turn = createEmptyTurn(displayText, isFollowUp);
      turn.agentLogs = PENDING_LOGS.map((l) => ({
        ...l,
        message: isFollowUp && l.agentId === 'orchestrator' ? 'Processing follow-up...' : l.message,
      }));
      updatedSession = {
        ...base,
        title: isFollowUp ? base.title : sessionTitleFromPrompt(displayText),
        budgetLkr,
        turns: [...base.turns, turn],
        activeTurnId: turn.id,
        updatedAt: new Date().toISOString(),
      };
    }

    onSessionUpdate(updatedSession);
    onSelectTurn(turn.id);
    setInput('');

    try {
      const priorTurns = base.turns.filter((t) => t.status === 'complete');
      const conversationHistory = priorTurns.flatMap((t) => {
        const msgs: { role: 'user' | 'assistant'; text: string }[] = [{ role: 'user', text: t.userText }];
        if (t.assistantText) msgs.push({ role: 'assistant', text: t.assistantText });
        return msgs;
      });
      const previousRecipes = priorTurns[priorTurns.length - 1]?.mealsResult?.recipes ?? [];
      const previousMealPlan = priorTurns[priorTurns.length - 1]?.mealsResult
        ? {
            totalBudgetSpent: priorTurns[priorTurns.length - 1].mealsResult!.totalBudgetSpent,
            shoppingList: priorTurns[priorTurns.length - 1].mealsResult!.shoppingList,
            mealRoutineMeta: priorTurns[priorTurns.length - 1].mealsResult!.mealRoutineMeta,
            recipes: priorTurns[priorTurns.length - 1].mealsResult!.recipes,
          }
        : undefined;

      const response = await fetch('/api/plan?stream=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
        body: JSON.stringify({
          prompt: text.trim(),
          inventory,
          family,
          budgetLkr,
          isFollowUp,
          previousScenario: isFollowUp ? base.scenario ?? undefined : undefined,
          conversationHistory: isFollowUp ? conversationHistory : undefined,
          previousRecipes: isFollowUp && previousRecipes.length ? previousRecipes : undefined,
          previousMealPlan: isFollowUp ? previousMealPlan : undefined,
          memory,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Plan request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let parsed: OrchestrationResult | null = null;

      const patchTurnLogs = (agentLogs: AgentExecutionLog[]) => {
        onSessionUpdate({
          ...updatedSession,
          turns: updatedSession.turns.map((t) => (t.id === turn.id ? { ...t, agentLogs } : t)),
          activeTurnId: turn.id,
          updatedAt: new Date().toISOString(),
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: 'logs'; logs: AgentExecutionLog[] }
            | { type: 'result'; result: OrchestrationResult }
            | { type: 'error'; error: string };

          if (event.type === 'logs') {
            patchTurnLogs(event.logs);
          } else if (event.type === 'result') {
            parsed = event.result;
          } else if (event.type === 'error') {
            throw new Error(event.error);
          }
        }
      }

      if (parsed?.success) {
        if (parsed.updatedMemory && onMemoryUpdate) {
          onMemoryUpdate(parsed.updatedMemory);
        }
        const completedTurn: QueryTurn = {
          ...turn,
          assistantText: parsed.data.orchestratorSummary,
          status: 'complete',
          agentLogs: parsed.logs || [],
          mealsResult: parsed.data,
          weather: parsed.weather ?? turn.weather,
          traffic: parsed.traffic ?? turn.traffic,
          crisis: parsed.crisis ?? turn.crisis,
          prices: parsed.prices ?? [],
          scenario: parsed.scenario ?? null,
          sources: parsed.sources ?? [],
          localBusinesses: parsed.localBusinesses ?? [],
          placesQuery: parsed.placesQuery,
        };
        onSessionUpdate({
          ...updatedSession,
          scenario: parsed.scenario ?? base.scenario,
          budgetLkr,
          turns: updatedSession.turns.map((t) => (t.id === turn.id ? completedTurn : t)),
          activeTurnId: turn.id,
          updatedAt: new Date().toISOString(),
        });
        onSelectTurn(turn.id);
      } else {
        const failedTurn: QueryTurn = { ...turn, status: 'error', agentLogs: parsed?.logs ?? turn.agentLogs };
        onSessionUpdate({
          ...updatedSession,
          turns: updatedSession.turns.map((t) => (t.id === turn.id ? failedTurn : t)),
        });
        setErrorText('Failed to run agents. Please try again.');
      }
    } catch {
      const failedTurn: QueryTurn = { ...turn, status: 'error', agentLogs: [] };
      onSessionUpdate({
        ...updatedSession,
        turns: updatedSession.turns.map((t) => (t.id === turn.id ? failedTurn : t)),
      });
      setErrorText('Network error. Check your connection.');
    } finally {
      setRunning(false);
    }
  };

  const beginOrClarify = (rawText: string) => {
    if (running || !rawText.trim() || awaitingTurn) return;
    const text = rawText.trim();
    const isFollowUp = session.turns.some((t) => t.status === 'complete');
    const fields = detectMissingDetails(text, {
      isFollowUp,
      sessionBudgetLkr: isFollowUp ? session.budgetLkr : undefined,
      memoryBudgetLkr: memory?.defaultBudgetLkr,
      familyCount: family.length,
    });

    if (fields.length === 0) {
      const fromPrompt = extractBudgetFromPrompt(text);
      void runQuery(text, { budgetLkr: fromPrompt ?? (isFollowUp ? session.budgetLkr : memory?.defaultBudgetLkr) });
      return;
    }

    const turn = createEmptyTurn(text, isFollowUp);
    turn.status = 'awaiting_input';
    turn.agentLogs = [];
    turn.clarification = { fields, pendingPrompt: text, answers: {} };

    const updatedSession: QuerySession = {
      ...session,
      title: isFollowUp ? session.title : sessionTitleFromPrompt(text),
      turns: [...session.turns, turn],
      activeTurnId: turn.id,
      updatedAt: new Date().toISOString(),
    };
    onSessionUpdate(updatedSession);
    onSelectTurn(turn.id);
    setInput('');
    setErrorText(null);
  };

  const handleClarificationAnswer = (fieldId: ClarificationFieldId, value: number) => {
    if (!awaitingTurn?.clarification) return;
    const updated: QueryTurn = {
      ...awaitingTurn,
      clarification: {
        ...awaitingTurn.clarification,
        answers: { ...awaitingTurn.clarification.answers, [fieldId]: value },
      },
    };
    onSessionUpdate({
      ...session,
      turns: session.turns.map((t) => (t.id === awaitingTurn.id ? updated : t)),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleClarificationConfirm = () => {
    if (!awaitingTurn?.clarification || running) return;
    const { pendingPrompt, answers, fields } = awaitingTurn.clarification;
    const missing = fields.some((f) => !answers[f.id] || (answers[f.id] as number) <= 0);
    if (missing) return;

    const { enrichedPrompt, budgetLkr } = applyClarificationAnswers(pendingPrompt, answers);
    void runQuery(enrichedPrompt, {
      budgetLkr: budgetLkr ?? session.budgetLkr,
      displayText: pendingPrompt,
      replaceTurnId: awaitingTurn.id,
      baseSession: session,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    beginOrClarify(input);
  };

  const handleTurnClick = (turn: QueryTurn) => {
    if (turn.status !== 'complete') return;
    onSelectTurn(turn.id);
    onSessionUpdate({ ...session, activeTurnId: turn.id });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.25rem)] w-full max-w-none animate-fade-in">
      <div className="flex flex-1 flex-col min-h-0 bg-white border border-[#BBF7D0] rounded-[20px] shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b border-[#BBF7D0] bg-[#F0FDF4]/40 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-[0.15em] text-[#16A34A] font-extrabold leading-none">Grocery OS Assistant</p>
            <h2 className="text-sm font-serif font-bold text-[#14532D] truncate leading-tight mt-0.5">{session.title}</h2>
          </div>
          {panelTurn?.status === 'complete' && (
            <p className="text-[9px] text-[#15803D]/60 shrink-0 hidden lg:block">Click prompt → load agents</p>
          )}
        </div>

        <HorizontalAgentPipeline
          logs={panelTurn?.agentLogs ?? []}
          isRunning={pipelineRunning}
          mealsResult={panelTurn?.mealsResult}
        />

        <div className="flex-1 min-h-0 overflow-y-auto px-4 lg:px-6 py-3 space-y-3">
          {isNewSession && (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 bg-[#16A34A] rounded-full flex items-center justify-center mx-auto text-white font-bold text-xl">G</div>
              <div>
                <h3 className="font-serif font-bold text-[#14532D] text-xl">What should we plan today?</h3>
                <p className="text-sm text-[#15803D] mt-1 max-w-lg mx-auto">
                  Agents run in parallel across the pipeline above. Each prompt saves its own snapshot.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.title}
                    type="button"
                    onClick={() => setInput(p.text)}
                    className="text-xs bg-[#FBFBFA] hover:bg-[#DCFCE7] border border-[#BBF7D0] px-3 py-2 rounded-xl font-semibold text-[#14532D]"
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {session.turns.map((turn) => (
            <div key={turn.id} className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleTurnClick(turn)}
                  disabled={turn.status !== 'complete'}
                  title={turn.status === 'complete' ? "Load this prompt's agent data" : undefined}
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed text-left transition-all ${
                    turn.status === 'complete' ? 'cursor-pointer hover:ring-2 hover:ring-[#16A34A]/40' : 'cursor-default'
                  } ${
                    session.activeTurnId === turn.id && turn.status === 'complete'
                      ? 'bg-[#14532D] text-white ring-2 ring-[#16A34A] rounded-br-md'
                      : 'bg-[#16A34A] text-white rounded-br-md'
                  }`}
                >
                  {turn.userText}
                  {turn.status === 'complete' && session.activeTurnId === turn.id && (
                    <span className="block text-[9px] font-mono uppercase tracking-wider opacity-70 mt-1">Active for agents</span>
                  )}
                </button>
              </div>

              {turn.status === 'awaiting_input' && turn.clarification && (
                <ClarificationCard
                  fields={turn.clarification.fields}
                  answers={turn.clarification.answers}
                  onAnswer={handleClarificationAnswer}
                  onConfirm={handleClarificationConfirm}
                  disabled={running || turn.id !== awaitingTurn?.id}
                />
              )}

              {turn.status === 'pending' && running && session.activeTurnId === turn.id && (
                <div className="flex justify-start">
                  <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl px-4 py-3 text-sm text-[#15803D] flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Parallel agents executing...
                  </div>
                </div>
              )}

              {turn.status === 'complete' && turn.mealsResult && (
                <div className="flex justify-start w-full">
                  <div className="max-w-[96%] lg:max-w-[90%] w-full space-y-3">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-[#15803D]/60 px-1">plango orchestrator</span>
                    <PlanArtifactView
                      mealsResult={turn.mealsResult}
                      prices={turn.prices}
                      weather={turn.weather}
                      budgetLkr={session.budgetLkr}
                      animate={session.activeTurnId === turn.id}
                    />
                    {turn.localBusinesses &&
                      turn.localBusinesses.length > 0 &&
                      !turn.mealsResult?.localBusinesses?.length && (
                      <LocalPlacesView
                        places={turn.localBusinesses}
                        query={turn.placesQuery}
                        animate={session.activeTurnId === turn.id}
                      />
                    )}
                    {turn.assistantText && shouldShowNarrativeWithPlaces(turn.mealsResult, turn.assistantText, turn.localBusinesses) && (
                      <div className="rounded-2xl px-4 py-3 bg-[#F0FDF4]/50 border border-[#BBF7D0]/80 text-[#2D332D] rounded-bl-md">
                        <p className="text-[9px] font-mono uppercase tracking-wider text-[#15803D]/70 mb-2 font-bold">Summary</p>
                        <PlanNarrativeSummary text={turn.assistantText} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {turn.status === 'complete' && !turn.mealsResult && turn.assistantText && (
                <div className="flex justify-start">
                  <div className="max-w-[92%] lg:max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed bg-[#F0FDF4] border border-[#BBF7D0] text-[#2D332D] rounded-bl-md">
                    <span className="text-[9px] font-mono uppercase tracking-wider opacity-60 block mb-1">plango orchestrator</span>
                    <PlanNarrativeSummary text={turn.assistantText} />
                  </div>
                </div>
              )}

              {turn.status === 'error' && (
                <p className="text-xs text-red-600 text-right">This prompt failed — try again.</p>
              )}
            </div>
          ))}

          <div ref={bottomRef} />
          {panelTurn?.sources && panelTurn.sources.length > 0 && (
            <AgentSourcesFooter sources={panelTurn.sources} prompt={panelTurn.userText} />
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-2.5 lg:px-4 border-t border-[#BBF7D0] bg-[#FBFBFA] shrink-0">
          <div className="flex items-end gap-2 w-full">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              rows={1}
              disabled={Boolean(awaitingTurn) || running}
              placeholder={
                awaitingTurn
                  ? 'Answer the questions above to continue…'
                  : hasStarted
                    ? 'Ask a follow-up...'
                    : 'Plan meals, compare prices, optimize shopping...'
              }
              className="flex-1 text-sm border border-[#BBF7D0] rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A] resize-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={running || !input.trim() || Boolean(awaitingTurn)}
              className="bg-[#16A34A] hover:bg-[#14532D] disabled:opacity-50 text-white p-3 rounded-xl transition-all"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          <p className="text-[10px] text-[#15803D]/60 mt-1.5 px-1 text-right">Enter to send · Shift+Enter for new line</p>
          {errorText && <p className="text-xs text-red-600 mt-2 text-center max-w-4xl mx-auto">{errorText}</p>}
        </form>
      </div>
    </div>
  );
}
