"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader, StatTile } from "@/components/ui/primitives";
import { api, useResource } from "@/lib/api";
import { fallbackCompliance } from "@/lib/fallback/compliance";
import { CO_PO_MAP } from "@/lib/fallback/ocr";
import { formatDateTime } from "@/lib/format";

const titleCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function AdminErp() {
  const { data } = useResource(api.getCompliance, fallbackCompliance);

  return (
    <>
      <PageHeader title="IQAC Compliance" description="How each course is progressing, how it is assessed, and who can do what." />

      <div className="space-y-4">
        <Card>
          <CardHeader title="Course compliance" description="Pacing and verification status for every offering this academic year." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-100 text-xs text-slate-700">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Course</th>
                  <th scope="col" className="px-3 py-2 font-medium">L:T:P</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Sessions done</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Topics covered</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Sheets verified</th>
                  <th scope="col" className="px-3 py-2 font-medium">Pacing</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {data.offerings.map((offering) => {
                  const behind = offering.net_pacing_delta_mins < 0;
                  return (
                    <tr key={offering.offering_id} className="border-t border-slate-100">
                      <th scope="row" className="px-3 py-2 font-medium">
                        {offering.course_code}
                        <span className="block text-xs font-normal text-slate-600">
                          {offering.course_title} · {offering.faculty}
                        </span>
                      </th>
                      <td className="px-3 py-2">{offering.ltp}</td>
                      <td className="px-3 py-2 text-right">
                        {offering.sessions_completed}/{offering.sessions_total}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {offering.chunks_covered}/{offering.chunks_total}
                      </td>
                      <td className="px-3 py-2 text-right">{offering.total_sheets ? `${offering.approved_sheets}/${offering.total_sheets}` : "None yet"}</td>
                      <td className="px-3 py-2">
                        {behind ? (
                          <Badge tone="warning">
                            <AlertTriangle className="h-3 w-3" aria-hidden />
                            {Math.abs(offering.net_pacing_delta_mins)} min behind
                          </Badge>
                        ) : (
                          <Badge tone="success">
                            <CheckCircle2 className="h-3 w-3" aria-hidden />
                            On track
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="RBAC matrix" description="Roles from highest to lowest rank, with what each is allowed to do." />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs text-slate-700">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Role</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Rank</th>
                    <th scope="col" className="px-3 py-2 font-medium">Permissions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.roles.map((role) => (
                    <tr key={role.role_code} className="border-t border-slate-100">
                      <th scope="row" className="whitespace-nowrap px-3 py-2 font-mono text-xs font-medium">{role.role_code}</th>
                      <td className="px-3 py-2 text-right tabular-nums">{role.hierarchy_rank}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {role.permissions.map((permission) => (
                            <Badge key={permission}>{permission}</Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Assessment rubric" description="The configuration every generated assessment must follow." />
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Continuous internal" value={`${data.rubric.cie_weight}%`} />
              <StatTile label="Semester end" value={`${data.rubric.see_weight}%`} />
            </div>
            <h3 className="mt-4 text-sm font-medium">Bloom&apos;s distribution</h3>
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(data.rubric.blooms_distribution).map(([level, share]) => (
                <li key={level} className="rounded-lg bg-slate-50 p-2 text-sm">
                  <span className="block text-xs text-slate-600">{titleCase(level)}</span>
                  <span className="font-semibold">{share}%</span>
                </li>
              ))}
            </ul>
            <h3 className="mt-4 text-sm font-medium">Sample CO-PO mapping</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {CO_PO_MAP.map((row) => (
                <li key={row.co} className="flex justify-between gap-3">
                  <span className="text-slate-700">
                    <span className="font-medium text-slate-900">{row.co}</span> {row.outcome}
                  </span>
                  <span className="shrink-0 text-slate-600">{row.pos}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card>
          <CardHeader title="Recent audit log" />
          <ul className="space-y-2">
            {data.audit.map((entry) => (
              <li key={entry.log_id} className="border-l-2 border-brand-600 pl-3 text-sm">
                <p className="font-medium">{entry.action_type}</p>
                <p className="break-words text-slate-700">{entry.detail}</p>
                <p className="text-xs text-slate-600">
                  {entry.actor} · {formatDateTime(entry.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
