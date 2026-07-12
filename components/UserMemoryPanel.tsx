'use client';

import { useState } from 'react';
import { Brain, MapPin, Store, Wallet, Trash2, Plus } from 'lucide-react';
import type { UserMemory, MemoryEntry } from '@/lib/memory/types';

interface UserMemoryPanelProps {
  memory: UserMemory;
  onMemoryChange: (memory: UserMemory) => void;
  onPersist?: (memory: UserMemory) => Promise<void>;
}

const CATEGORY_LABELS: Record<string, string> = {
  preference: 'Preferences',
  dietary: 'Dietary',
  store: 'Stores',
  budget: 'Budget',
  location: 'Location',
  dish: 'Liked dishes',
  avoid: 'Avoids',
  fact: 'Facts',
};

export default function UserMemoryPanel({ memory, onMemoryChange, onPersist }: UserMemoryPanelProps) {
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState('');

  const persist = async (next: UserMemory) => {
    onMemoryChange(next);
    if (onPersist) {
      setSaving(true);
      try {
        await onPersist(next);
      } finally {
        setSaving(false);
      }
    }
  };

  const removeEntry = (id: string) => {
    persist({
      ...memory,
      entries: memory.entries.filter((e) => e.id !== id),
      updatedAt: new Date().toISOString(),
    });
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    const now = new Date().toISOString();
    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      category: 'preference',
      key: newNote.trim().slice(0, 40).toLowerCase(),
      value: newNote.trim(),
      source: 'user',
      confidence: 1,
      createdAt: now,
      updatedAt: now,
    };
    persist({ ...memory, entries: [...memory.entries, entry], updatedAt: now });
    setNewNote('');
  };

  const grouped = memory.entries.reduce<Record<string, MemoryEntry[]>>((acc, e) => {
    (acc[e.category] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#14532D] flex items-center gap-2">
            <Brain className="h-6 w-6 text-[#16A34A]" />
            Knowledge Memory
          </h2>
          <p className="text-sm text-[#15803D] mt-1 max-w-xl">
            Persistent preferences learned from your chats. Agents use this across sessions for better planning.
          </p>
        </div>
        {saving && <span className="text-xs text-[#16A34A] font-mono">Saving…</span>}
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <label className="bg-white border border-[#BBF7D0] rounded-xl p-4 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-[#16A34A] font-bold flex items-center gap-1">
            <Wallet className="h-3 w-3" /> Default budget
          </span>
          <input
            type="number"
            value={memory.defaultBudgetLkr}
            onChange={(e) =>
              persist({ ...memory, defaultBudgetLkr: parseInt(e.target.value, 10) || 5000, updatedAt: new Date().toISOString() })
            }
            className="w-full text-lg font-semibold text-[#14532D] border-0 focus:outline-none bg-transparent"
          />
        </label>

        <label className="bg-white border border-[#BBF7D0] rounded-xl p-4 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-[#16A34A] font-bold flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Home area
          </span>
          <input
            type="text"
            value={memory.homeArea}
            onChange={(e) => persist({ ...memory, homeArea: e.target.value, updatedAt: new Date().toISOString() })}
            className="w-full text-lg font-semibold text-[#14532D] border-0 focus:outline-none bg-transparent"
          />
        </label>

        <div className="bg-white border border-[#BBF7D0] rounded-xl p-4">
          <span className="text-[10px] uppercase tracking-wider text-[#16A34A] font-bold flex items-center gap-1">
            <Store className="h-3 w-3" /> Preferred stores
          </span>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(['Keells', 'Cargills', 'Pola'] as const).map((store) => {
              const active = memory.preferredStores.includes(store);
              return (
                <button
                  key={store}
                  type="button"
                  onClick={() => {
                    const stores = active
                      ? memory.preferredStores.filter((s) => s !== store)
                      : [...memory.preferredStores, store];
                    persist({ ...memory, preferredStores: stores, updatedAt: new Date().toISOString() });
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold border transition-colors ${
                    active
                      ? 'bg-[#16A34A] text-white border-[#16A34A]'
                      : 'bg-[#F0FDF4] text-[#14532D] border-[#BBF7D0] hover:bg-[#DCFCE7]'
                  }`}
                >
                  {store}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#BBF7D0] rounded-xl p-4">
        <p className="text-xs font-bold text-[#16A34A] uppercase tracking-wider mb-3">Add a note</p>
        <div className="flex gap-2">
          <input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="e.g. Prefer mild curries for kids"
            className="flex-1 text-sm border border-[#BBF7D0] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
            onKeyDown={(e) => e.key === 'Enter' && addNote()}
          />
          <button
            type="button"
            onClick={addNote}
            className="bg-[#16A34A] text-white px-3 py-2 rounded-lg hover:bg-[#14532D] flex items-center gap-1 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-[#15803D]/70 italic">
          No learned entries yet. Chat with the assistant — preferences will appear here automatically.
        </p>
      ) : (
        Object.entries(grouped).map(([category, entries]) => (
          <div key={category} className="bg-white border border-[#BBF7D0] rounded-xl p-4">
            <h3 className="text-xs font-bold text-[#16A34A] uppercase tracking-wider mb-3">
              {CATEGORY_LABELS[category] ?? category}
            </h3>
            <ul className="space-y-2">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 text-sm text-[#2D332D]">
                  <div>
                    <span>{entry.value}</span>
                    <span className="ml-2 text-[10px] text-[#15803D]/50 font-mono uppercase">{entry.source}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    className="text-[#15803D]/40 hover:text-red-500 shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
