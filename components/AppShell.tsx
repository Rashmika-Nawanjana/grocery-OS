'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  InventoryItem,
  FamilyMember,
  StorePrice,
  WeatherCondition,
  TrafficCondition,
  CrisisAlert,
  MealPlanResponse,
  DataSource,
} from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import {
  createEmptySession,
  loadSessions,
  saveSessions,
  getActiveTurn,
  turnAgentSnapshot,
  isSessionEmpty,
  getPastSessions,
  EMPTY_WEATHER,
  EMPTY_TRAFFIC,
  EMPTY_CRISIS,
  type QuerySession,
} from '@/lib/chat-sessions';
import {
  createDefaultMemory,
  loadLocalMemory,
  saveLocalMemory,
  fetchUserMemory,
  patchUserMemory,
  type UserMemory,
} from '@/lib/memory';
import Sidebar from '@/components/Sidebar';
import QueryChatWorkspace from '@/components/QueryChatWorkspace';
import DashboardOverview from '@/components/DashboardOverview';
import InventoryManager from '@/components/InventoryManager';
import DietaryPreferencesPanel from '@/components/DietaryPreferencesPanel';
import UserMemoryPanel from '@/components/UserMemoryPanel';
import MemoryGraphPanel from '@/components/MemoryGraphPanel';
import SupermarketGrid from '@/components/SupermarketGrid';
import MealPlannerHub from '@/components/MealPlannerHub';
import StoreOptimizerView from '@/components/StoreOptimizerView';
import QuantityPlannerView from '@/components/QuantityPlannerView';
import DietaryFilterView from '@/components/DietaryFilterView';
import MiroFishView from '@/components/MiroFishView';
import AgentSourcesFooter from '@/components/AgentSourcesFooter';
import {
  loadVisibleHousehold,
  saveVisibleHousehold,
  resolveVisibleHousehold,
} from '@/lib/household-visible';

interface AppShellProps {
  userEmail: string;
  initialInventory: InventoryItem[];
  initialFamily: FamilyMember[];
}

function applyTurnToAgentState(
  turn: ReturnType<typeof getActiveTurn>,
  setters: {
    setMealsResult: (v: MealPlanResponse | null) => void;
    setPrices: (v: StorePrice[]) => void;
    setWeather: (v: WeatherCondition) => void;
    setTraffic: (v: TrafficCondition) => void;
    setCrisis: (v: CrisisAlert) => void;
  }
) {
  if (!turn || turn.status !== 'complete') return;
  const snap = turnAgentSnapshot(turn);
  if (snap.mealsResult) setters.setMealsResult(snap.mealsResult);
  setters.setPrices(snap.prices);
  setters.setWeather(snap.weather);
  setters.setTraffic(snap.traffic);
  setters.setCrisis(snap.crisis);
}

