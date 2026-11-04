"use client";

import clsx from "clsx";
import { AlertTriangle, CalendarClock, CheckCircle2, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Card, CardHeader, Notice, PageHeader, StatTile } from "@/components/ui/primitives";
import { markShifted } from "@/lib/adapters";
import { api, useResource } from "@/lib/api";
import { COHORT_LABEL, SLOT_LABEL, STRATUM_LABEL, dipMinute } from "@/lib/attention";
import { fallbackPacing } from "@/lib/fallback/pacing";
import { formatDate, formatShortDate } from "@/lib/format";
import { MIN_ACTIVITY_MINS, persona, recalibrate, stratumFor, type Ltp } from "@/lib/pacing";
import type { SessionPlan } from "@/types";

const PERSONA_PRESETS = [
  {
    label: "Balanced",
    prompt: "Balanced conceptual explanation with real-world engineering examples and interactive problem solving.",
  },
  {
    label: "Socratic case study",
    prompt: "Socratic case-study driven: open with a question and let students reason through a real vision system.",
  },
  {
    label: "Math derivation",
    prompt: "Math derivation heavy: build each result from first principles on the board before any application.",
  },
];

const COHORT = "UG2_3" as const;
const SLOT = "MORNING_09AM" as const;

type Outcome =
  | { kind: "saved"; carried: number; finishesOn: string | null; onTime: boolean }
  | { kind: "local"; absorbed: number; overflow: number; shortfall: number; reason: string };

function LtpSlider({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  const id = `ltp-${label}`;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <label htmlFor={id} className="font-medium text-slate-800">
          {label}
        </label>
        <span className="text-slate-600">{value} h/week</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full accent-brand-600"
      />
    </div>
  );
}

function SplitBar({ lecture, activity }: { lecture: number; activity: number }) {
  const total = Math.max(1, lecture + activity);
  return (
    <div className="flex h-2 w-full gap-0.5" aria-hidden>
      <div className="rounded-l bg-brand-600" style={{ width: `${(lecture / total) * 100}%` }} />
      <div className="rounded-r bg-gold-500" style={{ width: `${(activity / total) * 100}%` }} />
    </div>
  );
}

const TYPE_LABEL = { L: "Lecture", T: "Tutorial", P: "Lab" };

function SessionRow({ session, dip, behind }: { session: SessionPlan; dip: number; behind: boolean }) {
  const shifted = session.status === "RECALIBRATED";
  const isLab = session.ltp_type === "P";
  return (
    <li
      className={clsx(
        "grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[4.5rem_1fr_11rem] sm:items-center sm:gap-4",
        behind ? "border-red-200 bg-red-50" : shifted ? "border-amber-200 bg-gold-50" : "border-slate-200 bg-white",
      )}
    >
      <div>
        <div className="text-sm font-semibold">S{session.session_number}</div>
        <div className="text-xs text-slate-600">{formatShortDate(session.scheduled_date)}</div>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={isLab ? "teal" : session.ltp_type === "T" ? "warning" : "brand"}>{TYPE_LABEL[session.ltp_type]}</Badge>
          {behind && (
            <Badge tone="critical">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Ended {Math.abs(session.pacing_delta_mins)} min behind
            </Badge>
          )}
          {shifted && (
            <Badge tone="warning">
              <RefreshCw className="h-3 w-3" aria-hidden />
              {session.pacing_delta_mins > 0 ? `+${session.pacing_delta_mins} min catch-up` : "Re-balanced"}
            </Badge>
          )}
        </div>
        <div className="mt-1 text-sm text-slate-800">{session.topic_title}</div>
      </div>
      {isLab ? (
        <div className="text-xs text-slate-700">{session.session_duration_mins} min hands-on</div>
      ) : (
        <div className="text-xs text-slate-700">
          <div className="mb-1 flex justify-between tabular-nums">
            <span>{session.lecture_minutes_split} lecture</span>
            <span>{session.activity_minutes_split} activity</span>
          </div>
          <SplitBar lecture={session.lecture_minutes_split} activity={session.activity_minutes_split} />
          <div className="mt-1 text-slate-600">Activity at min {Math.round(session.predicted_dip_minute ?? dip)}</div>
        </div>
      )}
    </li>
  );
}

function CountdownTile({ lastWorkingDay }: { lastWorkingDay: string }) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    const remaining = (Date.parse(`${lastWorkingDay}T00:00:00Z`) - Date.now()) / 86_400_000;
    setDays(Math.max(0, Math.ceil(remaining)));
  }, [lastWorkingDay]);
  return <StatTile label="Last working day" value={days === null ? "—" : `${days} days`} hint={formatDate(lastWorkingDay)} />;
}

