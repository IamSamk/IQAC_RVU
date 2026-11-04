import type { ReactNode } from "react";

/** Inline **bold** and *italic*, rendered as elements so nothing is injected as HTML. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g).map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (/^(\*[^*]+\*|_[^_]+_)$/.test(part)) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

/** Covers the small Markdown subset used in generated class notes. */
export function Markdown({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-700">
      {blocks.map((block, index) => {
        if (/^-{3,}$/.test(block)) return <hr key={index} className="border-slate-200" />;
        const heading = block.match(/^(#{1,4})\s+(.*)$/);
        if (heading) return <h4 key={index} className="font-semibold text-slate-900">{inline(heading[2])}</h4>;
        if (block.startsWith(">")) {
          return (
            <blockquote key={index} className="border-l-2 border-gold-500 pl-3">
              {inline(block.replace(/^>\s?/, ""))}
            </blockquote>
          );
        }
        return <p key={index} className="break-words">{inline(block)}</p>;
      })}
    </div>
  );
}
