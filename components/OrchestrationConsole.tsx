'use client';
import React, { useState } from 'react';
import { Cpu, Play, CheckCircle, HelpCircle, Sparkles, RefreshCw, MessageCircle } from 'lucide-react';
import { InventoryItem, FamilyMember, StorePrice, WeatherCondition, TrafficCondition, CrisisAlert, AgentExecutionLog, MealPlanResponse } from '@/lib/types';
import PlanArtifactView, { PlanNarrativeSummary } from '@/components/PlanArtifactView';

interface ConversationTurn {
  role: 'user' | 'assistant';
  text: string;
  isFollowUp: boolean;
}

interface OrchestrationConsoleProps {
  inventory: InventoryItem[];
  family: FamilyMember[];
  prices: StorePrice[];
  weather: WeatherCondition;
  traffic: TrafficCondition;
  crisis: CrisisAlert;
  mealsResult: MealPlanResponse | null;
  setMealsResult: (res: MealPlanResponse) => void;
  setWeather: (w: WeatherCondition) => void;
  setTraffic: (t: TrafficCondition) => void;
  setCrisis: (c: CrisisAlert) => void;
  setPrices: (p: StorePrice[]) => void;
  agentLogs: AgentExecutionLog[];
  setAgentLogs: (logs: AgentExecutionLog[]) => void;
  activeBudget: number;
  setActiveBudget: (b: number) => void;
}

