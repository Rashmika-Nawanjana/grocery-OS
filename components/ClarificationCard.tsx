'use client';

import { useState } from 'react';
import type {
  ClarificationAnswerValue,
  ClarificationAnswers,
  ClarificationField,
  ClarificationFieldId,
} from '@/lib/query-clarification';

interface ClarificationCardProps {
  fields: ClarificationField[];
  answers: ClarificationAnswers;
  onAnswer: (fieldId: ClarificationFieldId, value: ClarificationAnswerValue) => void;
  onConfirm: () => void;
  disabled?: boolean;
}

export default function ClarificationCard({
  fields,
  answers,
  onAnswer,
  onConfirm,
  disabled,
}: ClarificationCardProps) {
  const [customDrafts, setCustomDrafts] = useState<Partial<Record<ClarificationFieldId, string>>>({});

  // Choices advance when unanswered. Number fields stay visible after a value is
  // typed/selected until Confirm removes them from `fields`.
  const unanswered = fields.find((f) => {
    const v = answers[f.id];
    if (f.kind === 'choice') return typeof v !== 'string' || !v;
    return typeof v !== 'number' || v <= 0;
  });
  const current = unanswered ?? fields.find((f) => f.kind === 'number') ?? null;

  if (!current) return null;

  const selected = answers[current.id];
  const draft = customDrafts[current.id] ?? '';
  const stepIndex = fields.indexOf(current) + 1;
  const numericReady =
    current.kind === 'number' && typeof selected === 'number' && selected > 0;
  const isLast = stepIndex >= fields.length;

  return (
    <div className="flex justify-start w-full">
      <div className="max-w-[96%] lg:max-w-[90%] w-full rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 space-y-4 rounded-bl-md">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wider text-[#15803D]/70 font-bold">
            Need a quick decision
            {fields.length > 1 ? ` · ${stepIndex}/${fields.length}` : ''}
          </p>
          <p className="text-sm text-[#14532D] mt-1">
            {current.kind === 'choice'
              ? 'Tap one option — we will tailor the plan from there.'
              : 'Pick an option or enter your own value to continue.'}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#14532D]">{current.question}</p>
          <div className="flex flex-wrap gap-2">
            {current.options.map((opt) => {
              const active = selected === opt.value;
              return (
                <button
                  key={`${current.id}-${String(opt.value)}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setCustomDrafts((d) => ({ ...d, [current.id]: '' }));
                    onAnswer(current.id, opt.value);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
                    active
                      ? 'bg-[#16A34A] text-white border-[#16A34A]'
                      : 'bg-white text-[#14532D] border-[#BBF7D0] hover:bg-[#DCFCE7]'
                  } disabled:opacity-50`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {current.kind === 'number' && current.allowCustom && (
            <div className="flex items-center gap-2">
              {current.unit && (
                <span className="text-[10px] font-mono text-[#15803D] shrink-0">{current.unit}</span>
              )}
              <input
                type="number"
                min={1}
                disabled={disabled}
                value={draft}
                placeholder={current.customPlaceholder}
                onChange={(e) => {
                  const raw = e.target.value;
                  setCustomDrafts((d) => ({ ...d, [current.id]: raw }));
                  const n = parseInt(raw, 10);
                  if (n > 0) onAnswer(current.id, n);
                }}
                className="w-28 text-xs border border-[#BBF7D0] rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
              />
            </div>
          )}
        </div>

        {current.kind === 'number' && (
          <button
            type="button"
            disabled={disabled || !numericReady}
            onClick={onConfirm}
            className="w-full sm:w-auto bg-[#16A34A] hover:bg-[#14532D] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            {isLast ? 'Continue planning' : 'Next'}
          </button>
        )}
      </div>
    </div>
  );
}