export function PacingStudio() {
  const { data: loaded, source } = useResource(api.getPacing, fallbackPacing);
  const [plan, setPlan] = useState(loaded);
  const [prompt, setPrompt] = useState(loaded.pedagogical_system_prompt);
  const [ltp, setLtp] = useState<Ltp>({ l: loaded.l_ratio, t: loaded.t_ratio, p: loaded.p_ratio });
  const [shortfall, setShortfall] = useState(loaded.behind_mins);
  const [sessions, setSessions] = useState<SessionPlan[]>(loaded.sessions);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setPlan(loaded);
    setPrompt(loaded.pedagogical_system_prompt);
    setLtp({ l: loaded.l_ratio, t: loaded.t_ratio, p: loaded.p_ratio });
    setShortfall(loaded.behind_mins);
    setSessions(loaded.sessions);
    setOutcome(null);
  }, [loaded]);

  const validLtp = ltp.l + ltp.t + ltp.p > 0;
  const ltpChanged = ltp.l !== plan.l_ratio || ltp.t !== plan.t_ratio || ltp.p !== plan.p_ratio;
  const stratum = stratumFor(ltp);
  const dip = useMemo(() => dipMinute({ stratum, cohort: COHORT, slot: SLOT }), [stratum]);
  const style = persona(prompt);
  const assessment = plan.milestones.find((milestone) => milestone.kind === "IA");
  const isLive = source === "live";

  const applyLocally = (reason: string) => {
    const result = recalibrate({
      sessions: plan.sessions,
      behindSession: plan.behind_session,
      shortfallMins: shortfall,
      ltp: ltpChanged ? ltp : null,
      prompt,
    });
    setSessions(result.sessions);
    setOutcome({ kind: "local", absorbed: result.absorbedMins, overflow: result.overflowMins, shortfall, reason });
  };

  const runRecalibration = async () => {
    setRunning(true);
    // The API has no L:T:P or shortfall input: L:T:P lives on the course record and
    // the shortfall comes from the completed session. A changed ratio is a preview.
    if (ltpChanged) {
      applyLocally("the L:T:P ratio is set on the course record, so this is a what-if preview that is not saved");
    } else {
      const response = await api.recalibratePacing({ pedagogical_system_prompt: prompt });
      if (response.data) {
        setSessions(markShifted(plan.sessions, response.data.plan.sessions));
        setPlan(response.data.plan);
        setOutcome({
          kind: "saved",
          carried: response.data.carried_drift_mins,
          finishesOn: response.data.syllabus_finishes_on,
          onTime: response.data.finishes_before_lwd,
        });
      } else {
        applyLocally(response.note ?? "the backend is offline");
      }
    }
    setRunning(false);
  };

  return (
    <>
      <PageHeader
        title="L:T:P Pacing & Teacher Persona Studio"
        description={`${plan.course_code}: ${plan.course_title}. Falling behind in one session re-balances the sessions leading up to the next assessment.`}
        action={
          <Badge tone="brand" className="px-3 py-1 text-sm">
            L:T:P {ltp.l}:{ltp.t}:{ltp.p}
          </Badge>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CountdownTile lastWorkingDay={plan.last_working_day} />
        {plan.milestones
          .filter((milestone) => milestone.kind !== "LWD")
          .slice(0, 3)
          .map((milestone) => (
            <StatTile key={milestone.label} label={milestone.label} value={formatDate(milestone.date)} />
          ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card>
          <CardHeader title="Teacher persona and protocol" description="These settings shape how each session is split and where the activity falls." />

          <fieldset>
            <legend className="text-sm font-medium text-slate-800">Teaching style</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {PERSONA_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={prompt === preset.prompt}
                  onClick={() => setPrompt(preset.prompt)}
                  className={clsx(
                    "btn border text-xs",
                    prompt === preset.prompt ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label htmlFor="persona-prompt" className="mt-4 block text-sm font-medium text-slate-800">
            Pedagogical system prompt
          </label>
          <textarea id="persona-prompt" rows={4} value={prompt} onChange={(event) => setPrompt(event.target.value)} className="field mt-1 resize-y" />
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
            <Sparkles className="h-3.5 w-3.5 text-gold-700" aria-hidden />
            {style.label}: {60 - style.activityMins} lecture / {style.activityMins} activity
          </p>

          <div className="mt-4 space-y-3">
            <LtpSlider label="Lecture" value={ltp.l} max={4} onChange={(l) => setLtp((current) => ({ ...current, l }))} />
            <LtpSlider label="Tutorial" value={ltp.t} max={2} onChange={(t) => setLtp((current) => ({ ...current, t }))} />
            <LtpSlider label="Practical" value={ltp.p} max={4} onChange={(p) => setLtp((current) => ({ ...current, p }))} />
          </div>
          <p className="mt-2 text-xs text-slate-600">
            {STRATUM_LABEL[stratum].split(" (")[0]}, {COHORT_LABEL[COHORT]}, {SLOT_LABEL[SLOT]}: predicted attention dip at minute {dip}.
          </p>
          {ltpChanged && <p className="mt-1 text-xs text-gold-700">Changing the ratio gives a what-if preview. It is not saved to the course.</p>}

          <div className="mt-4">
            {isLive ? (
              <p className="text-sm text-slate-800">
                <span className="font-medium">Session {plan.behind_session} shortfall:</span> {plan.behind_mins} min, recorded when the session ended.
              </p>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <label htmlFor="shortfall" className="font-medium text-slate-800">
                    Session {plan.behind_session} shortfall
                  </label>
                  <span className="text-slate-600">{shortfall} min</span>
                </div>
                <input
                  id="shortfall"
                  type="range"
                  min={0}
                  max={30}
                  step={5}
                  value={shortfall}
                  onChange={(event) => setShortfall(Number(event.target.value))}
                  className="mt-1 w-full accent-brand-600"
                />
              </>
            )}
          </div>

          {!validLtp && (
            <p role="alert" className="mt-3 text-sm text-critical-700">
              Set at least one weekly hour to build a plan.
            </p>
          )}

          <button type="button" className="btn-primary mt-4 w-full" disabled={!validLtp || running} onClick={runRecalibration}>
            <RefreshCw className={clsx("h-4 w-4", running && "animate-spin")} aria-hidden />
            {running ? "Recalibrating" : "Recalibrate Semester Plan"}
          </button>
        </Card>

        <Card>
          <CardHeader
            title="Self-healing session timeline"
            description={
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" aria-hidden />
                Sessions {sessions[0]?.session_number}–{sessions[sessions.length - 1]?.session_number} before {assessment?.label ?? "the next assessment"}
              </span>
            }
          />

          {outcome?.kind === "saved" && (
            <div className="mb-3">
              <Notice tone={outcome.onTime ? "success" : "warning"} icon={outcome.onTime ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}>
                Plan saved. {outcome.carried > 0 ? `${outcome.carried} carried-over minutes were re-allocated. ` : ""}
                {outcome.finishesOn
                  ? `The syllabus finishes on ${formatDate(outcome.finishesOn)}${outcome.onTime ? ", before" : ", after"} the last working day.`
                  : "No finish date was returned."}
              </Notice>
            </div>
          )}
          {outcome?.kind === "local" && (
            <div className="mb-3">
              {outcome.overflow > 0 ? (
                <Notice tone="warning" icon={<AlertTriangle className="h-4 w-4" aria-hidden />}>
                  {outcome.absorbed} of {outcome.shortfall} minutes fit while keeping {MIN_ACTIVITY_MINS} minutes of activity per session. {outcome.overflow} minutes still need a buffer session.
                  {` Calculated in this browser because ${outcome.reason}.`}
                </Notice>
              ) : (
                <Notice tone="success" icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}>
                  Absorbed the {outcome.shortfall}-minute shortfall before {assessment?.label ?? "the next assessment"}. Calculated in this browser because {outcome.reason}.
                </Notice>
              )}
            </div>
          )}

          <ol className="space-y-2">
            {sessions.map((session) => (
              <SessionRow key={session.session_id} session={session} dip={dip} behind={session.session_number === plan.behind_session && session.pacing_delta_mins < 0} />
            ))}
            {assessment && (
              <li className="flex items-center justify-between gap-2 rounded-lg bg-brand-950 p-3 text-sm text-white">
                <span className="font-medium">{assessment.label}</span>
                <span>{formatShortDate(assessment.date)}</span>
              </li>
            )}
          </ol>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded bg-brand-600" aria-hidden />
              Lecture minutes
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded bg-gold-500" aria-hidden />
              Activity minutes
            </span>
          </div>
        </Card>
      </div>
    </>
  );
}
