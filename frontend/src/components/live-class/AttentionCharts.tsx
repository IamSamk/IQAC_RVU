"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { Card, CardHeader, DataTableDetails } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import {
  COHORT_LABEL,
  COHORT_SEMESTER,
  SLOT_LABEL,
  STRATA_PRESETS,
  STRATUM_LABEL,
  curveFor,
  dipMinute,
  fallbackAttentionModel,
  type Cohort,
  type Slot,
  type Stratum,
} from "@/lib/attention";
import { CHART } from "@/lib/chart";
import type { AttentionModel, StrataCurve } from "@/types";

const TICKS = [0, 10, 20, 30, 40, 50, 60];
const Y_TICKS = [0, 20, 40, 60, 80, 100];
const STRATA_COLOR: Record<string, string> = {
  HEAVY_THEORY: CHART.amber,
  APPLIED_CORE: CHART.indigo,
  STUDIO_ELECTIVE: CHART.teal,
};

const axisProps = {
  tick: { fill: CHART.axis, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: CHART.grid },
};

const everyFifth = <T,>(rows: T[]) => rows.filter((_, index) => index % 5 === 0);

const legendLabel = (value: string) => <span style={{ color: CHART.ink }}>{value}</span>;

function DecayChart({ model }: { model: AttentionModel }) {
  const data = useMemo(
    () => model.t.map((t, index) => ({ t, passive: model.passive_curve[index], active: model.active_intervened_curve[index] })),
    [model],
  );
  return (
    <Card>
      <CardHeader
        title="Passive decay vs. CampusAI attention resets"
        description={`Activity starts at minute ${Math.round(model.dip_trigger_minute)}, as a passive lecture nears the ${model.threshold}% threshold. Each activity restores attention before it collapses.`}
      />
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 18, right: 12, bottom: 18, left: -14 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, 60]}
              ticks={TICKS}
              {...axisProps}
              label={{ value: "Minutes into class", position: "insideBottom", offset: -8, fill: CHART.axis, fontSize: 12 }}
            />
            <YAxis domain={[0, 100]} ticks={Y_TICKS} unit="%" {...axisProps} />
            <Tooltip content={<ChartTooltip />} />
            {model.activity_splits.map((split, index) => (
              <ReferenceArea
                key={split.start}
                x1={split.start}
                x2={split.end}
                fill={CHART.amber}
                fillOpacity={0.14}
                strokeOpacity={0}
                label={{ value: `Activity ${index + 1}`, position: "insideTop", fill: "#92400E", fontSize: 11 }}
              />
            ))}
            <ReferenceLine
              y={model.threshold}
              stroke={CHART.ink}
              strokeWidth={1}
              label={{ value: `${model.threshold}% threshold`, position: "insideBottomLeft", fill: CHART.ink, fontSize: 11 }}
            />
            <Line type="monotone" dataKey="passive" name="Passive lecture" stroke={CHART.red} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="active" name="CampusAI with activities" stroke={CHART.indigo} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            <Legend verticalAlign="top" align="left" height={28} iconType="plainline" formatter={legendLabel} wrapperStyle={{ fontSize: 12, paddingLeft: 20 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTableDetails columns={["Minute", "Passive lecture", "CampusAI"]} rows={everyFifth(data).map((row) => [row.t, `${row.passive}%`, `${row.active}%`])} />
      <p className="mt-3 text-xs leading-relaxed text-slate-600">Modelled curves, not measured class data. Sources: {model.citations.join("; ")}.</p>
    </Card>
  );
}

const selectClass = "field py-1.5";

/** The backend sends several cohorts per course type, so draw one and show the range. */
function referenceStrata(curves: StrataCurve[]) {
  const groups = new Map<string, StrataCurve[]>();
  for (const curve of curves) groups.set(curve.stratum, [...(groups.get(curve.stratum) ?? []), curve]);
  return [...groups.entries()].map(([stratum, group]) => {
    const dips = group.map((curve) => curve.dip_minute);
    const preset = STRATA_PRESETS.find((item) => item.key === stratum);
    const band: [number, number] = group.length > 1 ? [Math.min(...dips), Math.max(...dips)] : preset?.band ?? [dips[0], dips[0]];
    return { stratum, curve: group[0], band };
  });
}

