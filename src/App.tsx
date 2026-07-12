import React, { useState } from 'react';
import { initialInventory, initialFamily, initialPrices, initialWeather, initialTraffic, initialCrisis, initialRecipes, initialShoppingList } from './mockData';
import { InventoryItem, FamilyMember, StorePrice, WeatherCondition, TrafficCondition, CrisisAlert, AgentExecutionLog, MealPlanResponse } from './types';
import Sidebar from './components/Sidebar';
import DashboardOverview from './components/DashboardOverview';
import InventoryManager from './components/InventoryManager';
import DietaryPreferencesPanel from './components/DietaryPreferencesPanel';
import SupermarketGrid from './components/SupermarketGrid';
import OrchestrationConsole from './components/OrchestrationConsole';
import MealPlannerHub from './components/MealPlannerHub';
import StoreOptimizerView from './components/StoreOptimizerView';
import QuantityPlannerView from './components/QuantityPlannerView';
import DietaryFilterView from './components/DietaryFilterView';
import MiroFishView from './components/MiroFishView';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Kitchen state
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [family, setFamily] = useState<FamilyMember[]>(initialFamily);
  const [prices, setPrices] = useState<StorePrice[]>(initialPrices);
  
  // Environment variables
  const [weather, setWeather] = useState<WeatherCondition>(initialWeather);
  const [traffic, setTraffic] = useState<TrafficCondition>(initialTraffic);
  const [crisis, setCrisis] = useState<CrisisAlert>(initialCrisis);
  
  // Budget limit
  const [activeBudget, setActiveBudget] = useState(5000);

  // Pre-loaded finalized outcome model so the application lists finished components
  const [mealsResult, setMealsResult] = useState<MealPlanResponse | null>({
    recipes: initialRecipes,
    shoppingList: initialShoppingList,
    totalBudgetSpent: 905,
    savingsVsSingleStore: 360,
    inventorySavings: 380,
    cookingSchedulerReason: 'Nisha is available 10:00 - 18:00, she handles the Roasted Chicken recipe. Raj has medium skill and manages egg curries post-commute.',
    orchestratorSummary: 'Initial calibration successful. Leveraged home-stocked unpolished rice and dhal to cut cash spend down tremendously. Assigned chicken breast buy order to Cargills and carrots to the local Pola to dodge high traffic along Galle road.',
  });

  // Compiled agent progress traces
  const [agentLogs, setAgentLogs] = useState<AgentExecutionLog[]>([
    { agentName: 'Agent 4: Orchestration Control', status: 'success', message: 'Initial calibration request synchronized successfully.' },
    { agentName: 'Agent 1: Market Research', status: 'success', message: 'Read catalog matrices from Cargills, Keells, and Pola wholesale feeds.' },
    { agentName: 'Agent 6: Dietary Preferences Filter', status: 'success', message: 'Enforced diabetic-friendly rules and excluded all high glycemic sugars.' },
    { agentName: 'Agent 2: Meal Planning Agent', status: 'success', message: 'Identified rice and Mysoor dhal inside home cabinet inventory. Formulated optimal curries.' },
    { agentName: 'Agent 5: Quantity Planner', status: 'success', message: 'Climate sensors computed increased tropical humidity - tomatoes decay cycles set to accelerated.' },
    { agentName: 'Agent 3: Store & Route Optimizer', status: 'success', message: 'Monsoon flash-street blockages analyzed. Routed grocery purchase safely through Battaramulla.' }
  ]);

  // Compute live value metric for Sidebar
  const computedInventoryLkr = inventory.reduce((total, item) => {
    // cross references item with average price in Pola database
    const match = prices.find((p) => p.itemName.toLowerCase().includes(item.item.toLowerCase().substring(0, 5)));
    const averageCost = match ? match.polaPrice : 150;
    const factor = item.unit === 'g' || item.unit === 'ml' ? 1000 : 1;
    return total + Math.round((item.quantity / factor) * averageCost);
  }, 0);

  // Render Page Selection
  const renderActiveContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
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
          />
        );
      case 'inventory':
        return (
          <InventoryManager
            inventory={inventory}
            setInventory={setInventory}
            weather={weather}
          />
        );
      case 'family':
        return (
          <DietaryPreferencesPanel
            family={family}
            setFamily={setFamily}
          />
        );
      case 'agent-1-price':
        return (
          <SupermarketGrid
            prices={prices}
            setPrices={setPrices}
            weather={weather}
          />
        );
      case 'agent-2-recipe':
        return (
          <MealPlannerHub
            recipes={mealsResult?.recipes || []}
          />
        );
      case 'agent-3-route':
        return (
          <StoreOptimizerView
            shoppingList={mealsResult?.shoppingList || []}
            setShoppingList={(up) => {
              if (mealsResult) {
                setMealsResult({ ...mealsResult, shoppingList: up });
              }
            }}
            inventory={inventory}
            setInventory={setInventory}
            savingsVsSingleStore={mealsResult?.savingsVsSingleStore || 0}
            totalBudgetSpent={mealsResult?.totalBudgetSpent || 0}
          />
        );
      case 'agent-4-orchestrate':
        return (
          <OrchestrationConsole
            inventory={inventory}
            family={family}
            prices={prices}
            weather={weather}
            traffic={traffic}
            crisis={crisis}
            mealsResult={mealsResult}
            setMealsResult={setMealsResult}
            agentLogs={agentLogs}
            setAgentLogs={setAgentLogs}
            activeBudget={activeBudget}
            setActiveBudget={setActiveBudget}
          />
        );
      case 'agent-5-decay':
        return (
          <QuantityPlannerView
            weather={weather}
          />
        );
      case 'agent-6-diet':
        return (
          <DietaryFilterView
            family={family}
            setFamily={setFamily}
          />
        );
      case 'mirofish':
        return (
          <MiroFishView />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F5F7F2] font-sans text-[#2D332D]">
      
      {/* Sidebar navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        inventoryValue={computedInventoryLkr}
        unpurchasedItems={mealsResult?.shoppingList?.length || 0}
      />

      {/* Main Page Area */}
      <main className="flex-1 overflow-y-auto max-h-screen p-8 lg:p-12">
        <div className="max-w-5xl mx-auto">
          {renderActiveContent()}
        </div>
      </main>

    </div>
  );
}