export default function AppShell({ userEmail, initialInventory, initialFamily }: AppShellProps) {
  const router = useRouter();
  const userKey = userEmail || 'anonymous';

  const [activeTab, setActiveTab] = useState('chat');
  const [signingOut, setSigningOut] = useState(false);
  const [loading, setLoading] = useState(false);

  const [sessions, setSessions] = useState<QuerySession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [family, setFamily] = useState<FamilyMember[]>(initialFamily);
  const [userMemory, setUserMemory] = useState<UserMemory>(() => createDefaultMemory());
  const [prices, setPrices] = useState<StorePrice[]>([]);
  const [weather, setWeather] = useState<WeatherCondition>(EMPTY_WEATHER);
  const [traffic, setTraffic] = useState<TrafficCondition>(EMPTY_TRAFFIC);
  const [crisis, setCrisis] = useState<CrisisAlert>(EMPTY_CRISIS);
  const [mealsResult, setMealsResult] = useState<MealPlanResponse | null>(null);
  const [activeSources, setActiveSources] = useState<DataSource[]>([]);
  const [activePrompt, setActivePrompt] = useState('');
  const [visibleHouseholdNames, setVisibleHouseholdNames] = useState<string[]>([]);

  const updateVisibleHousehold = useCallback(
    (names: string[]) => {
      const unique = [...new Set(names)];
      setVisibleHouseholdNames(unique);
      saveVisibleHousehold(userKey, unique);
    },
    [userKey]
  );

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const activeTurn = activeSession ? getActiveTurn(activeSession) : null;

  const syncTurnMeta = useCallback((turn: ReturnType<typeof getActiveTurn>) => {
    setActiveSources(turn?.sources ?? []);
    setActivePrompt(turn?.userText ?? '');
  }, []);

  const agentSetters = { setMealsResult, setPrices, setWeather, setTraffic, setCrisis };

  const applyActiveTurn = useCallback(
    (turn: ReturnType<typeof getActiveTurn>) => {
      applyTurnToAgentState(turn, agentSetters);
      syncTurnMeta(turn);
    },
    [syncTurnMeta]
  );

  useEffect(() => {
    const stored = loadSessions(userKey);
    if (stored.length > 0) {
      setSessions(stored);
      setActiveSessionId(stored[0].id);
      applyActiveTurn(getActiveTurn(stored[0]));
    } else {
      const fresh = createEmptySession();
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);

  useEffect(() => {
    if (sessions.length > 0) saveSessions(userKey, sessions);
  }, [sessions, userKey]);

  useEffect(() => {
    if (initialInventory.length) return;
    setLoading(true);
    fetch('/api/data')
      .then((r) => r.json())
      .then((d) => {
        if (d.inventory) setInventory(d.inventory);
        if (d.family) setFamily(d.family);
      })
      .finally(() => setLoading(false));
  }, [initialInventory.length]);

  useEffect(() => {
    const familyNames = [...new Set(family.map((m) => m.name))];
    if (!familyNames.length) {
      setVisibleHouseholdNames([]);
      return;
    }
    setVisibleHouseholdNames((prev) => {
      const valid = [...new Set(prev.filter((n) => familyNames.includes(n)))];
      if (valid.length) return valid;
      return resolveVisibleHousehold(familyNames, loadVisibleHousehold(userKey));
    });
  }, [family, userKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await fetchUserMemory();
      if (cancelled) return;
      if (remote) {
        setUserMemory(remote);
        saveLocalMemory(userKey, remote);
      } else {
        setUserMemory(loadLocalMemory(userKey));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  useEffect(() => {
    applyActiveTurn(activeTurn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, activeSession?.activeTurnId, activeSession?.turns]);

  const persistMemory = async (memory: UserMemory) => {
    setUserMemory(memory);
    saveLocalMemory(userKey, memory);
    await patchUserMemory({
      defaultBudgetLkr: memory.defaultBudgetLkr,
      preferredStores: memory.preferredStores,
      homeArea: memory.homeArea,
      entries: memory.entries,
    });
  };

  const refreshMemoryFromServer = useCallback(async () => {
    const remote = await fetchUserMemory();
    if (remote) {
      setUserMemory(remote);
      saveLocalMemory(userKey, remote);
      return;
    }
    setUserMemory(loadLocalMemory(userKey));
  }, [userKey]);

  const refreshLiveWeather = useCallback(async () => {
    try {
      const res = await fetch('/api/weather');
      if (res.ok) {
        const data = (await res.json()) as WeatherCondition;
        setWeather(data);
      }
    } catch {
      /* keep last known weather */
    }
  }, []);

  const refreshLiveCrisis = useCallback(async () => {
    try {
      const area = encodeURIComponent(userMemory.homeArea || 'Colombo');
      const res = await fetch(`/api/news?location=Sri Lanka ${area}`);
      if (res.ok) {
        const data = (await res.json()) as CrisisAlert;
        setCrisis(data);
      }
    } catch {
      /* keep last known crisis state */
    }
  }, [userMemory.homeArea]);

  useEffect(() => {
    refreshLiveWeather();
    refreshLiveCrisis();
  }, [refreshLiveWeather, refreshLiveCrisis, userMemory.homeArea]);

  const memorySnapshot = {
    defaultBudgetLkr: userMemory.defaultBudgetLkr,
    preferredStores: userMemory.preferredStores,
    homeArea: userMemory.homeArea,
    entries: userMemory.entries,
  };

  const persistInventory = async (items: InventoryItem[]) => {
    setInventory(items);
    await fetch('/api/inventory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inventory: items }),
    });
  };

  const computedInventoryLkr = inventory.reduce((total, item) => {
    const match = prices.find((p) => p.itemName.toLowerCase().includes(item.item.toLowerCase().substring(0, 5)));
    const averageCost = match ? match.polaPrice : 150;
    const factor = item.unit === 'g' || item.unit === 'ml' ? 1000 : 1;
    return total + Math.round((item.quantity / factor) * averageCost);
  }, 0);

  const clearAgentState = useCallback(() => {
    setMealsResult(null);
    setPrices([]);
    setWeather(EMPTY_WEATHER);
    setTraffic(EMPTY_TRAFFIC);
    setCrisis(EMPTY_CRISIS);
  }, []);

  const handleNewQuery = useCallback(() => {
    setActiveTab('chat');

    const current = sessions.find((s) => s.id === activeSessionId);
    if (current && isSessionEmpty(current)) return;

    const existingEmpty = sessions.find((s) => isSessionEmpty(s));
    if (existingEmpty) {
      setActiveSessionId(existingEmpty.id);
      clearAgentState();
      return;
    }

    const fresh = createEmptySession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    clearAgentState();
    setActiveSources([]);
    setActivePrompt('');
  }, [sessions, activeSessionId, clearAgentState]);

  const handleDeleteSession = useCallback((id: string) => {
    const next = sessions.filter((s) => s.id !== id);

    if (next.length === 0) {
      const fresh = createEmptySession();
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
      setActiveTab('chat');
      clearAgentState();
      return;
    }

    setSessions(next);

    if (id === activeSessionId) {
      const past = getPastSessions(next);
      const emptyDraft = next.find((s) => isSessionEmpty(s));
      const target = emptyDraft ?? past[0] ?? next[0];
      setActiveSessionId(target.id);
      setActiveTab('chat');
      applyActiveTurn(getActiveTurn(target));
    }
  }, [sessions, activeSessionId, clearAgentState]);

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setActiveTab('chat');
    const session = sessions.find((s) => s.id === id);
    if (session) applyActiveTurn(getActiveTurn(session));
  }, [sessions]);

  const handleSelectTurn = useCallback((turnId: string) => {
    if (!activeSessionId) return;
    setSessions((prev) => {
      const updated = prev.map((s) => (s.id === activeSessionId ? { ...s, activeTurnId: turnId } : s));
      const session = updated.find((s) => s.id === activeSessionId);
      const turn = session?.turns.find((t) => t.id === turnId);
      if (turn) applyActiveTurn(turn);
      return updated;
    });
  }, [activeSessionId]);

  const handleSessionUpdate = useCallback((updated: QuerySession) => {
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    applyActiveTurn(getActiveTurn(updated));
  }, [applyActiveTurn]);

  const withSources = (node: ReactNode, agentId?: string) => (
    <>
      {node}
      <AgentSourcesFooter sources={activeSources} agentId={agentId} prompt={activePrompt} />
    </>
  );

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  const renderActiveContent = () => {
    if (loading) return <p className="text-sm text-[#15803D]">Loading your family data...</p>;

    if (activeTab === 'chat') {
      if (!activeSession) return null;
      return (
        <QueryChatWorkspace
          session={activeSession}
          onSessionUpdate={handleSessionUpdate}
          onSelectTurn={handleSelectTurn}
          inventory={inventory}
          family={family}
          memory={memorySnapshot}
          onMemoryUpdate={(m) => {
            const merged = { ...userMemory, ...m, updatedAt: new Date().toISOString() };
            setUserMemory(merged);
            saveLocalMemory(userKey, merged);
          }}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return withSources(
          <DashboardOverview
            weather={weather}
            setWeather={setWeather}
            traffic={traffic}
            setTraffic={setTraffic}
            crisis={crisis}
            setCrisis={setCrisis}
            family={family}
            inventoryValue={computedInventoryLkr}
            unpurchasedItems={mealsResult?.shoppingList?.length || 0}
            mealsResult={mealsResult}
            visibleHouseholdNames={visibleHouseholdNames}
          />
        );
      case 'inventory':
        return withSources(
          <InventoryManager inventory={inventory} onInventoryChange={persistInventory} weather={weather} />,
          'inventory-rag'
        );
      case 'family':
        return withSources(
          <DietaryPreferencesPanel
            family={family}
            setFamily={setFamily}
            visibleNames={visibleHouseholdNames}
            setVisibleNames={updateVisibleHousehold}
          />,
          'dietary-guard'
        );
      case 'memory':
        return withSources(
          <UserMemoryPanel memory={userMemory} onMemoryChange={setUserMemory} onPersist={persistMemory} />,
          'orchestrator'
        );
      case 'memory-graph':
        return withSources(
          <MemoryGraphPanel
            memory={userMemory}
            isActive={activeTab === 'memory-graph'}
            onRefresh={refreshMemoryFromServer}
          />,
          'orchestrator'
        );
      case 'agent-1-price':
        return withSources(<SupermarketGrid prices={prices} setPrices={setPrices} weather={weather} />, 'price-catalog');
      case 'agent-2-recipe':
        return withSources(<MealPlannerHub recipes={mealsResult?.recipes || []} />, 'recipe-compiler');
      case 'agent-3-route':
        return withSources(
          <StoreOptimizerView
            shoppingList={mealsResult?.shoppingList || []}
            setShoppingList={(up) => {
              if (mealsResult) setMealsResult({ ...mealsResult, shoppingList: up });
            }}
            inventory={inventory}
            setInventory={persistInventory}
            savingsVsSingleStore={mealsResult?.savingsVsSingleStore || 0}
            totalBudgetSpent={mealsResult?.totalBudgetSpent || 0}
          />,
          'route-optimizer'
        );
      case 'agent-5-decay':
        return withSources(<QuantityPlannerView weather={weather} />, 'sensory-decay');
      case 'agent-6-diet':
        return withSources(<DietaryFilterView family={family} setFamily={setFamily} />, 'dietary-guard');
      case 'mirofish':
        return withSources(<MiroFishView />);
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F5F7F2] font-sans text-[#2D332D]">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        inventoryValue={computedInventoryLkr}
        unpurchasedItems={mealsResult?.shoppingList?.length || 0}
        memoryEntryCount={userMemory.entries.length}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewQuery={handleNewQuery}
        onDeleteSession={handleDeleteSession}
      />

      <main className={`relative flex-1 overflow-hidden max-h-screen flex flex-col ${activeTab === 'chat' ? 'p-2 lg:p-3' : 'p-8 lg:p-12 overflow-y-auto'}`}>
        <div className={`absolute right-4 lg:right-6 top-2 flex items-center gap-2 z-10 ${activeTab === 'chat' ? '' : 'right-8 top-4'}`}>
          <span className="text-xs text-[#14532D]/80">{userEmail}</span>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded-lg border border-[#BBF7D0] bg-white px-3 py-1.5 text-xs font-semibold text-[#14532D] hover:bg-[#F0FDF4] disabled:opacity-60"
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
        <div className={activeTab === 'chat' ? 'flex-1 min-h-0 mt-6 w-full' : 'max-w-5xl mx-auto mt-8'}>{renderActiveContent()}</div>
      </main>
    </div>
  );
}
