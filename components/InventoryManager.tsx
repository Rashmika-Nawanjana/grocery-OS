'use client';
import React, { useRef, useState } from 'react';
import { Plus, Minus, Flame, Calendar, AlertCircle, Camera, Upload, Loader2, CheckCircle2, Trash2, X } from 'lucide-react';
import { InventoryItem, WeatherCondition } from '@/lib/types';
import type { ScannedBillItem } from '@/lib/inventory-merge';
import { mergeBillItemsIntoInventory } from '@/lib/inventory-merge';

interface ReviewBillItem extends ScannedBillItem {
  id: string;
}

interface InventoryManagerProps {
  inventory: InventoryItem[];
  onInventoryChange: (items: InventoryItem[]) => void;
  weather: WeatherCondition;
}

export default function InventoryManager({ inventory, onInventoryChange, weather }: InventoryManagerProps) {
  const [newItem, setNewItem] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [newUnit, setNewUnit] = useState('g');
  const [newExpiry, setNewExpiry] = useState(14);

  // Plus, minus item quantity
  const [seeding, setSeeding] = useState(false);
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billPreview, setBillPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanSuccess, setScanSuccess] = useState<{ added: string[]; updated: string[] } | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewBillItem[]>([]);
  const [reviewMeta, setReviewMeta] = useState<{ storeName?: string; billDate?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleQuantityAdjust = (id: string, multiplier: number) => {
    const updated = inventory.map((it) => {
      if (it.id === id) {
        const step = it.unit === 'pcs' || it.unit === 'item' ? 1 : 100;
        const finalVal = Math.max(0, it.quantity + (step * multiplier));
        return { ...it, quantity: finalVal };
      }
      return it;
    }).filter((it) => it.quantity > 0);
    onInventoryChange(updated);
  };

  // Add custom grocery item
  const handleAddGrocery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;

    const { inventory: merged } = mergeBillItemsIntoInventory(inventory, [
      {
        item: newItem.trim(),
        quantity: newQuantity,
        unit: newUnit,
        expiryDays: newExpiry,
      },
    ]);

    onInventoryChange(merged);
    setNewItem('');
    setNewQuantity(1);
  };

  const handleReseed = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) });
      const data = await res.json();
      if (data.inventory) onInventoryChange(data.inventory);
    } finally {
      setSeeding(false);
    }
  };

  const handleBillFile = (file: File | null) => {
    setScanError('');
    setScanSuccess(null);
    if (billPreview) URL.revokeObjectURL(billPreview);
    if (!file) {
      setBillFile(null);
      setBillPreview(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setScanError('Please upload a photo (JPEG, PNG, or WebP).');
      return;
    }
    setBillFile(file);
    setBillPreview(URL.createObjectURL(file));
    setReviewItems([]);
    setReviewMeta(null);
  };

  const handleDiscardReview = () => {
    setReviewItems([]);
    setReviewMeta(null);
    setScanError('');
    handleBillFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateReviewItem = (id: string, patch: Partial<ScannedBillItem>) => {
    setReviewItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeReviewItem = (id: string) => {
    setReviewItems((prev) => prev.filter((row) => row.id !== id));
  };

  const addReviewRow = () => {
    setReviewItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), item: '', quantity: 1, unit: 'g', expiryDays: 14 },
    ]);
  };

  const handleScanBill = async () => {
    if (!billFile) return;
    setScanning(true);
    setScanError('');
    setScanSuccess(null);
    setReviewItems([]);
    setReviewMeta(null);
    try {
      const form = new FormData();
      form.append('file', billFile);
      const res = await fetch('/api/inventory/scan-bill', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bill scan failed');

      const rows: ReviewBillItem[] = (data.items || []).map((row: ScannedBillItem) => ({
        id: crypto.randomUUID(),
        item: row.item,
        quantity: row.quantity,
        unit: row.unit || 'item',
        expiryDays: row.expiryDays || 14,
      }));

      if (!rows.length) throw new Error('No grocery items found on this bill');
      setReviewItems(rows);
      setReviewMeta({ storeName: data.storeName, billDate: data.billDate });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Could not scan bill');
    } finally {
      setScanning(false);
    }
  };

  const handleConfirmReview = async () => {
    const items = reviewItems.filter((row) => row.item.trim() && row.quantity > 0);
    if (!items.length) {
      setScanError('Keep at least one item with a name and quantity.');
      return;
    }

    setApplying(true);
    setScanError('');
    setScanSuccess(null);
    try {
      const res = await fetch('/api/inventory/apply-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(({ item, quantity, unit, expiryDays }) => ({
            item: item.trim(),
            quantity,
            unit,
            expiryDays,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update stock');

      onInventoryChange(data.inventory);
      setScanSuccess({ added: data.added || [], updated: data.updated || [] });
      handleDiscardReview();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Could not update stock');
    } finally {
      setApplying(false);
    }
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

      {reviewItems.length > 0 && (
        <div className="bg-white border-2 border-[#16A34A] rounded-[32px] p-6 shadow-md space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#16A34A] font-extrabold">Review before saving</p>
              <h3 className="text-xl font-serif font-bold text-[#14532D] mt-1">Scanned bill items</h3>
              <p className="text-xs text-[#15803D] mt-1">
                Edit names, quantities, or units below — then confirm to update your kitchen stock.
                {reviewMeta?.storeName && ` · ${reviewMeta.storeName}`}
                {reviewMeta?.billDate && ` · ${reviewMeta.billDate}`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDiscardReview}
              className="text-xs font-semibold text-stone-500 hover:text-red-700 flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" /> Discard
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#BBF7D0]">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="bg-[#F0FDF4] text-[#15803D]">
                <tr>
                  <th className="text-left p-3 font-bold uppercase tracking-wider">Item</th>
                  <th className="text-left p-3 font-bold uppercase tracking-wider w-24">Qty</th>
                  <th className="text-left p-3 font-bold uppercase tracking-wider w-28">Unit</th>
                  <th className="text-left p-3 font-bold uppercase tracking-wider w-24">Expiry</th>
                  <th className="p-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#BBF7D0]/50">
                {reviewItems.map((row) => (
                  <tr key={row.id} className="bg-[#FBFBFA]">
                    <td className="p-2">
                      <input
                        type="text"
                        value={row.item}
                        onChange={(e) => updateReviewItem(row.id, { item: e.target.value })}
                        className="w-full border border-[#BBF7D0] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        value={row.quantity}
                        onChange={(e) => updateReviewItem(row.id, { quantity: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-[#BBF7D0] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={row.unit}
                        onChange={(e) => updateReviewItem(row.id, { unit: e.target.value })}
                        className="w-full border border-[#BBF7D0] rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                      >
                        <option value="g">g</option>
                        <option value="pcs">pcs</option>
                        <option value="ml">ml</option>
                        <option value="item">item</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={row.expiryDays}
                        onChange={(e) => updateReviewItem(row.id, { expiryDays: parseInt(e.target.value) || 14 })}
                        className="w-full border border-[#BBF7D0] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeReviewItem(row.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-600"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={addReviewRow}
              className="text-xs font-bold px-4 py-2 rounded-xl border border-[#BBF7D0] text-[#14532D] hover:bg-[#F0FDF4]"
            >
              + Add row
            </button>
            <button
              type="button"
              onClick={handleConfirmReview}
              disabled={applying}
              className="text-xs font-extrabold px-5 py-2 rounded-xl bg-[#16A34A] text-white hover:bg-[#14532D] disabled:opacity-60 flex items-center gap-1.5 uppercase tracking-wider"
            >
              {applying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Confirm &amp; add to stock
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main inventory list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-[#BBF7D0] pb-3">
            <h3 className="font-serif font-bold text-lg text-[#14532D] flex items-center gap-2">
              <Flame className="text-[#16A34A] h-5 w-5" /> Active Kitchen Stock
            </h3>
            <span className="text-xs text-[#15803D] font-mono font-bold">{inventory.length} items · RAG indexed</span>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleReseed}
              disabled={seeding}
              className="text-[10px] font-bold uppercase tracking-wider text-[#16A34A] border border-[#BBF7D0] px-3 py-1.5 rounded-lg hover:bg-[#F0FDF4] disabled:opacity-60"
            >
              {seeding ? 'Seeding...' : 'Reset dummy pantry data'}
            </button>
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
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-[#16A34A]" />
              <p className="text-xs font-bold text-[#14532D] uppercase tracking-wider">Scan shopping bill</p>
            </div>
            <p className="text-xs text-[#15803D] leading-relaxed font-medium">
              Upload a receipt photo — plango reads line items, lets you review them, then updates your kitchen stock.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleBillFile(e.target.files?.[0] ?? null)}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleBillFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className="w-full border-2 border-dashed border-[#BBF7D0] rounded-2xl p-4 text-center hover:bg-[#F0FDF4]/60 transition-colors cursor-pointer"
            >
              {billPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={billPreview} alt="Bill preview" className="max-h-40 mx-auto rounded-xl object-contain" />
              ) : (
                <div className="space-y-2 py-2">
                  <Upload className="h-6 w-6 mx-auto text-[#16A34A]" />
                  <p className="text-xs font-semibold text-[#14532D]">Tap to take or upload a bill photo</p>
                  <p className="text-[10px] text-stone-500">JPEG, PNG, WebP · max 8 MB</p>
                </div>
              )}
            </button>

            {billFile && !reviewItems.length && (
              <button
                type="button"
                onClick={handleScanBill}
                disabled={scanning}
                className="w-full bg-[#14532D] hover:bg-[#0f3d21] text-white font-extrabold py-2.5 rounded-xl text-xs tracking-wider uppercase shadow-xs cursor-pointer transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {scanning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Reading bill…
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" /> Scan bill
                  </>
                )}
              </button>
            )}

            {reviewItems.length > 0 && (
              <p className="text-xs text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-3 py-2">
                {reviewItems.length} item{reviewItems.length === 1 ? '' : 's'} ready for review above — edit and confirm when ready.
              </p>
            )}

            {scanError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{scanError}</p>
            )}

            {scanSuccess && (
              <div className="text-xs bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-3 py-2 space-y-1">
                <p className="font-bold text-[#14532D] flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" /> Stock updated from bill
                </p>
                {scanSuccess.added.length > 0 && (
                  <p className="text-[#15803D]">Added: {scanSuccess.added.join(', ')}</p>
                )}
                {scanSuccess.updated.length > 0 && (
                  <p className="text-[#15803D]">Restocked: {scanSuccess.updated.join(', ')}</p>
                )}
              </div>
            )}

            <div className="border-t border-[#BBF7D0]/60 pt-4">
              <p className="text-[10px] font-mono tracking-widest uppercase text-[#15803D] mb-3 font-bold">Or add manually</p>
            </div>

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