function StrataChart({
  model,
  sessionId,
  isLive,
  pollOverride,
  pollMinute,
  onTogglePoll,
}: {
  model: AttentionModel;
  sessionId: string;
  isLive: boolean;
  pollOverride: boolean;
  pollMinute: number;
  onTogglePoll: (value: boolean) => void;
}) {
  const [stratum, setStratum] = useState<Stratum>("APPLIED_CORE");
  const [cohort, setCohort] = useState<Cohort>("UG2_3");
  const [slot, setSlot] = useState<Slot>("MORNING_09AM");

  const localSelected = useMemo(() => {
    const params = { stratum, cohort, slot };
    return { curve: curveFor(params), dip: dipMinute(params) };
  }, [stratum, cohort, slot]);
  const [selected, setSelected] = useState(localSelected);

  useEffect(() => {
    setSelected(localSelected);
    if (!isLive) return;
    let active = true;
    api
      .getAttentionVariant(
        sessionId,
        { stratum, semester: String(COHORT_SEMESTER[cohort]), time_slot: slot, use_poll: "false" },
        { ...fallbackAttentionModel(), passive_curve: localSelected.curve, dip_trigger_minute: localSelected.dip },
      )
      .then((response) => {
        if (active) setSelected({ curve: response.data.passive_curve, dip: response.data.dip_trigger_minute });
      });
    return () => {
      active = false;
    };
  }, [sessionId, isLive, stratum, cohort, slot, localSelected]);

  const references = useMemo(() => referenceStrata(model.strata_curves), [model]);

  const data = useMemo(
    () =>
      model.t.map((t, index) => {
        const row: Record<string, number> = { t, selected: selected.curve[index] };
        for (const reference of references) row[reference.stratum] = reference.curve.curve[index];
        return row;
      }),
    [model, selected, references],
  );

  return (
    <Card>
      <CardHeader
        title="Stratified decay by L:T:P, cohort and time of day"
        description="The dip arrives earlier in theory-heavy, post-lunch, first-year classes. Pick a cohort to compare it with the reference strata."
      />
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
        <label className="text-xs font-medium text-slate-700">
          Course type
          <select className={`${selectClass} mt-1`} value={stratum} onChange={(event) => setStratum(event.target.value as Stratum)}>
            {Object.entries(STRATUM_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-700">
          Cohort
          <select className={`${selectClass} mt-1`} value={cohort} onChange={(event) => setCohort(event.target.value as Cohort)}>
            {Object.entries(COHORT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-700">
          Time slot
          <select className={`${selectClass} mt-1`} value={slot} onChange={(event) => setSlot(event.target.value as Slot)}>
            {Object.entries(SLOT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-[38px] items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={pollOverride} onChange={(event) => onTogglePoll(event.target.checked)} />
          Student Live Poll Override
        </label>
      </div>

      <dl className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-lg border-2 border-slate-900 p-2.5">
          <dt className="text-xs text-slate-600">Selected cohort</dt>
          <dd className="text-lg font-semibold">Min {selected.dip}</dd>
        </div>
        {references.map((reference) => (
          <div key={reference.stratum} className="rounded-lg border border-slate-200 p-2.5">
            <dt className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STRATA_COLOR[reference.stratum] ?? CHART.axis }} aria-hidden />
              <span className="truncate" title={reference.curve.label}>
                {reference.curve.label}
              </span>
            </dt>
            <dd className="text-lg font-semibold">
              Min {reference.curve.dip_minute}
              <span className="ml-1 text-xs font-normal text-slate-600">
                range {reference.band[0]}–{reference.band[1]}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 18, right: 12, bottom: 18, left: -14 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, 60]}
              ticks={TICKS}
              {...axisProps}
              label={{ value: "Minutes into class", position: "insideBottom", offset: -8, fill: CHART.axis, fontSize: 12 }}
            />
            <YAxis domain={[0, 100]} ticks={Y_TICKS} unit="%" {...axisProps} />
            <Tooltip content={<ChartTooltip />} />
            {references.map((reference) => (
              <ReferenceArea
                key={reference.stratum}
                x1={reference.band[0]}
                x2={reference.band[1]}
                fill={STRATA_COLOR[reference.stratum] ?? CHART.axis}
                fillOpacity={0.12}
                strokeOpacity={0}
              />
            ))}
            <ReferenceLine y={model.threshold} stroke={CHART.ink} strokeWidth={1} />
            {pollOverride && (
              <ReferenceLine x={pollMinute} stroke={CHART.ink} strokeWidth={1.5} label={{ value: `Poll-adjusted trigger: min ${pollMinute}`, position: "top", fill: CHART.ink, fontSize: 11 }} />
            )}
            {references.map((reference) => (
              <Line
                key={reference.stratum}
                type="monotone"
                dataKey={reference.stratum}
                name={reference.curve.label}
                stroke={STRATA_COLOR[reference.stratum] ?? CHART.axis}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ))}
            <Line type="monotone" dataKey="selected" name="Selected cohort" stroke={CHART.ink} strokeWidth={2} strokeDasharray="2 3" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            <Legend verticalAlign="top" align="left" height={48} iconType="plainline" formatter={legendLabel} wrapperStyle={{ fontSize: 12, paddingLeft: 20 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTableDetails
        columns={["Minute", "Selected", ...references.map((reference) => reference.curve.label)]}
        rows={everyFifth(data).map((row) => [row.t, `${row.selected}%`, ...references.map((reference) => `${row[reference.stratum]}%`)])}
      />
    </Card>
  );
}

export function AttentionCharts({ model, sessionId, isLive }: { model: AttentionModel; sessionId: string; isLive: boolean }) {
  const [pollOverride, setPollOverride] = useState(false);
  const [pollModel, setPollModel] = useState<AttentionModel | null>(null);

  useEffect(() => {
    if (!pollOverride) return;
    let active = true;
    const local = fallbackAttentionModel(model.student_poll.avg_preferred_split_min ?? undefined);
    if (!isLive) {
      setPollModel(local);
      return;
    }
    api.getAttentionVariant(sessionId, { use_poll: "true" }, local).then((response) => {
      if (active) setPollModel(response.data);
    });
    return () => {
      active = false;
    };
  }, [pollOverride, isLive, sessionId, model]);

  const shown = pollOverride && pollModel ? pollModel : model;

  return (
    <div className="space-y-4">
      <DecayChart model={shown} />
      <StrataChart model={model} sessionId={sessionId} isLive={isLive} pollOverride={pollOverride} pollMinute={Math.round(shown.dip_trigger_minute)} onTogglePoll={setPollOverride} />
    </div>
  );
}
