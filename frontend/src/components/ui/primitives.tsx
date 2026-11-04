"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={clsx("panel p-5 sm:p-6", className)}>{children}</section>;
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 basis-64">
        <h2 className="text-[15px] font-semibold text-ink-950">{title}</h2>
        {description && <p className="mt-1 text-sm leading-relaxed text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1 basis-72">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-950 sm:text-[2.35rem] sm:leading-tight">{title}</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

export type Tone = "neutral" | "brand" | "success" | "warning" | "critical" | "teal";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  brand: "bg-brand-100 text-brand-700",
  success: "bg-success-100 text-success-700",
  warning: "bg-gold-100 text-gold-700",
  critical: "bg-critical-100 text-critical-700",
  teal: "bg-teal-100 text-teal-700",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-3.5">
      <div className="text-xs font-medium text-ink-500">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-ink-950">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-600">{hint}</div>}
    </div>
  );
}

const NOTICE_TONES = {
  success: "border-emerald-200 bg-emerald-50 text-success-700",
  warning: "border-amber-200 bg-gold-50 text-gold-700",
  info: "border-brand-100 bg-brand-50 text-brand-700",
};

export function Notice({
  tone = "info",
  icon,
  children,
}: {
  tone?: keyof typeof NOTICE_TONES;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div role="status" className={clsx("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", NOTICE_TONES[tone])}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Built on the native dialog element, which handles focus trapping and Escape. */
export function Dialog({
  open,
  onClose,
  title,
  variant = "center",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  variant?: "center" | "side";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={clsx(
        "bg-white p-0 text-ink-900 shadow-lift",
        variant === "center" && "m-auto w-[calc(100%-2rem)] max-w-xl rounded-3xl",
        variant === "side" &&
          "my-0 ml-auto mr-0 h-dvh max-h-dvh w-full max-w-lg rounded-none",
      )}
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-6 py-4">
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            <button type="button" aria-label="Close" onClick={onClose} className="btn px-2 text-ink-500 hover:bg-ink-100">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function DataTableDetails({
  summary = "View data table",
  columns,
  rows,
}: {
  summary?: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="mt-3 text-sm">
      <summary className="font-medium text-brand-700">{summary}</summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-100 text-slate-700">
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col" className="px-3 py-2 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-slate-100">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-1.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
