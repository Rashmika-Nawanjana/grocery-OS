import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Flame, 
  ShoppingBag, 
  Users, 
  Compass, 
  Cpu, 
  TrendingUp, 
  ChevronRight, 
  ChevronDown, 
  Activity, 
  Sparkles, 
  AlertCircle,
  FileSpreadsheet,
  Workflow,
  Fish,
  UtensilsCrossed
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  inventoryValue: number;
  unpurchasedItems: number;
}

export default function Sidebar({ activeTab, setActiveTab, inventoryValue, unpurchasedItems }: SidebarProps) {
  const [agentsExpanded, setAgentsExpanded] = useState(true);

  // Group 1: Live Agents (At the top as the main function)
  const agentItems = [
    { id: 'agent-4-orchestrate', label: 'Central Pipeline', icon: Workflow, pulse: true },
    { id: 'agent-1-price', label: 'Price Catalog', icon: Compass },
    { id: 'agent-2-recipe', label: 'Recipe Compiler', icon: UtensilsCrossed },
    { id: 'agent-3-route', label: 'Route Optimizer', icon: ShoppingBag, badge: `${unpurchasedItems}` },
    { id: 'agent-5-decay', label: 'Sensory Decay', icon: Flame },
    { id: 'agent-6-diet', label: 'Dietary Guard', icon: Activity },
  ];

  // Group 2: MiroFish A/B Sourcing (Middle)
  const experimentItems = [
    { id: 'mirofish', label: 'MiroFish Sourcing', icon: Fish, alert: true },
  ];

  // Group 3: Household Management (Other Pages)
  const householdItems = [
    { id: 'dashboard', label: 'Dashboard Control', icon: LayoutDashboard },
    { id: 'inventory', label: 'Home Inventory', icon: FileSpreadsheet, badge: `${inventoryValue} LKR` },
    { id: 'family', label: 'Preferences Panel', icon: Users },
  ];

  const handleTabClick = (id: string) => {
    setActiveTab(id);
  };

  const renderNavButton = (item: any) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;

    return (
      <button
        key={item.id}
        onClick={() => handleTabClick(item.id)}
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
          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
            isActive ? 'bg-[#16A34A] text-white' : 'bg-[#BBF7D0] text-[#14532D]'
          }`}>
            {item.badge}
          </span>
        )}

        {item.pulse && !item.badge && (
          <span className="flex h-1.5 w-1.5 relative flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#16A34A]"></span>
          </span>
        )}

        {item.alert && (
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
        )}
      </button>
    );
  };

  return (
    <aside className="w-72 bg-[#E9F4EB]/90 backdrop-blur-md border-r border-[#BBF7D0] flex flex-col justify-between h-screen sticky top-0 font-sans text-[#2D332D] z-30 shadow-xs">
      <div className="p-6 overflow-y-auto space-y-7">
        
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#16A34A] rounded-full flex items-center justify-center shadow-md animate-pulse">
            <div className="w-4.5 h-4.5 border-2 border-white rounded-lg rotate-12 flex items-center justify-center font-bold text-[10px] text-white">G</div>
          </div>
          <div>
            <h1 className="text-xl font-serif italic font-extrabold text-[#14532D] tracking-tight">plango AI</h1>
            <p className="text-[10px] uppercase tracking-widest text-[#15803D] font-extrabold">Autonomous Grocery OS</p>
          </div>
        </div>

        {/* Dynamic Navigation Menu */}
        <nav className="space-y-6">

          {/* SECTION 1: LIVE AGENTS (At the very top) */}
          <div className="space-y-2">
            <button 
              onClick={() => setAgentsExpanded(!agentsExpanded)}
              className="w-full flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.15em] text-[#14532D] font-bold px-1 hover:text-[#16A34A]"
            >
              <span className="flex items-center gap-1">
                <Workflow className="h-3 w-3 text-[#16A34A]" /> Live Agents (6)
              </span>
              {agentsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            {agentsExpanded && (
              <div className="space-y-1 pl-1.5 border-l border-[#BBF7D0]/60 ml-1.5 animate-fade-in">
                {agentItems.map(renderNavButton)}
              </div>
            )}
          </div>

          {/* SECTION 2: MIROFISH HYPOTHESIS TESTING */}
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#14532D] font-bold px-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-[#16A34A]" /> A/B Hypotheses
            </p>
            <div className="space-y-1">
              {experimentItems.map(renderNavButton)}
            </div>
          </div>

          {/* SECTION 3: OTHER UTILITIES / OTHER PAGES */}
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#14532D] font-bold px-1 flex items-center gap-1">
              <LayoutDashboard className="h-3 w-3 text-[#15803D]" /> Other Pages
            </p>
            <div className="space-y-1">
              {householdItems.map(renderNavButton)}
            </div>
          </div>

        </nav>
      </div>

      {/* Connected Core status */}
      <div className="p-5 border-t border-[#BBF7D0] bg-[#F0FDF4] rounded-t-3xl">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-pulse"></span>
          <span className="text-xs text-[#14532D] font-extrabold tracking-wider uppercase">Active Fresh Loop</span>
        </div>
        <p className="text-[10px] text-[#15803D] mt-1.5 italic font-medium">Sri Lanka Region • Western Province</p>
      </div>
    </aside>
  );
}
