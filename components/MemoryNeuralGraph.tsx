'use client';

import { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { UserMemory } from '@/lib/memory/types';
import {
  buildMemoryGraph,
  CATEGORY_META,
  isRecentlyUpdated,
  type GraphNode,
} from '@/lib/memory/graph-nodes';

interface MemoryNeuralGraphProps {
  memory: UserMemory;
  width?: number;
  height?: number;
  onNodeSelect?: (node: GraphNode | null) => void;
  selectedNodeId?: string | null;
}

function nodeRadius(type: GraphNode['type']) {
  if (type === 'hub') return 36;
  if (type === 'core') return 22;
  if (type === 'category') return 26;
  return 14;
}

function nodeColor(node: GraphNode): string {
  if (node.type === 'hub') return '#14532D';
  if (node.category) return CATEGORY_META[node.category]?.color ?? '#16A34A';
  return '#16A34A';
}

export default function MemoryNeuralGraph({
  memory,
  width = 720,
  height = 520,
  onNodeSelect,
  selectedNodeId,
}: MemoryNeuralGraphProps) {
  const graph = useMemo(() => buildMemoryGraph(memory, width, height), [memory, width, height]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const activeId = selectedNodeId ?? hoverId;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-[#BBF7D0] bg-gradient-to-br from-[#F0FDF4] via-[#ECFDF5] to-[#DCFCE7]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto min-h-[420px]"
        role="img"
        aria-label="Memory neural network graph"
      >
        <defs>
          <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </radialGradient>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background glow */}
        <circle cx={width / 2} cy={height / 2} r={120} fill="url(#hubGlow)" />

        {/* Edges */}
        {graph.edges.map((edge) => {
          const from = graph.nodes.find((n) => n.id === edge.from);
          const to = graph.nodes.find((n) => n.id === edge.to);
          if (!from || !to) return null;
          const highlighted =
            activeId === edge.from || activeId === edge.to || activeId === from.id || activeId === to.id;
          return (
            <line
              key={edge.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={highlighted ? '#16A34A' : '#86EFAC'}
              strokeWidth={highlighted ? 2.2 : 1 + edge.strength}
              strokeOpacity={highlighted ? 0.85 : 0.35 + edge.strength * 0.3}
              className={highlighted ? '' : 'memory-edge-flow'}
            />
          );
        })}

        {/* Nodes */}
        {graph.nodes.map((node) => {
          const r = nodeRadius(node.type);
          const selected = selectedNodeId === node.id;
          const hovered = hoverId === node.id;
          const fresh = isRecentlyUpdated(node.updatedAt);
          const color = nodeColor(node);

          return (
            <g
              key={node.id}
              className="cursor-pointer"
              onMouseEnter={() => setHoverId(node.id)}
              onMouseLeave={() => setHoverId(null)}
              onClick={() => onNodeSelect?.(selected ? null : node)}
            >
              {fresh && (
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 10}
                  fill="none"
                  stroke="#16A34A"
                  strokeWidth={2}
                  initial={{ opacity: 0.8, scale: 0.8 }}
                  animate={{ opacity: 0, scale: 1.6 }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={r + (selected ? 4 : hovered ? 2 : 0)}
                fill={color}
                fillOpacity={node.type === 'entry' ? 0.85 : 0.95}
                stroke={selected ? '#14532D' : '#BBF7D0'}
                strokeWidth={selected ? 3 : 1.5}
                filter={selected || node.type === 'hub' ? 'url(#softGlow)' : undefined}
              />
              {(node.type === 'hub' || node.type === 'category' || node.type === 'core') && (
                <text
                  x={node.x}
                  y={node.y + (node.type === 'hub' ? 5 : 4)}
                  textAnchor="middle"
                  fill={node.type === 'hub' ? '#fff' : '#fff'}
                  fontSize={node.type === 'hub' ? 13 : 10}
                  fontWeight={700}
                  className="pointer-events-none select-none"
                >
                  {node.label.length > 16 ? node.label.slice(0, 14) + '…' : node.label}
                </text>
              )}
              {node.type === 'entry' && (hovered || selected) && (
                <text
                  x={node.x}
                  y={node.y + r + 14}
                  textAnchor="middle"
                  fill="#14532D"
                  fontSize={9}
                  fontWeight={600}
                  className="pointer-events-none select-none"
                >
                  {node.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
        {Object.entries(CATEGORY_META).slice(0, 4).map(([key, meta]) => (
          <span key={key} className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/80 border border-[#BBF7D0] text-[#14532D]">
            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ background: meta.color }} />
            {meta.label}
          </span>
        ))}
      </div>

      <p className="absolute bottom-3 right-3 text-[9px] font-mono text-[#15803D]/70">
        {graph.nodes.length} nodes · {graph.edges.length} synapses
      </p>
    </div>
  );
}

export function MemoryNodeDetail({ node }: { node: GraphNode | null }) {
  return (
    <AnimatePresence mode="wait">
      {node ? (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 12 }}
          className="rounded-xl border border-[#BBF7D0] bg-white p-4 space-y-3 shadow-sm"
        >
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#16A34A] font-bold">
              {node.type === 'hub' ? 'Memory hub' : node.category ? CATEGORY_META[node.category]?.label : 'Node'}
            </p>
            <h3 className="text-lg font-serif font-bold text-[#14532D] mt-1">{node.label}</h3>
          </div>

          {node.entry && (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-[#15803D]/70">Source</dt>
                <dd className="font-mono text-[#14532D] capitalize">{node.entry.source}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#15803D]/70">Confidence</dt>
                <dd className="font-mono text-[#14532D]">{Math.round(node.entry.confidence * 100)}%</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#15803D]/70">Learned</dt>
                <dd className="font-mono text-[#14532D] text-xs">
                  {new Date(node.entry.updatedAt).toLocaleString()}
                </dd>
              </div>
              <div className="pt-2 border-t border-[#BBF7D0]">
                <dt className="text-[#15803D]/70 text-xs mb-1">Full value</dt>
                <dd className="text-[#2D332D] leading-relaxed">{node.entry.value}</dd>
              </div>
            </dl>
          )}

          {!node.entry && node.type !== 'hub' && (
            <p className="text-sm text-[#15803D]">
              Core memory attribute synced to your profile and used by all agents.
            </p>
          )}

          {node.type === 'hub' && (
            <p className="text-sm text-[#15803D]">
              Central hub connecting your persistent knowledge. Grows after each orchestration turn.
            </p>
          )}
        </motion.div>
      ) : (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border border-dashed border-[#BBF7D0] bg-[#F0FDF4]/50 p-6 text-center"
        >
          <p className="text-sm text-[#15803D]">Click a node to inspect memory details.</p>
          <p className="text-[10px] text-[#15803D]/60 mt-2 font-mono">Updates live after each chat turn</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
