import type { MemoryCategory, MemoryEntry, UserMemory } from '@/lib/memory/types';

export type GraphNodeType = 'hub' | 'core' | 'category' | 'entry';

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  category?: MemoryCategory;
  x: number;
  y: number;
  confidence?: number;
  source?: MemoryEntry['source'];
  entry?: MemoryEntry;
  updatedAt?: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  strength: number;
}

export interface MemoryGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  updatedAt: string;
}

const CATEGORY_META: Record<MemoryCategory, { label: string; color: string }> = {
  preference: { label: 'Preferences', color: '#16A34A' },
  dietary: { label: 'Dietary', color: '#059669' },
  store: { label: 'Stores', color: '#0D9488' },
  budget: { label: 'Budget', color: '#15803D' },
  location: { label: 'Location', color: '#14532D' },
  dish: { label: 'Dishes', color: '#22C55E' },
  avoid: { label: 'Avoids', color: '#DC2626' },
  fact: { label: 'Facts', color: '#64748B' },
  meal_role: { label: 'Meal roles', color: '#CA8A04' },
};

export { CATEGORY_META };

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** Build a layered neural-style graph from flat memory storage. */
export function buildMemoryGraph(memory: UserMemory, width = 720, height = 520): MemoryGraph {
  const cx = width / 2;
  const cy = height / 2;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  nodes.push({
    id: 'hub-user',
    label: 'You',
    type: 'hub',
    x: cx,
    y: cy,
    updatedAt: memory.updatedAt,
  });

  const coreItems: { id: string; label: string; category: MemoryCategory }[] = [
    { id: 'core-budget', label: `LKR ${memory.defaultBudgetLkr.toLocaleString()}`, category: 'budget' },
    { id: 'core-location', label: memory.homeArea || 'Colombo', category: 'location' },
    ...memory.preferredStores.map((s, i) => ({
      id: `core-store-${i}`,
      label: s,
      category: 'store' as MemoryCategory,
    })),
  ];

  const coreCount = coreItems.length;
  coreItems.forEach((item, i) => {
    const angle = (Math.PI * 2 * i) / Math.max(coreCount, 1) - Math.PI / 2;
    const pos = polar(cx, cy, 95, angle);
    nodes.push({
      id: item.id,
      label: item.label,
      type: 'core',
      category: item.category,
      x: pos.x,
      y: pos.y,
      confidence: 1,
      source: 'user',
      updatedAt: memory.updatedAt,
    });
    edges.push({ id: `e-${item.id}`, from: 'hub-user', to: item.id, strength: 0.9 });
  });

  const grouped = memory.entries.reduce<Record<string, MemoryEntry[]>>((acc, e) => {
    (acc[e.category] ??= []).push(e);
    return acc;
  }, {});

  const categories = (Object.keys(grouped) as MemoryCategory[]).filter((c) => grouped[c]?.length);
  const catCount = categories.length;

  categories.forEach((cat, ci) => {
    const catAngle = (Math.PI * 2 * ci) / Math.max(catCount, 1) - Math.PI / 2;
    const catPos = polar(cx, cy, 175, catAngle);
    const catId = `cat-${cat}`;
    const meta = CATEGORY_META[cat];

    nodes.push({
      id: catId,
      label: meta.label,
      type: 'category',
      category: cat,
      x: catPos.x,
      y: catPos.y,
      confidence: 0.85,
      updatedAt: memory.updatedAt,
    });
    edges.push({ id: `e-${catId}`, from: 'hub-user', to: catId, strength: 0.7 });

    const entries = grouped[cat].slice(0, 8);
    entries.forEach((entry, ei) => {
      const spread = Math.min(0.55, entries.length * 0.08);
      const entryAngle = catAngle + (ei - (entries.length - 1) / 2) * spread;
      const entryPos = polar(cx, cy, 255, entryAngle);
      const nodeId = `entry-${entry.id}`;

      nodes.push({
        id: nodeId,
        label: entry.value.length > 28 ? entry.value.slice(0, 26) + '…' : entry.value,
        type: 'entry',
        category: cat,
        x: entryPos.x,
        y: entryPos.y,
        confidence: entry.confidence,
        source: entry.source,
        entry,
        updatedAt: entry.updatedAt,
      });
      edges.push({
        id: `e-${nodeId}`,
        from: catId,
        to: nodeId,
        strength: entry.confidence,
      });
    });
  });

  return { nodes, edges, updatedAt: memory.updatedAt };
}

export function isRecentlyUpdated(iso: string | undefined, withinMs = 45000): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < withinMs;
}
