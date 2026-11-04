"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { Card, CardHeader, DataTableDetails } from "@/components/ui/primitives";
import {
  COHORT_LABEL,
  DEFAULT_SPLITS,
  SLOT_LABEL,
  STRATA_PRESETS,
  STRATUM_LABEL,
  THETA,
  activeCurveFor,
  curveFor,
  dipMinute,
  liveClassParams,
  type Cohort,
  type Slot,
  type Stratum,
} from "@/lib/attention";
import { CHART } from "@/lib/chart";
import type { AttentionModel } from "@/types";

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

function DecayChart({ model, pollMinute }: { model: AttentionModel; pollMinute: number | null }) {
  const splits = useMemo(() => {
    if (pollMinute === null) return DEFAULT_SPLITS;
    return [{ start: pollMinute, end: pollMinute + 7 }, DEFAULT_SPLITS[1]];
  }, [pollMinute]);

  const data = useMemo(() => {
    const active = pollMinute === null ? model.active_intervened_curve : activeCurveFor(liveClassParams(), splits);
    return model.t.map((t, index) => ({ t, passive: model.passive_curve[index], active: active[index] }));
  }, [model, pollMinute, splits]);

  return (
    <Card>
      <CardHeader
        title="Passive decay vs. CampusAI attention resets"
        description={`A passive lecture crosses the ${THETA}% threshold near minute ${Math.round(model.dip_trigger_minute)}. Activity splits restore attention before it collapses.`}
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
            {splits.map((split, index) => (
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
              y={THETA}
              stroke={CHART.ink}
              strokeWidth={1}
              label={{ value: `${THETA}% threshold`, position: "insideBottomRight", fill: CHART.ink, fontSize: 11 }}
            />
            <Line
              type="monotone"
              dataKey="passive"
              name="Passive lecture"
              stroke={CHART.red}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="active"
              name="CampusAI with activities"
              stroke={CHART.indigo}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            <Legend verticalAlign="top" align="left" height={28} iconType="plainline" wrapperStyle={{ fontSize: 12, paddingLeft: 20 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTableDetails
        columns={["Minute", "Passive lecture", "CampusAI"]}
        rows={everyFifth(data).map((row) => [row.t, `${row.passive}%`, `${row.active}%`])}
      />
      <p className="mt-3 text-xs leading-relaxed text-slate-600">
        Modelled curves, not measured class data. Decay shape follows the concentration window from Stuart &amp; Rutherford (1978), with stratum, cohort and time-of-day
        multipliers from the IUCEE-based plan; Bunce, Flens &amp; Neiles (2010) informs the activity resets.
      </p>
    </Card>
  );
}

const selectClass = "field py-1.5";

function StrataChart({
  model,
  pollOverride,
  pollMinute,
  onTogglePoll,
}: {
  model: AttentionModel;
  pollOverride: boolean;
  pollMinute: number;
  onTogglePoll: (value: boolean) => void;
}) {
  const [stratum, setStratum] = useState<Stratum>("APPLIED_CORE");
  const [cohort, setCohort] = useState<Cohort>("UG2_3");
  const [slot, setSlot] = useState<Slot>("MORNING_09AM");

  const selectedParams = useMemo(() => ({ stratum, cohort, slot }), [stratum, cohort, slot]);
  const selectedDip = dipMinute(selectedParams);

  const data = useMemo(() => {
    const selected = curveFor(selectedParams);
    return model.t.map((t, index) => {
      const row: Record<string, number> = { t, selected: selected[index] };
      for (const curve of model.strata_curves) row[curve.key] = curve.curve[index];
      return row;
    });
  }, [model, selectedParams]);

  const bands = STRATA_PRESETS.filter((preset) => model.strata_curves.some((curve) => curve.key === preset.key));

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
          <dd className="text-lg font-semibold">Min {selectedDip}</dd>
        </div>
        {model.strata_curves.map((curve) => {
          const preset = STRATA_PRESETS.find((item) => item.key === curve.key);
          return (
            <div key={curve.key} className="rounded-lg border border-slate-200 p-2.5">
              <dt className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STRATA_COLOR[curve.key] ?? CHART.axis }} aria-hidden />
                <span className="truncate">{curve.label}</span>
              </dt>
              <dd className="text-lg font-semibold">
                Min {curve.dip_minute}
                {preset && (
                  <span className="ml-1 text-xs font-normal text-slate-600">
                    band {preset.band[0]}–{preset.band[1]}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

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
            {bands.map((preset) => (
              <ReferenceArea
                key={preset.key}
                x1={preset.band[0]}
                x2={preset.band[1]}
                fill={STRATA_COLOR[preset.key]}
                fillOpacity={0.12}
                strokeOpacity={0}
              />
            ))}
            <ReferenceLine y={THETA} stroke={CHART.ink} strokeWidth={1} />
            {pollOverride && (
              <ReferenceLine
                x={pollMinute}
                stroke={CHART.ink}
                strokeWidth={1.5}
                label={{ value: `Student poll: min ${pollMinute}`, position: "top", fill: CHART.ink, fontSize: 11 }}
              />
            )}
            {model.strata_curves.map((curve) => (
              <Line
                key={curve.key}
                type="monotone"
                dataKey={curve.key}
                name={curve.label}
                stroke={STRATA_COLOR[curve.key] ?? CHART.axis}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ))}
            <Line
              type="monotone"
              dataKey="selected"
              name="Selected cohort"
              stroke={CHART.ink}
              strokeWidth={2}
              strokeDasharray="2 3"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            <Legend verticalAlign="top" align="left" height={44} iconType="plainline" wrapperStyle={{ fontSize: 12, paddingLeft: 20 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTableDetails
        columns={["Minute", "Selected", ...model.strata_curves.map((curve) => curve.label)]}
        rows={everyFifth(data).map((row) => [row.t, `${row.selected}%`, ...model.strata_curves.map((curve) => `${row[curve.key]}%`)])}
      />
    </Card>
  );
}

export function AttentionCharts({
  model,
  pollOverride,
  pollMinute,
  onTogglePoll,
}: {
  model: AttentionModel;
  pollOverride: boolean;
  pollMinute: number;
  onTogglePoll: (value: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <DecayChart model={model} pollMinute={pollOverride ? pollMinute : null} />
      <StrataChart model={model} pollOverride={pollOverride} pollMinute={pollMinute} onTogglePoll={onTogglePoll} />
    </div>
  );
}
