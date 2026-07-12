'use client';

import { useState } from 'react';
import {
  Brain,
  LayoutDashboard,
  Flame,
  ShoppingBag,
  Users,
  ChevronRight,
  ChevronDown,
  Activity,
  Sparkles,
  FileSpreadsheet,
  Workflow,
  Fish,
  UtensilsCrossed,
  Compass,
  Network,
  Plus,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import type { QuerySession } from '@/lib/chat-sessions';
import { formatSessionDate, getPastSessions } from '@/lib/chat-sessions';
import PastQueriesModal from '@/components/PastQueriesModal';
import { AGENT_DISPLAY_NAMES } from '@/lib/agent-display-names';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  inventoryValue: number;
  unpurchasedItems: number;
  memoryEntryCount?: number;
  sessions: QuerySession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewQuery: () => void;
  onDeleteSession: (id: string) => void;
}

const RECENT_LIMIT = 3;

export default function Sidebar({
  activeTab,
  setActiveTab,
  inventoryValue,
  unpurchasedItems,
  memoryEntryCount = 0,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewQuery,
  onDeleteSession,
}: SidebarProps) {
  const [agentsExpanded, setAgentsExpanded] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const pastSessions = getPastSessions(sessions);
  const recentSessions = pastSessions.slice(0, RECENT_LIMIT);
  const hasMore = pastSessions.length > RECENT_LIMIT;

  const agentItems = [
    { id: 'agent-1-price', label: AGENT_DISPLAY_NAMES.priceCatalogGrid, icon: Compass },
    { id: 'agent-2-recipe', label: AGENT_DISPLAY_NAMES.recipeCompiler, icon: UtensilsCrossed },
    { id: 'agent-3-route', label: AGENT_DISPLAY_NAMES.routeOptimizer, icon: ShoppingBag, badge: `${unpurchasedItems}` },
    { id: 'agent-5-decay', label: AGENT_DISPLAY_NAMES.sensoryDecay, icon: Flame },
    { id: 'agent-6-diet', label: AGENT_DISPLAY_NAMES.dietary, icon: Activity },
  ];

  const experimentItems = [{ id: 'mirofish', label: 'MiroFish Sourcing', icon: Fish, alert: true }];

  const householdItems = [
    { id: 'dashboard', label: 'Dashboard Control', icon: LayoutDashboard },
    { id: 'inventory', label: 'Home Inventory', icon: FileSpreadsheet, badge: `${inventoryValue} LKR` },
    { id: 'family', label: 'Preferences Panel', icon: Users },
    { id: 'memory', label: 'Knowledge Memory', icon: Brain },
  ];

  const renderNavButton = (item: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    alert?: boolean;
  }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;

    return (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
          isActive
            ? 'bg-[#C6F6D5] text-[#14532D] shadow-xs border-l-4 border-[#16A34A] pl-2'
            : 'text-[#2D332D]/80 hover:bg-[#EAF7EE] hover:text-[#16A34A]'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-[#16A34A]' : 'text-[#15803D]'}`} />
          <span className="truncate">{item.label}</span>
        </div>
        {item.badge && (
          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-[#16A34A] text-white' : 'bg-[#BBF7D0] text-[#14532D]'}`}>
            {item.badge}
          </span>
        )}
        {item.alert && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />}
      </button>
    );
  };

  return (
    <>
      <aside className="w-72 bg-[#E9F4EB]/90 backdrop-blur-md border-r border-[#BBF7D0] flex flex-col h-screen sticky top-0 font-sans text-[#2D332D] z-30 shadow-xs">
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#16A34A] rounded-full flex items-center justify-center shadow-md">
              <div className="w-4.5 h-4.5 border-2 border-white rounded-lg rotate-12 flex items-center justify-center font-bold text-[10px] text-white">G</div>
            </div>
            <div>
              <h1 className="text-xl font-serif italic font-extrabold text-[#14532D] tracking-tight">plango AI</h1>
              <p className="text-[10px] uppercase tracking-widest text-[#15803D] font-extrabold">Autonomous Grocery OS</p>
            </div>
          </div>

          <nav className="space-y-6">
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#14532D] font-bold px-1 flex items-center gap-1">
                <MessageSquare className="h-3 w-3 text-[#16A34A]" /> Query
              </p>

              <button
                type="button"
                onClick={onNewQuery}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'chat'
                    ? 'bg-[#16A34A] text-white shadow-sm'
                    : 'bg-white border border-[#BBF7D0] text-[#14532D] hover:bg-[#DCFCE7]'
                }`}
              >
                <Plus className="h-4 w-4" />
                New Query
              </button>

              <div className="space-y-1 pt-1">
                <p className="text-[9px] font-mono uppercase tracking-widest text-[#15803D]/80 px-1 font-bold">Past Queries</p>
                {pastSessions.length === 0 ? (
                  <p className="text-[10px] text-[#15803D]/60 px-2 py-2">No past queries yet.</p>
                ) : (
                  <>
                    {recentSessions.map((s) => (
                      <div key={s.id} className="group flex items-stretch gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSession(s.id);
                            setActiveTab('chat');
                          }}
                          className={`flex-1 text-left px-3 py-2 rounded-xl text-[11px] transition-all min-w-0 ${
                            activeTab === 'chat' && activeSessionId === s.id
                              ? 'bg-[#C6F6D5] text-[#14532D] font-semibold border border-[#BBF7D0]'
                              : 'text-[#2D332D]/80 hover:bg-[#EAF7EE]'
                          }`}
                        >
                          <span className="block truncate">{s.title}</span>
                          <span className="text-[9px] font-mono opacity-50">{formatSessionDate(s.updatedAt)}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSession(s.id)}
                          className="shrink-0 px-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                          aria-label={`Delete ${s.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {hasMore && (
                      <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="w-full text-[10px] font-semibold text-[#16A34A] px-3 py-1.5 hover:underline text-left"
                      >
                        View more ({pastSessions.length - RECENT_LIMIT} more)
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setAgentsExpanded(!agentsExpanded)}
                className="w-full flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.15em] text-[#14532D] font-bold px-1 hover:text-[#16A34A]"
              >
                <span className="flex items-center gap-1">
                  <Workflow className="h-3 w-3 text-[#16A34A]" /> Live Agents (5)
                </span>
                {agentsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              {agentsExpanded && (
                <div className="space-y-1 pl-1.5 border-l border-[#BBF7D0]/60 ml-1.5">
                  {agentItems.map(renderNavButton)}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#14532D] font-bold px-1 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-[#16A34A]" /> A/B Hypotheses
              </p>
              <div className="space-y-1">{experimentItems.map(renderNavButton)}</div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#14532D] font-bold px-1 flex items-center gap-1">
                <LayoutDashboard className="h-3 w-3 text-[#15803D]" /> Other Pages
              </p>
              <div className="space-y-1">{householdItems.map(renderNavButton)}</div>
            </div>
          </nav>
        </div>

        <div className="px-6 pb-3 shrink-0 border-t border-[#BBF7D0]/60 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab('memory-graph')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
              activeTab === 'memory-graph'
                ? 'bg-[#14532D] text-white shadow-md border border-[#16A34A]'
                : 'bg-white border border-[#BBF7D0] text-[#14532D] hover:bg-[#DCFCE7]'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Network className={`h-4 w-4 ${activeTab === 'memory-graph' ? 'text-[#86EFAC]' : 'text-[#16A34A]'}`} />
              Memory Neural Map
            </span>
            {memoryEntryCount > 0 && (
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === 'memory-graph' ? 'bg-[#16A34A] text-white' : 'bg-[#BBF7D0] text-[#14532D]'
                }`}
              >
                {memoryEntryCount}
              </span>
            )}
          </button>
        </div>

        <div className="p-5 border-t border-[#BBF7D0] bg-[#F0FDF4] rounded-t-3xl shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-pulse" />
            <span className="text-xs text-[#14532D] font-extrabold tracking-wider uppercase">Active Fresh Loop</span>
          </div>
          <p className="text-[10px] text-[#15803D] mt-1.5 italic font-medium">Sri Lanka Region · Western Province</p>
        </div>
      </aside>

      <PastQueriesModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={onSelectSession}
        onDeleteSession={onDeleteSession}
      />
    </>
  );
}