export default function OrchestrationConsole({
  inventory,
  family,
  prices,
  weather,
  traffic,
  crisis,
  mealsResult,
  setMealsResult,
  setWeather,
  setTraffic,
  setCrisis,
  setPrices,
  agentLogs,
  setAgentLogs,
  activeBudget,
  setActiveBudget,
}: OrchestrationConsoleProps) {
  const [prompt, setPrompt] = useState('Plan 3 healthy dinners for family of 4, budget LKR 5,000, diabetic-friendly, no fish');
  const [followUpPrompt, setFollowUpPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [lastScenario, setLastScenario] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);

  const followUpPresets = [
    'Can we swap chicken for eggs to save money?',
    'What if the Keells route is blocked — update the shopping list?',
    'Use more items from home inventory and reduce the shopping list.',
    'Is fresh sea fish safe for Nisha given her dietary restrictions?',
  ];

  const presets = [
    {
      title: '🍽️ Already Decided',
      text: 'I already decided to cook dhal curry and chicken fry tonight. Find prices and best route.',
      budget: 4000,
      scenario: 'decided_menu',
    },
    {
      title: '💡 Need Suggestions',
      text: 'Suggest 3 diabetic-friendly dinners for family of 4, no fish, budget LKR 5000, use home inventory',
      budget: 5000,
      scenario: 'needs_suggestions',
    },
    {
      title: '🛒 Shopping Trip',
      text: 'I am going shopping now. Compare rice, dhal, eggs, chicken prices and check for flood warnings.',
      budget: 6000,
      scenario: 'shopping_trip',
    },
  ];

  const handleSelectPreset = (p: typeof presets[0]) => {
    setPrompt(p.text);
    setActiveBudget(p.budget);
  };

  const runOrchestration = async (queryText: string, isFollowUp: boolean) => {
    if (running || !queryText.trim()) return;
    setRunning(true);
    setErrorText(null);

    const pendingLogs: AgentExecutionLog[] = [
      { agentId: 'orchestrator', agentName: 'Agent 4: Orchestrator', status: 'active', message: isFollowUp ? 'Processing follow-up — selecting minimal agents...' : 'Classifying intent and selecting agents...' },
      { agentId: 'inventory-rag', agentName: 'Agent 1: Home Inventory RAG', status: 'pending', message: 'Queued...' },
      { agentId: 'dietary-guard', agentName: 'Agent 6: Dietary Guard', status: 'pending', message: 'Queued...' },
      { agentId: 'recipe-compiler', agentName: 'Agent 2: Recipe Compiler', status: 'pending', message: 'Queued...' },
      { agentId: 'price-catalog', agentName: 'Agent 7: Price Catalog', status: 'pending', message: 'Queued...' },
      { agentId: 'sensory-decay', agentName: 'Agent 5: Sensory Decay', status: 'pending', message: 'Queued...' },
      { agentId: 'route-optimizer', agentName: 'Agent 3: Route Optimizer', status: 'pending', message: 'Queued...' },
      { agentId: 'crisis-agent', agentName: 'Agent 7: Crisis Intelligence', status: 'pending', message: 'Queued...' },
    ];
    setAgentLogs(pendingLogs);
    setConversation((prev) => [...prev, { role: 'user', text: queryText, isFollowUp }]);

    try {
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: queryText,
          inventory,
          family,
          budgetLkr: activeBudget,
          isFollowUp,
          previousScenario: isFollowUp ? lastScenario : undefined,
        }),
      });

      const parsed = await response.json();
      if (parsed.success) {
        setMealsResult(parsed.data);
        if (parsed.logs) setAgentLogs(parsed.logs);
        if (parsed.weather) setWeather(parsed.weather);
        if (parsed.traffic) setTraffic(parsed.traffic);
        if (parsed.crisis) setCrisis(parsed.crisis);
        if (parsed.prices) setPrices(parsed.prices);
        if (parsed.scenario) setLastScenario(parsed.scenario);
        setConversation((prev) => [
          ...prev,
          { role: 'assistant', text: parsed.data.orchestratorSummary, isFollowUp },
        ]);
        if (isFollowUp) setFollowUpPrompt('');
      } else {
        setErrorText('Server failed to assemble agent outputs.');
      }
    } catch (err) {
      console.error(err);
      setErrorText('Communications error on backend. Verify network.');
    } finally {
      setRunning(false);
    }
  };

  const handleMainQuery = () => {
    setConversation([]);
    runOrchestration(prompt, false);
  };
  const handleFollowUp = () => runOrchestration(followUpPrompt, true);

  return (
    <div className="space-y-8 animate-fade-in text-[#2D332D]">
      
      {/* Header section */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#16A34A] font-extrabold font-sans">AI Agent Synthesis</p>
        <h2 className="text-3xl font-serif italic font-bold text-[#14532D] mt-1">SaaS Neural Coordinator Console</h2>
        <p className="text-[#15803D] mt-2 text-sm leading-relaxed max-w-3xl">
          Enter a main query or follow-up. The orchestrator picks which agents to run: recipe suggestions, price catalog, route optimizer, sensory decay, dietary guard, and crisis intelligence.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Command Input Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 space-y-5 shadow-sm">
            <h3 className="font-serif font-bold text-lg text-[#14532D] flex items-center gap-2">
              <Cpu className="text-[#16A34A] h-5 w-5 animate-spin" style={{ animationDuration: '6s' }} /> Coordinate Autonomous Workspace Loop
            </h3>

            {/* Scenario Preset tags */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] block pb-1 font-bold">Preset Scenarios</span>
              <div className="flex gap-2 flex-wrap">
                {presets.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectPreset(preset)}
                    className="text-xs bg-[#FBFBFA] hover:bg-[#DCFCE7] hover:text-[#14532D] cursor-pointer text-[#2D332D] font-bold px-3.5 py-2 rounded-xl border border-[#BBF7D0] transition-all duration-200"
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Prompt Area */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] block font-bold">Main Query</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="w-full text-xs border border-[#BBF7D0] rounded-xl p-3 bg-[#FBFBFA] focus:outline-none focus:ring-2 focus:ring-[#16A34A] leading-relaxed text-[#2D332D]"
                placeholder="e.g. Plan 3 diabetic-friendly dinners, no fish, budget LKR 5000..."
              />
            </div>

            {/* Budget + main submit */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#15803D] font-bold whitespace-nowrap">Budget Cap:</span>
                <input
                  type="number"
                  value={activeBudget}
                  onChange={(e) => setActiveBudget(parseInt(e.target.value) || 2000)}
                  className="w-26 text-xs font-mono font-bold border border-[#BBF7D0] p-2 rounded-xl bg-[#FBFBFA]"
                  placeholder="LKR budget"
                />
                <span className="text-[10px] text-[#15803D] font-mono font-bold">LKR LIMIT</span>
              </div>

              <button
                onClick={handleMainQuery}
                disabled={running}
                className="bg-[#16A34A] hover:bg-[#14532D] text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-xl shadow-xs transition-all duration-150 cursor-pointer flex items-center gap-2 justify-center"
              >
                {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {running ? 'Assembling Agents...' : 'Run Main Query'}
              </button>
            </div>

            {/* Follow-up section — shown after first successful run */}
            {lastScenario && (
              <div className="space-y-3 pt-4 border-t border-[#BBF7D0]">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-[#16A34A]" />
                  <label className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] font-bold">
                    Follow-up Question
                  </label>
                  <span className="text-[9px] font-mono text-[#15803D]/70 bg-[#F0FDF4] px-2 py-0.5 rounded-full border border-[#BBF7D0]">
                    scenario: {lastScenario.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {followUpPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFollowUpPrompt(preset)}
                      className="text-[10px] bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#14532D] font-semibold px-2.5 py-1.5 rounded-lg border border-[#BBF7D0] transition-all"
                    >
                      {preset.length > 48 ? preset.slice(0, 48) + '…' : preset}
                    </button>
                  ))}
                </div>

                <textarea
                  value={followUpPrompt}
                  onChange={(e) => setFollowUpPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleFollowUp();
                  }}
                  rows={2}
                  className="w-full text-xs border border-[#BBF7D0] rounded-xl p-3 bg-[#FBFBFA] focus:outline-none focus:ring-2 focus:ring-[#16A34A] leading-relaxed text-[#2D332D]"
                  placeholder="Ask a follow-up — e.g. swap an ingredient, change budget, check traffic..."
                />

                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-[#15803D]/70">Ctrl+Enter to send · runs only needed agents</p>
                  <button
                    type="button"
                    onClick={handleFollowUp}
                    disabled={running || !followUpPrompt.trim()}
                    className="bg-[#14532D] hover:bg-[#16A34A] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-xl transition-all flex items-center gap-2"
                  >
                    {running ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                    Ask Follow-up
                  </button>
                </div>
              </div>
            )}

            {/* Conversation thread */}
            {conversation.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#BBF7D0]/60">
                <span className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] font-bold">Conversation</span>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                  {conversation.map((turn, i) => (
                    <div
                      key={i}
                      className={`text-[11px] p-2.5 rounded-xl leading-relaxed ${
                        turn.role === 'user'
                          ? 'bg-[#F0FDF4] border border-[#BBF7D0] text-[#14532D]'
                          : 'bg-white border border-[#BBF7D0]/50 text-[#2D332D] italic'
                      }`}
                    >
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider block mb-0.5 opacity-60">
                        {turn.role === 'user' ? (turn.isFollowUp ? 'You (follow-up)' : 'You (main)') : 'Orchestrator'}
                      </span>
                      {turn.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {errorText && (
              <p className="text-xs font-bold text-red-600 pt-2 animate-pulse">{errorText}</p>
            )}
          </div>

          {/* Trace Pipeline visualization */}
          <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 shadow-sm">
            <h4 className="font-serif font-bold text-lg text-[#14532D] mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#16A34A] animate-pulse" /> Agent Pipeline ({agentLogs.length} agents)
            </h4>

            <div className="space-y-3">
              {agentLogs.map((log, idx) => {
                const colors = {
                  pending: 'bg-[#FBFBFA] text-[#15803D] border border-[#BBF7D0]/65 opacity-60',
                  active: 'bg-[#F0FDF4] text-[#14532D] border-l-4 border-[#16A34A] animate-pulse shadow-xs',
                  success: 'bg-[#DCFCE7] text-[#14532D] border border-[#BBF7D0]',
                  warn: 'bg-amber-50 text-amber-900 border border-amber-300',
                  skipped: 'bg-stone-50 text-stone-400 border border-stone-200 opacity-50',
                };

                return (
                  <div key={idx} className={`p-4 rounded-2xl text-xs flex justify-between items-start gap-4 transition-all duration-300 ${colors[log.status] || 'bg-stone-100'}`}>
                    <div className="space-y-1">
                      <p className="font-bold font-sans tracking-wide">{log.agentName}</p>
                      <p className="text-[#15803D] leading-relaxed text-[11px]">{log.message}</p>
                      {log.details != null && (
                        <span className="text-[9px] block text-[#15803D] font-mono mt-0.5 max-w-sm overflow-hidden text-ellipsis whitespace-nowrap">
                          Input parameters: {JSON.stringify(log.details)}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] uppercase font-mono tracking-widest bg-white/80 px-2.5 py-0.5 rounded-full font-bold border border-[#BBF7D0]">
                      {log.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Execution Output Panel */}
        <div className="space-y-6">
          <h3 className="font-serif font-bold text-lg text-[#14532D] flex items-center gap-2 border-b border-[#BBF7D0] pb-3">
            <CheckCircle className="text-[#16A34A] h-5 w-5" /> Orchestrator Output
          </h3>

          {!mealsResult ? (
            <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 text-center text-[#15803D] space-y-3 shadow-sm">
              <HelpCircle className="h-12 w-12 text-[#BBF7D0] mx-auto opacity-70" />
              <p className="text-xs leading-relaxed max-w-xs mx-auto">
                No active execution results. Write or select a preset scenario above, then tap <strong className="text-[#14532D] font-bold">"Fire Autonomous Loop"</strong> to generate personalized meal plans.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-5 space-y-6 animate-fade-in shadow-sm">
              <PlanArtifactView
                mealsResult={mealsResult}
                prices={prices}
                weather={weather}
                budgetLkr={activeBudget}
                animate={false}
              />

              <div className="space-y-2">
                <span className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] block font-bold">AI Executive Narrative</span>
                <div className="text-xs text-[#2D332D] leading-relaxed bg-[#F0FDF4]/30 border border-[#BBF7D0] p-4 rounded-2xl font-medium">
                  <PlanNarrativeSummary text={mealsResult.orchestratorSummary} />
                </div>
              </div>

              {/* Scheduling logs */}
              {mealsResult.cookingSchedulerReason && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] block font-bold">Scheduler Cooking Log</span>
                  <div className="text-[11px] text-[#15803D] bg-[#FBFBFA] p-3 rounded-2xl border leading-relaxed border-[#BBF7D0]">
                    {mealsResult.cookingSchedulerReason}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
