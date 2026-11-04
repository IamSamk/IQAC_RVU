"use client";

import clsx from "clsx";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function PageTitle({ eyebrow, title, subtitle, actions }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div className="min-w-0 flex-1 basis-80">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="font-display text-[2.1rem] font-semibold leading-[1.1] tracking-tight text-ink-950 sm:text-[2.6rem]">{title}</h1>
        {subtitle && <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const STATUS = {
  IN_PROGRESS: { label: "Live now", cls: "bg-critical-100 text-critical-700", dot: "bg-critical-600 animate-live-dot" },
  SCHEDULED: { label: "Scheduled", cls: "bg-ink-100 text-ink-700", dot: "bg-ink-400" },
  COMPLETED: { label: "Done", cls: "bg-success-100 text-success-700", dot: "bg-success-500" },
  RECALIBRATED: { label: "Re-planned", cls: "bg-gold-100 text-gold-700", dot: "bg-gold-500" },
} as const;

export function StatusPill({ status }: { status: keyof typeof STATUS | string }) {
  const s = STATUS[status as keyof typeof STATUS] ?? STATUS.SCHEDULED;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", s.cls)}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function ProgressBar({ value, max, tone = "brand" }: { value: number; max: number; tone?: "brand" | "success" | "gold" }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={clsx("h-full rounded-full transition-all duration-500", tone === "brand" && "bg-brand-600", tone === "success" && "bg-success-500", tone === "gold" && "bg-gold-500")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">{icon}</span>
      <h3 className="mt-5 font-display text-2xl font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">{body}</p>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="panel flex flex-wrap items-center gap-3 border-gold-100 bg-gold-50 px-5 py-4 text-sm text-gold-700">
      <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && (
        <button type="button" className="btn-outline py-1.5" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="panel space-y-3 p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-9 w-32" />
        </div>
      ))}
    </div>
  );
}

export function Prose({ source, className }: { source: string; className?: string }) {
  return (
    <div
      className={clsx(
        "prose prose-sm max-w-none prose-headings:font-display prose-headings:font-semibold prose-headings:text-ink-950 prose-h1:text-2xl prose-h2:mt-6 prose-h2:text-lg prose-p:text-ink-700 prose-li:text-ink-700 prose-strong:text-ink-900 prose-code:rounded prose-code:bg-ink-50 prose-code:px-1 prose-code:before:content-none prose-code:after:content-none",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}

export function formatDay(iso: string) {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function firstName(full: string) {
  const parts = full.replace(/^(Prof|Dr|Mr|Ms)\.?\s+/i, "").split(/\s+/);
  return full.startsWith("Prof") || full.startsWith("Dr") ? full : parts[0];
}
