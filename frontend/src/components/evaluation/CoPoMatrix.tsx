"use client";

import clsx from "clsx";
import { api, useResource } from "@/lib/api";
import { fallbackCoPo } from "@/lib/fallback/ocr";

const CELL = ["bg-slate-50 text-slate-400", "bg-brand-50 text-brand-700", "bg-brand-100 text-brand-700", "bg-brand-600 text-white"];

/** CO x PO correlation matrix (0-3) derived by the backend from the approved syllabus. */
export function CoPoMatrix({ compact = false }: { compact?: boolean }) {
  const { data, source } = useResource(api.getCoPo, fallbackCoPo);
  const pos = data.program_outcomes.map((p) => p.po);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="mb-2 text-left text-sm font-medium">
          {data.course_code} CO-PO mapping
          <span className="ml-2 text-xs font-normal text-slate-600">
            {source === "live" ? "derived from the approved syllabus (3 strong, 2 moderate, 1 weak)" : "offline copy"}
          </span>
        </caption>
        <thead className="bg-slate-100 text-xs text-slate-700">
          <tr>
            <th scope="col" className="px-2 py-2 font-medium">CO</th>
            {!compact && <th scope="col" className="px-2 py-2 font-medium">Outcome</th>}
            {data.program_outcomes.map((p) => (
              <th key={p.po} scope="col" className="px-2 py-2 text-center font-medium" title={p.name}>
                {p.po}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.co} className="border-t border-slate-100">
              <th scope="row" className="px-2 py-2 font-medium" title={compact ? row.outcome : undefined}>
                {row.co}
              </th>
              {!compact && <td className="px-2 py-2 text-slate-700">{row.outcome}</td>}
              {pos.map((po) => {
                const v = row.correlations[po] ?? 0;
                return (
                  <td key={po} className="px-1 py-1 text-center">
                    <span className={clsx("inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold", CELL[v])}>{v || "–"}</span>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t-2 border-slate-200">
            <th scope="row" className="px-2 py-2 text-xs font-medium text-slate-700" colSpan={compact ? 1 : 2}>
              PO attainment (0–3)
            </th>
            {data.po_attainment.map((p) => (
              <td key={p.po} className="px-1 py-2 text-center text-xs font-semibold text-slate-800">
                {p.attainment ?? "–"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-600">{data.program_outcomes.map((p) => `${p.po} ${p.name}`).join(" · ")}</p>
    </div>
  );
}
