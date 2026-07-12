import React, { useState } from 'react';
import { Plus, Minus, Flame, CornerDownRight, Heart, Calendar, AlertCircle } from 'lucide-react';
import { InventoryItem, WeatherCondition } from '../types';

interface InventoryManagerProps {
  inventory: InventoryItem[];
  setInventory: (items: InventoryItem[]) => void;
  weather: WeatherCondition;
}

export default function InventoryManager({ inventory, setInventory, weather }: InventoryManagerProps) {
  const [newItem, setNewItem] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [newUnit, setNewUnit] = useState('g');
  const [newExpiry, setNewExpiry] = useState(14);

  // Plus, minus item quantity
  const handleQuantityAdjust = (id: string, multiplier: number) => {
    const updated = inventory.map((it) => {
      if (it.id === id) {
        const step = it.unit === 'pcs' || it.unit === 'item' ? 1 : 100;
        const finalVal = Math.max(0, it.quantity + (step * multiplier));
        return { ...it, quantity: finalVal };
      }
      return it;
    }).filter((it) => it.quantity > 0); // remove item if 0
    setInventory(updated);
  };

  // Add custom grocery item
  const handleAddGrocery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;

    const added: InventoryItem = {
      id: Math.random().toString(),
      item: newItem,
      quantity: newQuantity,
      unit: newUnit,
      expiryDays: newExpiry,
      lastAdded: new Date().toISOString().split('T')[0]
    };

    setInventory([...inventory, added]);
    setNewItem('');
    setNewQuantity(1);
  };

  return (
    <div className="space-y-8 animate-fade-in text-[#2D332D]">
      
      {/* Page Header */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#16A34A] font-extrabold font-sans">Cabinet Inventory Tracking</p>
        <h2 className="text-3xl font-serif italic font-bold text-[#14532D] mt-1">RAG Home Stock Manager</h2>
        <p className="text-[#15803D] mt-2 text-sm leading-relaxed max-w-3xl font-medium">
          By referencing the ingredients already present in your kitchen cabinet, plango intelligently reduces your weekly grocery list to prevent redundant shopping and over-spending.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main inventory list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-[#BBF7D0] pb-3">
            <h3 className="font-serif font-bold text-lg text-[#14532D] flex items-center gap-2">
              <Flame className="text-[#16A34A] h-5 w-5" /> Active Kitchen Stock
            </h3>
            <span className="text-xs text-[#15803D] font-mono font-bold">{inventory.length} distinct ingredients tracked</span>
          </div>

          <div className="bg-white border border-[#BBF7D0] rounded-[32px] overflow-hidden divide-y divide-[#BBF7D0]/50 p-2 shadow-sm">
            {inventory.length === 0 ? (
              <div className="p-8 text-center text-[#15803D]">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-[#BBF7D0] opacity-80" />
                <p className="text-sm">No items in your kitchen database. Add ingredients using the sidebar form!</p>
              </div>
            ) : (
              inventory.map((item) => {
                // Calculate monsoon adjusted expiry days
                const multiplier = weather.condition === 'monsoon' && (item.item.toLowerCase().includes('tomato') || item.item.toLowerCase().includes('onion')) ? 0.5 : 1;
                const effectiveExpiry = Math.ceil(item.expiryDays * multiplier);
                const isUrgent = effectiveExpiry <= 3;

                return (
                  <div key={item.id} className="p-4 flex items-center justify-between transition-all duration-200 hover:bg-[#F0FDF4]/40 rounded-2xl">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#2D332D] text-sm">{item.item}</span>
                        {isUrgent && (
                          <span className="text-[9px] font-mono bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full border border-red-100 animate-pulse font-bold">
                            Spoils soon (humidity alert)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#15803D] flex items-center gap-1 font-medium">
                        <span>Stored amount:</span>
                        <span className="font-mono font-bold text-[#203D25] bg-[#DCFCE7] px-2 py-0.5 rounded-md border border-[#BBF7D0]/60">{item.quantity} {item.unit}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      
                      {/* Expiry detail */}
                      <div className="text-right space-y-1 hidden sm:block">
                        <div className="text-[10px] text-[#15803D] flex items-center justify-end gap-1 font-mono font-bold">
                          <Calendar className="h-3.5 w-3.5 text-[#BBF7D0]" /> EXPIRY SENSOR
                        </div>
                        <p className={`text-xs font-semibold ${isUrgent ? 'text-red-650 font-bold' : 'text-[#2D332D]'}`}>
                          {effectiveExpiry} Days Left
                          {multiplier < 1 && <span className="text-[9px] text-orange-650 ml-1 font-extrabold">(-50% rain)</span>}
                        </p>
                      </div>

                      {/* Interactive controllers */}
                      <div className="flex items-center border border-[#BBF7D0] rounded-xl overflow-hidden bg-[#FBFBFA]">
                        <button
                          onClick={() => handleQuantityAdjust(item.id, -1)}
                          className="p-1.5 hover:bg-[#DCFCE7] text-[#2D332D] cursor-pointer"
                        >
                          <Minus className="h-3.5 w-3.5 text-[#14532D]" />
                        </button>
                        <span className="text-xs font-mono font-bold px-3 text-[#14532D] text-center min-w-10">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleQuantityAdjust(item.id, 1)}
                          className="p-1.5 hover:bg-[#DCFCE7] text-[#2D332D] cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5 text-[#14532D]" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Add custom item form panel */}
        <div className="space-y-4">
          <h3 className="font-serif font-bold text-lg text-[#14532D] flex items-center gap-2 border-b border-[#BBF7D0] pb-3">
            <Plus className="text-[#16A34A] h-5 w-5" /> Stock New Supplies
          </h3>

          <div className="bg-white border border-[#BBF7D0] rounded-[32px] p-6 space-y-4 shadow-sm">
            <p className="text-xs text-[#15803D] leading-relaxed font-medium">
              Discovered remaining bulk items at home? Manually index them to inform RAG memory pipelines for the active planner.
            </p>

            <form onSubmit={handleAddGrocery} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] block mb-1 font-bold">Item Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Unpolished Rice"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  className="w-full text-xs border border-[#BBF7D0] rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-[#16A34A] bg-[#FBFBFA] font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] block mb-1 font-bold">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(parseInt(e.target.value) || 1)}
                    className="w-full text-xs border border-[#BBF7D0] rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-[#16A34A] bg-[#FBFBFA] font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] block mb-1 font-bold">Unit</label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full text-xs border border-[#BBF7D0] rounded-xl p-2.5 bg-[#FBFBFA] focus:outline-none focus:ring-2 focus:ring-[#16A34A] font-medium"
                  >
                    <option value="g">Grams (g)</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="ml">Millilitres (ml)</option>
                    <option value="item">Count (item)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] block mb-1 font-bold">Typical Shelf Expiry</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={newExpiry}
                    onChange={(e) => setNewExpiry(parseInt(e.target.value) || 14)}
                    className="w-full accent-[#16A34A]"
                  />
                  <span className="text-xs font-mono font-extrabold text-[#2D332D] min-w-12 text-right">
                    {newExpiry} days
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#16A34A] hover:bg-[#14532D] text-white font-extrabold py-2.5 rounded-xl text-xs tracking-wider uppercase shadow-xs cursor-pointer transition-all duration-200 flex items-center justify-center gap-1.5"
              >
                <Plus className="h-4 w-4" /> Index Stock
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
