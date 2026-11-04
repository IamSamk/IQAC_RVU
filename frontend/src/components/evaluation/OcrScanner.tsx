"use client";

import clsx from "clsx";
import { AlertTriangle, CheckCircle2, FileUp, RefreshCw, ScanLine } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { Badge, Card, CardHeader, DataTableDetails, Notice } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { CHART } from "@/lib/chart";
import { ATTAINMENT_TARGET, CO_PO_MAP, SYNCED_COHORT, fallbackEvaluation } from "@/lib/fallback/ocr";
import { percent } from "@/lib/format";
import type { DataSource, OcrCell, OcrEvaluation } from "@/types";

const CONFIDENCE_THRESHOLD = 0.95;

function ScannedSheet({ evaluation, imageUrl }: { evaluation: OcrEvaluation; imageUrl: string | null }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={`Uploaded mark sheet for ${evaluation.usn}`} className="max-h-[420px] w-full rounded-lg border border-slate-300 object-contain" />;
  }
  return (
    <figure aria-label={`Sample scanned mark grid for ${evaluation.usn}`} className="rounded-lg border border-slate-300 bg-[#FBF8EF] p-4 font-mono text-sm text-slate-800">
      <div className="flex flex-wrap justify-between gap-2 border-b border-dashed border-slate-400 pb-2 text-xs">
        <span>USN: {evaluation.usn}</span>
        <span>{evaluation.exam_name}</span>
      </div>
      <table className="mt-3 w-full border-collapse text-center">
        <thead>
          <tr>
            <th scope="col" className="border border-slate-400 p-1.5 font-medium">Q</th>
            <th scope="col" className="border border-slate-400 p-1.5 font-medium">Marks</th>
            <th scope="col" className="border border-slate-400 p-1.5 font-medium">Max</th>
          </tr>
        </thead>
        <tbody>
          {evaluation.cells.map((cell) => {
            const smudged = cell.conf < CONFIDENCE_THRESHOLD;
            return (
              <tr key={cell.question}>
                <td className="border border-slate-400 p-1.5">{cell.question.replace("Q", "")}</td>
                <td className="border border-slate-400 p-1.5">
                  <span className={clsx("inline-block -rotate-3 text-lg italic text-blue-900", smudged && "opacity-60 blur-[0.6px]")}>{cell.marks}</span>
                </td>
                <td className="border border-slate-400 p-1.5">{cell.max}</td>
              </tr>
            );
          })}
          <tr>
            <th scope="row" className="border border-slate-400 p-1.5 font-medium">Total</th>
            <td className="border border-slate-400 p-1.5">
              <span className="inline-block -rotate-3 text-lg italic text-blue-900">{evaluation.written_total}</span>
            </td>
            <td className="border border-slate-400 p-1.5">{evaluation.cells.reduce((sum, cell) => sum + cell.max, 0)}</td>
          </tr>
        </tbody>
      </table>
      <figcaption className="mt-2 text-xs text-slate-600">Sample sheet for the demo</figcaption>
    </figure>
  );
}

function attainment(cells: OcrCell[], includeSheet: boolean) {
  return Object.entries(SYNCED_COHORT).map(([co, base]) => {
    const sheetCells = includeSheet ? cells.filter((cell) => cell.co === co) : [];
    const earned = base.earned + sheetCells.reduce((sum, cell) => sum + cell.marks, 0);
    const max = base.max + sheetCells.reduce((sum, cell) => sum + cell.max, 0);
    return { co, value: Math.round((earned / max) * 1000) / 10, before: Math.round((base.earned / base.max) * 1000) / 10 };
  });
}

