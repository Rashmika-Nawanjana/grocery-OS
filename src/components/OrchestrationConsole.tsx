import React, { useState } from 'react';
import { Cpu, Play, CheckCircle, HelpCircle, Sparkles, TrendingDown, RefreshCw } from 'lucide-react';
import { InventoryItem, FamilyMember, StorePrice, WeatherCondition, TrafficCondition, CrisisAlert, AgentExecutionLog, MealPlanResponse } from '../types';

interface OrchestrationConsoleProps {
  inventory: InventoryItem[];
  family: FamilyMember[];
  prices: StorePrice[];
  weather: WeatherCondition;
  traffic: TrafficCondition;
  crisis: CrisisAlert;
  mealsResult: MealPlanResponse | null;
  setMealsResult: (res: MealPlanResponse) => void;
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
  agentLogs,
  setAgentLogs,
  activeBudget,
  setActiveBudget,
}: OrchestrationConsoleProps) {
  const [prompt, setPrompt] = useState('Plan 3 healthy meals for family of 4, budget LKR 5,000, diabetic-friendly, no fish, monsoon weather');
  const [running, setRunning] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Quick prompt presets
  const presets = [
    {
      title: '☔ Nisha’s Monsoon Diet',
      text: 'Plan 3 healthy meals for family of 4, budget LKR 4000, diabetic-friendly, no fish, monsoon weather',
      budget: 4000,
    },
    {
      title: '🍳 Kids Mild Egg Dinners',
      text: 'Plan 4 mild egg and potato dinners, no spicy, kids-safe, budget LKR 3000, clear weather',
      budget: 3000,
    },
    {
      title: '🍗 High Protein Raj Feast',
      text: 'Plan 2 spicy chicken and dhal menus, Raj eats meat, no seafood, budget LKR 6000, bypass high route traffic',
      budget: 6000,
    }
  ];

  const handleSelectPreset = (p: typeof presets[0]) => {
    setPrompt(p.text);
    setActiveBudget(p.budget);
  };

  const handleTriggerLoop = async () => {
    if (running) return;
    setRunning(true);
    setErrorText(null);

    // Initial pending transition
    const pendingLogs: AgentExecutionLog[] = [
      { agentName: 'Agent 4: Orchestration Control', status: 'active', message: 'Analyzing prompt parameters...' },
      { agentName: 'Agent 1: Market Research', status: 'pending', message: 'Catalog awaiting indices...' },
      { agentName: 'Agent 6: Dietary Preferences Filter', status: 'pending', message: 'Restrictions queueing...' },
      { agentName: 'Agent 2: Meal Planning Agent', status: 'pending', message: 'RAG cabinets inventory index loading...' },
      { agentName: 'Agent 5: Quantity Planner', status: 'pending', message: 'Climate sensors checking...' },
      { agentName: 'Agent 3: Store & Route Optimizer', status: 'pending', message: 'Emergency alert check queued...' }
    ];
    setAgentLogs(pendingLogs);

    try {
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          inventory,
          family,
          prices,
          weather,
          traffic,
          crisis,
          budgetLkr: activeBudget,
        }),
      });

      const parsed = await response.json();
      if (parsed.success) {
        setMealsResult(parsed.data);
        if (parsed.logs) {
          setAgentLogs(parsed.logs);
        }
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

  return (
    <div className="space-y-8 animate-fade-in text-[#2D332D]">
      
      {/* Header section */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#16A34A] font-extrabold font-sans">AI Agent Synthesis</p>
        <h2 className="text-3xl font-serif italic font-bold text-[#14532D] mt-1">SaaS Neural Coordinator Console</h2>
        <p className="text-[#15803D] mt-2 text-sm leading-relaxed max-w-3xl">
          Conduct smart, real-time family multi-agent queries below. The controller splits tasks logically across six distinct specialized micro-agents.
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
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] block font-bold">Orchestrator Prompt Directive</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="w-full text-xs border border-[#BBF7D0] rounded-xl p-3 bg-[#FBFBFA] focus:outline-none focus:ring-2 focus:ring-[#16A34A] leading-relaxed text-[#2D332D]"
                placeholder="Instruct the planner..."
              />
            </div>

            {/* Budget controller & firing button */}
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
                onClick={handleTriggerLoop}
                disabled={running}
                className="bg-[#16A34A] hover:bg-[#14532D] text-white text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-xl shadow-xs transition-all duration-150 cursor-pointer flex items-center gap-2 justify-center"
              >
                {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {running ? 'Assembling Agents...' : 'Fire Autonomous Loop'}
              </button>
            </div>

            {errorText && (
              <p className="text-xs font-bold text-red-600 pt-2 animate-pulse">{errorText}</p>
            )}
          </div>

          {/* Trace Pipeline visualization */}
          <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 shadow-sm">
            <h4 className="font-serif font-bold text-lg text-[#14532D] mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#16A34A] animate-pulse" /> Tracing 6 Agents Pipeline State
            </h4>

            <div className="space-y-3">
              {agentLogs.map((log, idx) => {
                const colors = {
                  pending: 'bg-[#FBFBFA] text-[#15803D] border border-[#BBF7D0]/65 opacity-60',
                  active: 'bg-[#F0FDF4] text-[#14532D] border-l-4 border-[#16A34A] animate-pulse shadow-xs',
                  success: 'bg-[#DCFCE7] text-[#14532D] border border-[#BBF7D0]',
                  warn: 'bg-amber-50 text-amber-900 border border-amber-300'
                };

                return (
                  <div key={idx} className={`p-4 rounded-2xl text-xs flex justify-between items-start gap-4 transition-all duration-300 ${colors[log.status] || 'bg-stone-100'}`}>
                    <div className="space-y-1">
                      <p className="font-bold font-sans tracking-wide">{log.agentName}</p>
                      <p className="text-[#15803D] leading-relaxed text-[11px]">{log.message}</p>
                      {log.details && (
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
              
              {/* Financial Scoreboard */}
              <div>
                <span className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] block mb-2 font-bold">Financial Scoreboard</span>
                <div className="space-y-2 bg-[#FBFBFA] p-3 rounded-2xl border border-[#BBF7D0] text-xs">
                  <div className="flex justify-between items-center text-[#2D332D] border-b border-[#F0FDF4] pb-1.5">
                    <span>Budget spent:</span>
                    <span className="font-mono font-extrabold pb-0.5">LKR {mealsResult.totalBudgetSpent}</span>
                  </div>
                  <div className="flex justify-between items-center text-[#14532D] font-bold border-b border-[#F0FDF4] pb-1.5">
                    <span>Route & Catalog Saved:</span>
                    <span className="font-mono text-[#16A34A]">+ LKR {mealsResult.savingsVsSingleStore}</span>
                  </div>
                  <div className="flex justify-between items-center text-[#14532D] font-bold">
                    <span>RAG Inventory Saved:</span>
                    <span className="font-mono text-[#16A34A]">+ LKR {mealsResult.inventorySavings}</span>
                  </div>
                </div>
              </div>

              {/* Dynamic summary block */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] block font-bold">AI Executive Narrative</span>
                <p className="text-xs text-[#2D332D] leading-relaxed bg-[#F0FDF4]/30 border border-[#BBF7D0] p-4 rounded-2xl font-medium">
                  "{mealsResult.orchestratorSummary}"
                </p>
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
