'use client';

import { useState } from 'react';
import type { ClarificationField, ClarificationFieldId } from '@/lib/query-clarification';

interface ClarificationCardProps {
  fields: ClarificationField[];
  answers: Partial<Record<ClarificationFieldId, number>>;
  onAnswer: (fieldId: ClarificationFieldId, value: number) => void;
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
  const allAnswered = fields.every((f) => typeof answers[f.id] === 'number' && (answers[f.id] as number) > 0);

  return (
    <div className="flex justify-start w-full">
      <div className="max-w-[96%] lg:max-w-[90%] w-full rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 space-y-4 rounded-bl-md">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-wider text-[#15803D]/70 font-bold">Need a few details</p>
          <p className="text-sm text-[#14532D] mt-1">Pick an option or enter your own value to continue.</p>
        </div>

        {fields.map((field) => {
          const selected = answers[field.id];
          const draft = customDrafts[field.id] ?? '';
          return (
            <div key={field.id} className="space-y-2">
              <p className="text-sm font-semibold text-[#14532D]">{field.question}</p>
              <div className="flex flex-wrap gap-2">
                {field.options.map((opt) => {
                  const active = selected === opt.value;
                  return (
                    <button
                      key={`${field.id}-${opt.value}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setCustomDrafts((d) => ({ ...d, [field.id]: '' }));
                        onAnswer(field.id, opt.value);
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
              {field.allowCustom && (
                <div className="flex items-center gap-2">
                  {field.unit && (
                    <span className="text-[10px] font-mono text-[#15803D] shrink-0">{field.unit}</span>
                  )}
                  <input
                    type="number"
                    min={1}
                    disabled={disabled}
                    value={draft}
                    placeholder={field.customPlaceholder}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setCustomDrafts((d) => ({ ...d, [field.id]: raw }));
                      const n = parseInt(raw, 10);
                      if (n > 0) onAnswer(field.id, n);
                    }}
                    className="w-28 text-xs border border-[#BBF7D0] rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                  />
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          disabled={disabled || !allAnswered}
          onClick={onConfirm}
          className="w-full sm:w-auto bg-[#16A34A] hover:bg-[#14532D] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          Continue planning
        </button>
      </div>
    </div>
  );
}
