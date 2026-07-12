'use client';

import { useEffect, useState } from 'react';
import { Brain, RefreshCw, Network } from 'lucide-react';
import type { UserMemory } from '@/lib/memory/types';
import type { GraphNode } from '@/lib/memory/graph-nodes';
import MemoryNeuralGraph, { MemoryNodeDetail } from '@/components/MemoryNeuralGraph';

interface MemoryGraphPanelProps {
  memory: UserMemory;
  isActive: boolean;
  onRefresh?: () => Promise<void>;
}

export default function MemoryGraphPanel({ memory, isActive, onRefresh }: MemoryGraphPanelProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState(memory.updatedAt);

  useEffect(() => {
    setLastSync(memory.updatedAt);
    setSelectedNode((prev) => {
      if (!prev?.entry) return prev;
      const still = memory.entries.find((e) => e.id === prev.entry?.id);
      if (!still) return null;
      return prev;
    });
  }, [memory]);

  useEffect(() => {
    if (!isActive || !onRefresh) return;
    const poll = setInterval(async () => {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [isActive, onRefresh]);

  const handleManualRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#14532D] flex items-center gap-2">
            <Network className="h-6 w-6 text-[#16A34A]" />
            Memory Neural Map
          </h2>
          <p className="text-sm text-[#15803D] mt-1 max-w-xl">
            Live view of your knowledge graph. Data is stored normally in Supabase — this is a visual map that refreshes
            after every chat turn and sync.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-[#15803D]/70">
            Last sync {new Date(lastSync).toLocaleTimeString()}
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#BBF7D0] bg-white text-[#14532D] hover:bg-[#F0FDF4] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Sync
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <MemoryNeuralGraph
          memory={memory}
          onNodeSelect={setSelectedNode}
          selectedNodeId={selectedNode?.id ?? null}
        />
        <div className="space-y-4">
          <MemoryNodeDetail node={selectedNode} />

          <div className="rounded-xl border border-[#BBF7D0] bg-white p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-[#16A34A] font-bold flex items-center gap-1">
              <Brain className="h-3 w-3" /> Snapshot
            </p>
            <ul className="text-xs text-[#14532D] space-y-1.5 font-mono">
              <li>Budget: LKR {memory.defaultBudgetLkr.toLocaleString()}</li>
              <li>Area: {memory.homeArea}</li>
              <li>Stores: {memory.preferredStores.join(', ') || '—'}</li>
              <li>Entries: {memory.entries.length}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
