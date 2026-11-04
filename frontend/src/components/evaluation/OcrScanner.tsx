"use client";

import clsx from "clsx";
import { AlertTriangle, CheckCircle2, FileUp, RefreshCw, ScanLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { Badge, Card, CardHeader, DataTableDetails, Notice } from "@/components/ui/primitives";
import { api, useResource } from "@/lib/api";
import { CHART } from "@/lib/chart";
import { CO_PO_MAP, fallbackAttainment, fallbackEvaluation } from "@/lib/fallback/ocr";
import { percent } from "@/lib/format";
import type { CoAttainment, EvaluationData, OcrCell, OcrEvaluation } from "@/types";

const CONFIDENCE_THRESHOLD = 0.95;
const FALLBACK: EvaluationData = { evaluation: fallbackEvaluation, attainment: fallbackAttainment };

function ScannedSheet({ evaluation, imageUrl }: { evaluation: OcrEvaluation; imageUrl: string | null }) {
  if (imageUrl) {
    // A local object URL, which next/image cannot optimise.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={`Uploaded mark sheet for ${evaluation.usn}`} className="max-h-[440px] w-full rounded-lg border border-slate-300 object-contain" />;
  }
  return (
    <figure aria-label={`Illustration of the scanned mark grid for ${evaluation.usn}`} className="rounded-lg border border-slate-300 bg-[#FBF8EF] p-4 font-mono text-sm text-slate-800">
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
      <figcaption className="mt-2 text-xs text-slate-600">Illustration drawn from the extracted data</figcaption>
    </figure>
  );
}

/** Offline stand-in for the backend's recalculation after a sheet is approved. */
function applyLocally(attainment: CoAttainment, before: OcrCell[], after: OcrCell[]): CoAttainment {
  return {
    ...attainment,
    approved_sheets: Math.min(attainment.total_sheets, attainment.approved_sheets + 1),
    outcomes: attainment.outcomes.map((outcome) => {
      const cells = after.filter((cell) => cell.co === outcome.co);
      const max = cells.reduce((sum, cell) => sum + cell.max, 0);
      const change = cells.reduce((sum, cell) => sum + cell.marks, 0) - before.filter((cell) => cell.co === outcome.co).reduce((sum, cell) => sum + cell.marks, 0);
      if (!max || !outcome.n) return outcome;
      return { ...outcome, avg_pct: Math.round((outcome.avg_pct + ((change / max) * 100) / outcome.n) * 10) / 10 };
    }),
  };
}

export function OcrScanner() {
  const { data, loading } = useResource(api.getEvaluation, FALLBACK);
  const [evaluation, setEvaluation] = useState(data.evaluation);
  const [attainment, setAttainment] = useState(data.attainment);
  const [previous, setPrevious] = useState<CoAttainment | null>(null);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );

  useEffect(() => {
    setEvaluation(data.evaluation);
    setAttainment(data.attainment);
    setPrevious(null);
    setMarks({});
    setSyncMessage(null);
  }, [data]);

  const verified = evaluation.approved || syncMessage !== null;
  const cells = useMemo(() => evaluation.cells.map((cell) => ({ ...cell, marks: marks[cell.question] ?? cell.marks })), [evaluation, marks]);
  const flagged = cells.filter((cell) => cell.conf < CONFIDENCE_THRESHOLD);
  const total = cells.reduce((sum, cell) => sum + cell.marks, 0);
  const totalMatches = total === evaluation.written_total;
  const invalidCell = cells.some((cell) => !Number.isFinite(cell.marks) || cell.marks < 0 || cell.marks > cell.max);

  const chart = attainment.outcomes.map((outcome) => ({
    co: outcome.co,
    value: outcome.avg_pct,
    before: previous?.outcomes.find((item) => item.co === outcome.co)?.avg_pct ?? outcome.avg_pct,
  }));

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setScanning(true);
    setScanNotice(null);
    const response = await api.uploadSheet(file);
    setScanning(false);
    if (!response.data) {
      setScanNotice(`${file.name} was not read because ${response.note}.`);
      return;
    }
    setMarks({});
    setSyncMessage(null);
    setPrevious(null);
    setEvaluation(response.data.evaluation);
    setImageUrl(response.data.sampleOnly ? null : URL.createObjectURL(file));
    setScanNotice(
      response.data.sampleOnly
        ? `${file.name} could not be read by the vision engine, so these marks come from the backend's sample sheet.`
        : `${file.name} was read by ${response.data.engine}. Check the marks against the image.${response.data.usnWarning ? ` ${response.data.usnWarning}.` : ""}`,
    );
  };

  const verify = async () => {
    setSyncing(true);
    const corrections = Object.fromEntries(cells.filter((cell) => cell.marks !== evaluation.cells.find((item) => item.question === cell.question)?.marks).map((cell) => [cell.question, cell.marks]));
    const response = await api.approveAndSync(evaluation.eval_id, corrections);
    setPrevious(attainment);
    if (response.data) {
      setAttainment(response.data);
      setSyncMessage("Marks verified and recorded. The spreadsheet step is a mock until Google Sheets is connected.");
    } else {
      setAttainment(applyLocally(attainment, evaluation.cells, cells));
      setSyncMessage(`Marks verified in this browser only, because ${response.note}. Nothing was saved.`);
    }
    setSyncing(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="OCR mark-sheet scanner"
          description={`Any cell below ${percent(CONFIDENCE_THRESHOLD)} confidence needs a faculty check before marks reach the spreadsheet.`}
          action={
            <label className={clsx("btn-outline", scanning || loading ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
              {scanning ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
              {scanning ? "Scanning" : "Upload a sheet"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={scanning || loading}
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <ScanLine className="h-4 w-4 text-slate-600" aria-hidden />
              Scanned sheet
            </h3>
            <ScannedSheet evaluation={evaluation} imageUrl={imageUrl} />
            {evaluation.feedback && <p className="mt-2 text-sm text-slate-700">{evaluation.feedback}</p>}
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
                      <tr key={cell.question} className={clsx("border-t border-slate-100", needsReview && !verified && "bg-gold-100")}>
                        <th scope="row" className="px-3 py-2 font-medium">
                          {cell.question}
                        </th>
                        <td className="px-3 py-2">
                          {needsReview && !verified ? (
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
                          {needsReview && !verified ? (
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

            {invalidCell && (
              <p role="alert" className="mt-1 text-sm text-critical-700">
                Marks must be between 0 and the maximum for that question.
              </p>
            )}

            {verified ? (
              <div className="mt-3">
                <Notice tone="success" icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}>
                  {syncMessage ?? "This sheet has already been verified."}
                </Notice>
              </div>
            ) : (
              <>
                <button type="button" className="btn-primary mt-3 w-full" disabled={syncing || invalidCell || loading} onClick={verify}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {syncing ? "Syncing" : "Verify & Sync to Google Sheets"}
                </button>
                {flagged.length > 0 && (
                  <p className="mt-1 text-xs text-slate-600">
                    Check the {flagged.length} amber {flagged.length === 1 ? "cell" : "cells"} against the scan before syncing.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="CO attainment"
          description={`Average marks per course outcome. The target is ${attainment.target_pct}%. ${attainment.approved_sheets} of ${attainment.total_sheets} sheets are verified.`}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 22, right: 12, bottom: 0, left: -14 }} barCategoryGap="40%">
                  <CartesianGrid vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="co" tick={{ fill: CHART.axis, fontSize: 12 }} tickLine={false} axisLine={{ stroke: CHART.grid }} />
                  <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} unit="%" tick={{ fill: CHART.axis, fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "#F1F5F9" }} content={<ChartTooltip labelPrefix="" />} />
                  <ReferenceLine y={attainment.target_pct} stroke={CHART.ink} strokeWidth={1} label={{ value: `Target ${attainment.target_pct}%`, position: "insideTopRight", fill: CHART.ink, fontSize: 11 }} />
                  <Bar dataKey="value" name="Attainment" fill={CHART.indigo} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    <LabelList dataKey="value" position="top" formatter={(value: number) => `${value}%`} style={{ fill: CHART.ink, fontSize: 12, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <DataTableDetails
              columns={["Outcome", "Before this sheet", "Current", "Against target"]}
              rows={chart.map((row) => [row.co, `${row.before}%`, `${row.value}%`, row.value >= attainment.target_pct ? "Met" : "Below"])}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="mb-2 text-left text-sm font-medium">Sample CO-PO mapping</caption>
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
