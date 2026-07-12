'use client';

import { ExternalLink, Link2 } from 'lucide-react';
import type { DataSource } from '@/lib/types';
import { sourcesForAgent } from '@/lib/data-sources';

interface AgentSourcesFooterProps {
  sources: DataSource[];
  agentId?: string;
  prompt?: string;
}

const KIND_LABEL: Record<DataSource['kind'], string> = {
  api: 'API',
  database: 'DB',
  catalog: 'Catalog',
  ai: 'AI',
  scrape: 'Web',
};

export default function AgentSourcesFooter({ sources, agentId, prompt }: AgentSourcesFooterProps) {
  const filtered = agentId ? sourcesForAgent(sources, agentId) : sources;
  if (!filtered.length && !prompt) return null;

  return (
    <div className="mt-10 pt-5 border-t border-[#BBF7D0] text-[#2D332D]">
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="h-4 w-4 text-[#16A34A]" />
        <h4 className="text-xs font-mono uppercase tracking-wider font-bold text-[#14532D]">Data sources</h4>
        {prompt && (
          <span className="text-[10px] text-[#15803D]/70 truncate ml-auto max-w-[50%]" title={prompt}>
            Query: {prompt.slice(0, 60)}{prompt.length > 60 ? '…' : ''}
          </span>
        )}
      </div>
      {filtered.length === 0 ? (
        <p className="text-[11px] text-[#15803D]/70">No source links for this agent on the active query.</p>
      ) : (
        <ul className="space-y-1.5 max-h-48 overflow-y-auto">
          {filtered.map((s, i) => (
            <li key={`${s.agentId}-${i}`} className="text-[11px] flex items-start gap-2">
              <span className="shrink-0 font-mono text-[9px] uppercase bg-[#F0FDF4] border border-[#BBF7D0] px-1.5 py-0.5 rounded text-[#15803D]">
                {KIND_LABEL[s.kind]}
              </span>
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#16A34A] hover:underline flex items-center gap-1 min-w-0"
                >
                  <span className="truncate">{s.label}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                <span className="text-[#2D332D]/80">{s.label}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[9px] text-[#15803D]/50 mt-3">
        Prices marked AI or estimate should be verified. PlanGro does not integrate live restaurant delivery APIs.
      </p>
    </div>
  );
}
