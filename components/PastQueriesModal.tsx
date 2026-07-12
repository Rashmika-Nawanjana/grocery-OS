'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { QuerySession } from '@/lib/chat-sessions';
import { formatSessionDate, getPastSessions } from '@/lib/chat-sessions';

const PAGE_SIZE = 15;

interface PastQueriesModalProps {
  open: boolean;
  onClose: () => void;
  sessions: QuerySession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

export default function PastQueriesModal({
  open,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
}: PastQueriesModalProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pastSessions = getPastSessions(sessions);
  const visibleSessions = pastSessions.slice(0, visibleCount);
  const hasMore = visibleCount < pastSessions.length;

  useEffect(() => {
    if (open) setVisibleCount(PAGE_SIZE);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    window.setTimeout(() => {
      setVisibleCount((c) => Math.min(c + PAGE_SIZE, pastSessions.length));
      setLoadingMore(false);
    }, 200);
  }, [hasMore, loadingMore, pastSessions.length]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) loadMore();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Past queries">
      <button type="button" className="absolute inset-0 bg-[#14532D]/40 backdrop-blur-sm" onClick={onClose} aria-label="Close" />

      <div className="relative w-full max-w-md bg-white border border-[#BBF7D0] rounded-2xl shadow-xl flex flex-col max-h-[min(80vh,560px)] animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#BBF7D0] shrink-0">
          <div>
            <h2 className="font-serif font-bold text-[#14532D]">Past Queries</h2>
            <p className="text-[10px] text-[#15803D]/70 mt-0.5">{pastSessions.length} conversation{pastSessions.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F0FDF4] text-[#15803D]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
          {pastSessions.length === 0 ? (
            <p className="text-sm text-[#15803D]/70 text-center py-12 px-4">No past queries yet. Send a message to start one.</p>
          ) : (
            <ul className="space-y-1">
              {visibleSessions.map((s) => {
                const isActive = activeSessionId === s.id;
                return (
                  <li key={s.id} className="group flex items-stretch gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSession(s.id);
                        onClose();
                      }}
                      className={`flex-1 text-left px-3 py-2.5 rounded-xl text-[11px] transition-all min-w-0 ${
                        isActive
                          ? 'bg-[#C6F6D5] text-[#14532D] font-semibold border border-[#BBF7D0]'
                          : 'text-[#2D332D]/80 hover:bg-[#EAF7EE]'
                      }`}
                    >
                      <span className="block truncate">{s.title}</span>
                      <span className="text-[9px] font-mono opacity-50">
                        {formatSessionDate(s.updatedAt)} · {s.turns.length} prompt{s.turns.length !== 1 ? 's' : ''}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(s.id);
                      }}
                      className="shrink-0 px-2 rounded-xl text-stone-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                      aria-label={`Delete ${s.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {loadingMore && (
            <p className="text-center text-[10px] text-[#15803D]/60 py-3 animate-pulse">Loading more…</p>
          )}
          {hasMore && !loadingMore && visibleSessions.length > 0 && (
            <p className="text-center text-[10px] text-[#15803D]/50 py-3">Scroll for more</p>
          )}
        </div>
      </div>
    </div>
  );
}