export function OcrScanner({ canApprove }: { canApprove: boolean }) {
  const [evaluation, setEvaluation] = useState<OcrEvaluation>(fallbackEvaluation);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [synced, setSynced] = useState<DataSource | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  const cells = useMemo(
    () => evaluation.cells.map((cell) => ({ ...cell, marks: marks[cell.question] ?? cell.marks })),
    [evaluation, marks],
  );
  const flagged = cells.filter((cell) => cell.conf < CONFIDENCE_THRESHOLD);
  const total = cells.reduce((sum, cell) => sum + cell.marks, 0);
  const totalMatches = total === evaluation.written_total;
  const invalidCell = cells.some((cell) => !Number.isFinite(cell.marks) || cell.marks < 0 || cell.marks > cell.max);
  const chart = useMemo(() => attainment(cells, synced !== null), [cells, synced]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setScanning(true);
    setScanNotice(null);
    const response = await api.evaluateSheet(file);
    setScanning(false);
    setMarks({});
    setSynced(null);
    setEvaluation(response.data);
    if (response.source === "live") {
      setImageUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(file);
      });
    } else {
      setImageUrl(null);
      setScanNotice(`The OCR service is offline, so ${file.name} was not read. Showing the sample sheet instead.`);
    }
  };

  const verify = async () => {
    setSyncing(true);
    const response = await api.approveAndSync(evaluation.eval_id, { marks: Object.fromEntries(cells.map((cell) => [cell.question, cell.marks])) });
    setSynced(response.source);
    setSyncing(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="OCR mark-sheet scanner"
          description={`Any cell below ${percent(CONFIDENCE_THRESHOLD)} confidence needs a faculty check before marks reach the spreadsheet.`}
          action={
            <label className={clsx("btn-outline", (scanning || !canApprove) && "cursor-not-allowed opacity-50", !scanning && canApprove && "cursor-pointer")}>
              {scanning ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
              {scanning ? "Scanning" : "Upload a sheet"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={scanning || !canApprove}
                onChange={(event) => {
                  upload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          }
        />
        {scanNotice && (
          <div className="mb-3">
            <Notice tone="warning" icon={<AlertTriangle className="h-4 w-4" aria-hidden />}>
              {scanNotice}
            </Notice>
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <ScanLine className="h-4 w-4 text-slate-600" aria-hidden />
              Scanned sheet
            </h3>
            <ScannedSheet evaluation={evaluation} imageUrl={imageUrl} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Extracted marks</h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs text-slate-700">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Question</th>
                    <th scope="col" className="px-3 py-2 font-medium">Marks</th>
                    <th scope="col" className="px-3 py-2 font-medium">Confidence</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {cells.map((cell) => {
                    const needsReview = cell.conf < CONFIDENCE_THRESHOLD;
                    return (
                      <tr key={cell.question} className={clsx("border-t border-slate-100", needsReview && !synced && "bg-gold-100")}>
                        <th scope="row" className="px-3 py-2 font-medium">
                          {cell.question}
                        </th>
                        <td className="px-3 py-2">
                          {needsReview && !synced && canApprove ? (
                            <label className="inline-flex items-center gap-1">
                              <span className="sr-only">Marks for {cell.question}</span>
                              <input
                                type="number"
                                min={0}
                                max={cell.max}
                                value={cell.marks}
                                onChange={(event) => setMarks((current) => ({ ...current, [cell.question]: Number(event.target.value) }))}
                                className="field w-16 px-2 py-1"
                              />
                              /{cell.max}
                            </label>
                          ) : (
                            `${cell.marks}/${cell.max}`
                          )}
                        </td>
                        <td className="px-3 py-2">{percent(cell.conf)}</td>
                        <td className="px-3 py-2">
                          {needsReview && !synced ? (
                            <Badge tone="warning">
                              <AlertTriangle className="h-3 w-3" aria-hidden />
                              Requires Faculty Verification
                            </Badge>
                          ) : (
                            <Badge tone="success">
                              <CheckCircle2 className="h-3 w-3" aria-hidden />
                              {needsReview ? "Verified" : "Accepted"}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className={clsx("mt-2 flex items-center gap-1.5 text-sm", totalMatches ? "text-success-700" : "text-gold-700")}>
              {totalMatches ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
              Sum of marks {total} {totalMatches ? "matches" : "does not match"} the written total {evaluation.written_total}.
            </p>

            {invalidCell && <p role="alert" className="mt-1 text-sm text-critical-700">Marks must be between 0 and the maximum for that question.</p>}

            {synced ? (
              <div className="mt-3">
                <Notice tone="success" icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}>
                  {synced === "live"
                    ? "Marks verified and synced to the evaluation sheet."
                    : "Marks verified. Attainment updated in this demo; nothing was written to Google Sheets because the backend is offline."}
                </Notice>
              </div>
            ) : (
              <>
                <button type="button" className="btn-primary mt-3 w-full" disabled={syncing || invalidCell || !canApprove} onClick={verify}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {syncing ? "Syncing" : "Verify & Sync to Google Sheets"}
                </button>
                {!canApprove && <p className="mt-1 text-xs text-slate-600">Only the course faculty can verify marks. IQAC has read access.</p>}
                {canApprove && flagged.length > 0 && <p className="mt-1 text-xs text-slate-600">Check the {flagged.length} amber cell against the scan before syncing.</p>}
              </>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="CO attainment" description={`Share of available marks earned per course outcome across synced sheets. The target is ${ATTAINMENT_TARGET}%.`} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 22, right: 12, bottom: 0, left: -14 }} barCategoryGap="40%">
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="co" tick={{ fill: CHART.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: CHART.grid }} />
                  <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} unit="%" tick={{ fill: CHART.axis, fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "#F1F5F9" }} content={<ChartTooltip labelPrefix="" />} />
                  <ReferenceLine y={ATTAINMENT_TARGET} stroke={CHART.ink} strokeWidth={1} label={{ value: `Target ${ATTAINMENT_TARGET}%`, position: "insideTopRight", fill: CHART.ink, fontSize: 11 }} />
                  <Bar dataKey="value" name="Attainment" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {chart.map((row) => (
                      <Cell key={row.co} fill={CHART.indigo} />
                    ))}
                    <LabelList dataKey="value" position="top" formatter={(value: number) => `${value}%`} style={{ fill: CHART.ink, fontSize: 12, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <DataTableDetails
              columns={["Outcome", "Before this sheet", "Current", "Against target"]}
              rows={chart.map((row) => [row.co, `${row.before}%`, `${row.value}%`, row.value >= ATTAINMENT_TARGET ? "Met" : "Below"])}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="mb-2 text-left text-sm font-medium">CO-PO mapping</caption>
              <thead className="bg-slate-100 text-xs text-slate-700">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">CO</th>
                  <th scope="col" className="px-3 py-2 font-medium">Outcome</th>
                  <th scope="col" className="px-3 py-2 font-medium">POs</th>
                </tr>
              </thead>
              <tbody>
                {CO_PO_MAP.map((row) => (
                  <tr key={row.co} className="border-t border-slate-100">
                    <th scope="row" className="px-3 py-2 font-medium">{row.co}</th>
                    <td className="px-3 py-2 text-slate-700">{row.outcome}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">{row.pos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
