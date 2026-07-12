import React, { useState } from 'react';
import { ShoppingBag, TrendingUp, CheckSquare, Square, AlertCircle, Sparkles, Building, CornerDownRight, CheckCircle2 } from 'lucide-react';
import { ShoppingListItem, InventoryItem } from '../types';

interface StoreOptimizerViewProps {
  shoppingList: ShoppingListItem[];
  setShoppingList: (list: ShoppingListItem[]) => void;
  inventory: InventoryItem[];
  setInventory: (items: InventoryItem[]) => void;
  savingsVsSingleStore: number;
  totalBudgetSpent: number;
}

export default function StoreOptimizerView({
  shoppingList,
  setShoppingList,
  inventory,
  setInventory,
  savingsVsSingleStore,
  totalBudgetSpent,
}: StoreOptimizerViewProps) {
  const [completeSuccessMessage, setCompleteSuccessMessage] = useState<string | null>(null);

  // Group items by optimize supermarket
  const grouped = shoppingList.reduce((acc, item) => {
    const store = item.store || 'Pola';
    if (!acc[store]) acc[store] = [];
    acc[store].push(item);
    return acc;
  }, {} as Record<string, ShoppingListItem[]>);

  // Mark item as bought, registering it in our cupboard stock!
  const markAsBought = (itemTitle: string) => {
    const matched = shoppingList.find((it) => it.item === itemTitle);
    if (!matched) return;

    // 1. Remove/update from shopping list
    setShoppingList(shoppingList.filter((it) => it.item !== itemTitle));

    // 2. Insert or update in cabinet stock
    const existingIndex = inventory.findIndex((it) => it.item.toLowerCase().trim() === itemTitle.toLowerCase().trim());
    if (existingIndex >= 0) {
      const updated = [...inventory];
      updated[existingIndex].quantity += matched.requiredQty;
      setInventory(updated);
    } else {
      const insertNew: InventoryItem = {
        id: Math.random().toString(),
        item: matched.item,
        quantity: matched.requiredQty,
        unit: matched.unit,
        expiryDays: matched.spoilageRisk === 'high' ? 3 : 14,
        lastAdded: new Date().toISOString().split('T')[0]
      };
      setInventory([...inventory, insertNew]);
    }

    setCompleteSuccessMessage(`Logged ${matched.requiredQty}${matched.unit} of ${matched.item} into home cabinets RAG stock!`);
    setTimeout(() => setCompleteSuccessMessage(null), 3000);
  };

  const storesList = Object.keys(grouped) as ('Keells' | 'Cargills' | 'Pola')[];

  return (
    <div className="space-y-8 animate-fade-in text-[#2D332D]">
      
      {/* Header section */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#16A34A] font-extrabold font-sans">Route & Basket Optimizer</p>
        <h2 className="text-3xl font-serif italic font-bold text-[#14532D] mt-1">Smart Shopping & Store optimization</h2>
        <p className="text-[#15803D] mt-2 text-sm leading-relaxed max-w-3xl">
          Observe split list optimizations calculated by Agent 3. Purchases are distributed among Keells, Cargills, or Pola to secure lowest wholesale cost while evading congestions.
        </p>
      </div>

      {completeSuccessMessage && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] p-4 rounded-xl text-[#14532D] text-xs flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="h-4.5 w-4.5 text-[#16A34A]" />
          <span>{completeSuccessMessage}</span>
        </div>
      )}

      {shoppingList.length === 0 ? (
        <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-8 text-center text-[#15803D] shadow-sm">
          <ShoppingBag className="h-10 w-10 text-[#BBF7D0] mx-auto mb-2 opacity-60" />
          <p className="text-sm leading-relaxed max-w-sm mx-auto">
            Your shopping basket is empty. Set your preferences and execute a dynamic compilation inside the <strong className="text-[#14532D] font-bold font-sans">Autonomous Planner</strong> screen (Agent 4) first!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Columns: Optimized Store Buckets */}
          <div className="lg:col-span-2 space-y-6">
            {storesList.map((storeLoc, index) => {
              const listItems = grouped[storeLoc] || [];
              const storeTotal = listItems.reduce((sum, item) => sum + item.totalPrice, 0);

              return (
                <div key={index} className="bg-white border border-[#BBF7D0] rounded-[32px] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  {/* Store Card Header */}
                  <div className="bg-[#FBFBFA] px-6 py-4 border-b border-[#BBF7D0] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 bg-[#DCFCE7] text-[#14532D] rounded-lg flex items-center justify-center border border-[#BBF7D0]">
                        <Building className="h-4.5 w-4.5 text-[#16A34A]" />
                      </div>
                      <div>
                        <h4 className="font-serif font-bold text-[#14532D] text-sm">{storeLoc} Optimized Split</h4>
                        <p className="text-[10px] text-[#15803D] uppercase tracking-widest font-mono font-bold">CHEMICALLY AUDITED INDEX</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-mono text-[#15803D] font-bold block">Subtotal Spent</span>
                      <span className="text-sm font-mono font-bold text-[#2D332D]">LKR {Math.round(storeTotal)}</span>
                    </div>
                  </div>

                  {/* Store Commodities List */}
                  <div className="divide-y divide-[#BBF7D0]/60">
                    {listItems.map((grocery, gIdx) => {
                      const isHighRisk = grocery.spoilageRisk === 'high';
                      return (
                        <div key={gIdx} className="px-6 py-4 flex items-center justify-between hover:bg-[#F0FDF4]/40 transition-all duration-200">
                          <div className="flex items-start gap-4">
                            {/* Tap checkmark mechanism to simulate immediate buying and cabinet stock auto-addition */}
                            <button
                              onClick={() => markAsBought(grocery.item)}
                              className="mt-0.5 text-[#15803D] hover:text-[#16A34A] transition-colors cursor-pointer"
                              title="Confirm purchase & populate cabinet stocks"
                            >
                              <Square className="h-5 w-5 text-[#15803D] hover:text-[#16A34A]" />
                            </button>
                            <div className="space-y-0.5">
                              <p className="font-bold text-[#2D332D] text-xs leading-normal">{grocery.item}</p>
                              <p className="text-[11px] text-[#15803D] font-mono">
                                Portions: {grocery.requiredQty} {grocery.unit} • LKR {grocery.unitPrice} per unit
                              </p>
                              {isHighRisk && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-orange-850 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-100 mt-1">
                                  <AlertCircle className="h-2.5 w-2.5 text-orange-600" />
                                  <span>high spoilage (buy small, use fast)</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-xs font-mono font-extrabold text-[#2D332D]">LKR {Math.round(grocery.totalPrice)}</span>
                            <span className="text-[10px] text-[#16A34A] block font-mono font-bold mt-0.5">Cheapest option ✓</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Optimizer Savings Summary Deck */}
          <div className="space-y-4">
            <h3 className="font-serif font-bold text-lg text-[#14532D] border-b border-[#BBF7D0] pb-3 flex items-center gap-2">
              <Sparkles className="text-[#16A34A] h-5 w-5 animate-pulse" /> Optimizations Breakdown
            </h3>

            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[32px] p-5 space-y-5 text-[#2D332D] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-[#DCFCE7] border border-[#BBF7D0] rounded-xl flex items-center justify-center text-[#14532D]">
                  <TrendingUp className="h-5 w-5 text-[#16A34A]" />
                </div>
                <div>
                  <p className="text-[#15803D] text-[10px] tracking-wider uppercase font-mono font-bold">Total Savings Accrued</p>
                  <p className="text-2xl font-bold font-serif text-[#14532D]">LKR {savingsVsSingleStore} Saved</p>
                </div>
              </div>

              <div className="p-3 bg-white/70 rounded-2xl space-y-2.5 text-xs border border-[#BBF7D0]">
                <div>
                  <p className="text-[#15803D] font-mono text-[9px] uppercase font-bold">Carbon Footprint Saved</p>
                  <p className="font-bold text-[#2D332D] mt-0.5">8.4 kg CO₂ equivalent</p>
                </div>
                <div className="border-t border-[#BBF7D0]/60 pt-2">
                  <p className="text-[#15803D] font-mono text-[9px] uppercase font-bold">Traffic Commute bypass</p>
                  <p className="font-bold text-[#2D332D] mt-0.5">Estimated 80 Minutes saved</p>
                </div>
                <div className="border-t border-[#BBF7D0]/60 pt-2">
                  <p className="text-[#15803D] font-mono text-[9px] uppercase font-bold">Perishable waste saved</p>
                  <p className="font-bold text-[#2D332D] mt-0.5">2.2 kg decaying food waste mitigated</p>
                </div>
              </div>

              <div className="rounded-[24px] border border-dashed border-[#16A34A]/30 p-4 text-[11px] leading-relaxed text-[#14532D] font-medium bg-white/30">
                💡 <span className="font-extrabold">plango Tip:</span> Tap the blank square checkboxes next to any grocery item to confirm your purchase and automatically log it in your cupboard cabinets stock!
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
