'use client';

function parseInterpretation(text: string) {
  const quoted = text.match(/"([^"]+)"/)?.[1];
  const actors = text.match(/mapped (\d+) actor types \(([^)]+)/);
  const relationships = text.match(/(\d+) relationship types/);
  return {
    question: quoted || null,
    actorCount: actors?.[1],
    actorSample: actors?.[2],
    relationshipCount: relationships?.[1],
    raw: text,
  };
}

export default function MiroFishInterpretation({ text }: { text: string }) {
  const parsed = parseInterpretation(text);

  if (!parsed.question && !parsed.actorCount) {
    return <p className="text-sm text-[#14532D] leading-relaxed">{text}</p>;
  }

  return (
    <div className="space-y-3">
      {parsed.question && (
        <p className="text-sm text-[#14532D] font-medium leading-relaxed">&ldquo;{parsed.question}&rdquo;</p>
      )}
      {(parsed.actorCount || parsed.relationshipCount) && (
        <div className="flex flex-wrap gap-2">
          {parsed.actorCount && (
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white border border-[#BBF7D0] text-[#15803D]">
              {parsed.actorCount} actors · {parsed.actorSample?.split(',').slice(0, 3).join(', ')}…
            </span>
          )}
          {parsed.relationshipCount && (
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white border border-[#BBF7D0] text-stone-500">
              {parsed.relationshipCount} relationships mapped
            </span>
          )}
        </div>
      )}
    </div>
  );
}
