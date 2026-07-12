'use client';

import { CheckCircle2, Lightbulb, Target } from 'lucide-react';

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="font-semibold text-[#14532D]">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const STEP_PREFIX = /^(Firstly|Secondly|Thirdly|Fourthly|Finally|\d+\.)[\s,:]*/i;

function splitSteps(paragraphs: string[]) {
  const steps: string[] = [];
  const other: string[] = [];
  for (const p of paragraphs) {
    if (STEP_PREFIX.test(p.trim())) steps.push(p.trim());
    else other.push(p.trim());
  }
  return { steps, other };
}

function stepLabel(index: number) {
  return String(index + 1);
}

function stepBody(text: string) {
  return text.replace(STEP_PREFIX, '').trim();
}

function splitSummaryPoints(summary: string): string[] {
  const lines = summary.split('\n').map((l) => l.trim()).filter(Boolean);
  const bullets = lines
    .filter((l) => /^[-•*]\s+/.test(l) || /^\d+\.\s+/.test(l))
    .map((l) => l.replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, '').trim());
  if (bullets.length >= 2) return bullets;

  const sentences = summary
    .replace(/\*\*/g, '')
    .split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  if (sentences.length >= 2) return sentences;

  return [summary];
}

function parseAnswerBlocks(answer: string) {
  const blocks = answer
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!blocks.length) return { summary: '', rest: [] as string[] };

  let summary = blocks[0];
  let rest = blocks.slice(1);

  const stepSplit = summary.split(/\n(?=(?:Firstly|Secondly|Thirdly|Fourthly|Finally|\d+\.)[\s,:])/i);
  if (stepSplit.length > 1) {
    summary = stepSplit[0].trim();
    rest = [...stepSplit.slice(1).map((s) => s.trim()), ...rest];
  }

  return { summary, rest };
}

export default function MiroFishAnswer({ answer }: { answer: string }) {
  const { summary, rest: restBlocks } = parseAnswerBlocks(answer);
  const paragraphs = summary ? [summary, ...restBlocks] : restBlocks;

  if (!paragraphs.length) return null;

  const summaryText = paragraphs[0];
  const rest = paragraphs.slice(1);
  const { steps, other } = splitSteps(rest);

  const recommendation =
    other.find((p) => /^(\*\*)?Recommendation/i.test(p)) ||
    (steps.length === 0 && other.length > 0 ? other[other.length - 1] : null);

  const middle = recommendation ? other.filter((p) => p !== recommendation) : other;

  const summaryPoints = splitSummaryPoints(summaryText);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#BBF7D0] bg-gradient-to-br from-[#F0FDF4] to-white p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-[#16A34A] shrink-0" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#16A34A] font-bold">Executive Summary</p>
        </div>
        <ul className="space-y-2.5">
          {summaryPoints.map((point) => (
            <li key={point} className="flex gap-3 text-sm text-[#14532D] leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#16A34A]" />
              <span>{renderInline(point)}</span>
            </li>
          ))}
        </ul>
      </div>

      {steps.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[#15803D] font-bold px-1">Key Actions</p>
          <div className="grid grid-cols-1 gap-3">
            {steps.map((step, i) => (
              <div
                key={step}
                className="flex gap-4 rounded-2xl border border-[#BBF7D0]/70 bg-[#FBFBFA] p-4 hover:border-[#16A34A]/30 transition-colors"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#16A34A] text-sm font-bold text-white"
                  aria-label={`Step ${i + 1}`}
                >
                  {stepLabel(i)}
                </span>
                <p className="text-sm text-[#14532D] leading-relaxed pt-0.5">{renderInline(stepBody(step))}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {middle.map((block) => (
        <p key={block} className="text-sm text-stone-600 leading-relaxed px-1">
          {renderInline(block)}
        </p>
      ))}

      {recommendation && (
        <div className="rounded-2xl border-2 border-[#16A34A]/30 bg-[#F0FDF4] p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#16A34A]" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-[#16A34A] font-bold">Recommendation</p>
          </div>
          <p className="text-sm text-[#14532D] leading-relaxed font-medium">
            {renderInline(recommendation.replace(/^(\*\*)?Recommendation(\*\*)?:?\s*/i, ''))}
          </p>
        </div>
      )}

      {!steps.length && !recommendation && rest.length > 0 && (
        <div className="space-y-3 px-1">
          {rest.map((block) => (
            <p key={block} className="text-sm text-[#14532D] leading-relaxed">
              {renderInline(block)}
            </p>
          ))}
        </div>
      )}

      {steps.length > 0 && (
        <div className="flex items-center gap-2 pt-1 text-[10px] text-stone-400 font-mono">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />
          <span>Prediction complete — based on scenario simulation</span>
        </div>
      )}
    </div>
  );
}
