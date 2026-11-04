import type { ReactNode } from "react";

/** Inline **bold** and *italic*, rendered as elements so nothing is injected as HTML. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\b_[^_]+_\b)/g).map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (/^(\*[^*]+\*|_[^_]+_)$/.test(part)) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

const BULLET = /^\s*(?:[-*+]|\d+\.)\s+/;

/** Covers the Markdown subset used in generated class notes. */
export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={blocks.length} className="list-disc space-y-1 pl-5">
        {bullets.map((item, index) => (
          <li key={index} className="break-words">
            {inline(item)}
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (BULLET.test(rawLine)) {
      bullets.push(rawLine.replace(BULLET, ""));
      continue;
    }
    flushBullets();
    if (!line) continue;

    const key = blocks.length;
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (/^-{3,}$/.test(line)) blocks.push(<hr key={key} className="border-slate-200" />);
    else if (heading) blocks.push(<h4 key={key} className="font-semibold text-slate-900">{inline(heading[1])}</h4>);
    else if (line.startsWith(">")) blocks.push(<blockquote key={key} className="border-l-2 border-gold-500 pl-3">{inline(line.replace(/^>\s?/, ""))}</blockquote>);
    else blocks.push(<p key={key} className="break-words">{inline(line)}</p>);
  }
  flushBullets();

  return <div className="space-y-2 text-sm leading-relaxed text-slate-700">{blocks}</div>;
}
