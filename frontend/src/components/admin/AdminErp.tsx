"use client";

import { AlertTriangle, Check, CheckCircle2, Minus } from "lucide-react";
import { Badge, Card, CardHeader, Notice, PageHeader, StatTile } from "@/components/ui/primitives";
import { fallbackAudit } from "@/lib/fallback/copilot";
import { CO_PO_MAP } from "@/lib/fallback/ocr";
import { formatDateTime } from "@/lib/format";

const PERMISSIONS = ["View reports", "Edit rubrics", "Override pacing", "Approve marks", "Approve PYQ map", "Study tools"];

const RBAC: { role: string; rank: number; allowed: boolean[] }[] = [
  { role: "IQAC_ADMIN", rank: 100, allowed: [true, true, false, false, true, false] },
  { role: "DEAN", rank: 90, allowed: [true, true, false, false, true, false] },
  { role: "HOD", rank: 80, allowed: [true, false, true, false, true, false] },
  { role: "COURSE_LEAD", rank: 60, allowed: [true, false, true, true, true, false] },
  { role: "FACULTY", rank: 50, allowed: [true, false, true, true, false, false] },
  { role: "TA", rank: 30, allowed: [false, false, false, false, false, true] },
  { role: "ADMIN_STAFF", rank: 20, allowed: [true, false, false, false, false, false] },
  { role: "STUDENT", rank: 10, allowed: [false, false, false, false, false, true] },
];

const BLOOMS = [
  { level: "Understand", share: 25 },
  { level: "Apply", share: 40 },
  { level: "Analyze", share: 25 },
  { level: "Create", share: 10 },
];

const DEPARTMENTS = [
  { code: "SOCSE", name: "Computer Science & Engineering", coverage: 92, mapped: 100, pending: 1 },
  { code: "SODI", name: "Design & Innovation", coverage: 88, mapped: 96, pending: 2 },
  { code: "SOEB", name: "Economics & Business", coverage: 74, mapped: 83, pending: 6 },
];

const COVERAGE_TARGET = 80;

export function AdminErp() {
  return (
    <>
      <PageHeader
        title="IQAC Compliance"
        description="Who can do what, how each course is assessed, and which departments need attention."
        action={<Badge tone="warning">Demo data</Badge>}
      />

      <div className="space-y-4">
        <Card>
          <CardHeader title="Department compliance" description={`Syllabus coverage target is ${COVERAGE_TARGET}%.`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-100 text-xs text-slate-700">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Department</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Syllabus coverage</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">COs mapped to POs</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Pending approvals</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {DEPARTMENTS.map((department) => {
                  const onTrack = department.coverage >= COVERAGE_TARGET;
                  return (
                    <tr key={department.code} className="border-t border-slate-100">
                      <th scope="row" className="px-3 py-2 font-medium">
                        {department.code}
                        <span className="block text-xs font-normal text-slate-600">{department.name}</span>
                      </th>
                      <td className="px-3 py-2 text-right">{department.coverage}%</td>
                      <td className="px-3 py-2 text-right">{department.mapped}%</td>
                      <td className="px-3 py-2 text-right">{department.pending}</td>
                      <td className="px-3 py-2">
                        {onTrack ? (
                          <Badge tone="success">
                            <CheckCircle2 className="h-3 w-3" aria-hidden />
                            On track
                          </Badge>
                        ) : (
                          <Badge tone="warning">
                            <AlertTriangle className="h-3 w-3" aria-hidden />
                            Below target
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
            <CardHeader title="RBAC matrix" description="Roles from highest to lowest rank." />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th scope="col" className="px-2 py-2 font-medium">Role</th>
                    {PERMISSIONS.map((permission) => (
                      <th key={permission} scope="col" className="px-2 py-2 text-center font-medium">
                        {permission}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RBAC.map((row) => (
                    <tr key={row.role} className="border-t border-slate-100">
                      <th scope="row" className="px-2 py-2 font-mono font-medium">{row.role}</th>
                      {row.allowed.map((allowed, index) => (
                        <td key={PERMISSIONS[index]} className="px-2 py-2 text-center">
                          {allowed ? (
                            <Check className="mx-auto h-4 w-4 text-success-700" aria-label="Allowed" />
                          ) : (
                            <Minus className="mx-auto h-4 w-4 text-slate-400" aria-label="Not allowed" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="CS304 assessment rubric" description="The configuration every generated assessment must follow." />
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Continuous internal" value="50%" />
              <StatTile label="Semester end" value="50%" />
            </div>
            <h3 className="mt-4 text-sm font-medium">Bloom&apos;s distribution</h3>
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {BLOOMS.map((item) => (
                <li key={item.level} className="rounded-lg bg-slate-50 p-2 text-sm">
                  <span className="block text-xs text-slate-600">{item.level}</span>
                  <span className="font-semibold">{item.share}%</span>
                </li>
              ))}
            </ul>
            <h3 className="mt-4 text-sm font-medium">CO-PO mapping</h3>
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
            {fallbackAudit.map((entry) => (
              <li key={entry.log_id} className="border-l-2 border-brand-600 pl-3 text-sm">
                <p className="font-medium">{entry.action_type}</p>
                <p className="text-slate-700">{entry.detail}</p>
                <p className="text-xs text-slate-600">
                  {entry.actor} · {formatDateTime(entry.created_at)}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Notice>This view uses seeded data. The shared API contract has no compliance endpoint yet.</Notice>
          </div>
        </Card>
      </div>
    </>
  );
}
