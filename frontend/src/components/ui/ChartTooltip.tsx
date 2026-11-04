"use client";

interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

/** Shared tooltip body: series colour sits on the marker, text stays in ink. */
export function ChartTooltip({
  active,
  payload,
  label,
  labelPrefix = "Minute",
  suffix = "%",
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  labelPrefix?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-slate-900">
        {labelPrefix} {label}
      </div>
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} className="flex items-center gap-2 text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} aria-hidden />
          <span>{entry.name}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums text-slate-900">
            {entry.value}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  );
}
