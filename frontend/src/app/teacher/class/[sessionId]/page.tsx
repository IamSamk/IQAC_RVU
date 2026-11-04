"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Download,
  ExternalLink,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Timer,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/primitives";
import { ErrorState, LoadingCards, Prose, StatusPill, formatDay } from "@/components/app/ui";
import { app, useFetch, usePolling } from "@/lib/app-api";
import type { ActivityLaunch, EndClassResult, LiveClass } from "@/types/app";

const PLATFORMS = [
  { id: "MENTIMETER", label: "Mentimeter", url: "https://www.mentimeter.com/app" },
  { id: "KAHOOT", label: "Kahoot", url: "https://create.kahoot.it" },
  { id: "GOOGLE_CLASSROOM", label: "Google Classroom", url: "https://classroom.google.com" },
  { id: "IN_APP_10_SETS", label: "In-app (students' phones)", url: "" },
];

function useElapsed(startedAt: string | null, running: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  if (!startedAt) return 0;
  return Math.max(0, (now - new Date(startedAt).getTime()) / 60000);
}

function AttentionTimeline({ live, minute }: { live: LiveClass; minute: number | null }) {
  const { passive, active, activity_splits, dip_minute } = live.attention;
  const W = 600,
    H = 120;
  const x = (t: number) => (t / 60) * W;
  const y = (v: number) => H - (v / 100) * H;
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label={`Attention is predicted to dip at minute ${dip_minute}`}>
      {activity_splits.map((s) => (
        <rect key={s.start} x={x(s.start)} y={0} width={x(s.end) - x(s.start)} height={H} fill="#5640E0" opacity=".1" rx="4" />
      ))}
      <line x1={0} x2={W} y1={y(55)} y2={y(55)} stroke="#F2A922" strokeDasharray="5 5" />
      <path d={path(passive)} fill="none" stroke="#D92D20" strokeWidth="2" strokeDasharray="6 5" opacity=".7" />
      <path d={path(active)} fill="none" stroke="#5640E0" strokeWidth="3" />
      {minute !== null && minute <= 60 && (
        <>
          <line x1={x(minute)} x2={x(minute)} y1={0} y2={H} stroke="#0E0C1D" strokeWidth="2" />
          <circle cx={x(minute)} cy={y(active[Math.min(60, Math.round(minute))])} r="5" fill="#0E0C1D" />
        </>
      )}
      {[0, 15, 30, 45, 60].map((t) => (
        <text key={t} x={Math.min(W - 14, x(t))} y={H + 14} fontSize="11" fill="#8E8AA6">
          {t}′
        </text>
      ))}
    </svg>
  );
}

function setsToText(a: ActivityLaunch) {
  return a.question_sets
    .map((s) => `Set ${s.set_number}\n` + s.questions.map((q, i) => `${i + 1}. ${q.question}${q.options?.length ? "\n   " + q.options.map((o, j) => `${String.fromCharCode(65 + j)}) ${o}`).join("   ") : ""}`).join("\n"))
    .join("\n\n");
}

function setsToKahootCsv(a: ActivityLaunch) {
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Question", "Answer 1", "Answer 2", "Answer 3", "Answer 4", "Time limit (sec)", "Correct answer(s)"].join(",")];
  for (const q of a.question_sets[0]?.questions ?? []) {
    const opts = (q.options ?? []).slice(0, 4);
    const correct = opts.findIndex((o) => o === q.answer) + 1;
    rows.push([esc(q.question), ...[0, 1, 2, 3].map((i) => esc(opts[i] ?? "")), "30", correct > 0 ? String(correct) : ""].join(","));
  }
  return rows.join("\n");
}

export default function ClassPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { data: live, error, loading, reload } = useFetch(() => app.live(sessionId), [sessionId]);
  const [starting, setStarting] = useState(false);
  const [platform, setPlatform] = useState("MENTIMETER");
  const [plan, setPlan] = useState<string | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [activity, setActivity] = useState<ActivityLaunch | null>(null);
  const [actBusy, setActBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [covered, setCovered] = useState<string[]>([]);
  const [transcript, setTranscript] = useState("");
  const [ending, setEnding] = useState(false);
  const [endResult, setEndResult] = useState<EndClassResult | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const status = live?.session.status;
  const running = status === "IN_PROGRESS";
  const elapsed = useElapsed(live?.session.started_at ?? null, running);
  usePolling(() => void reload(true), 4000, running);

  useEffect(() => {
    if (live) {
      setPlan((p) => p ?? live.session.lesson_plan_md);
      setCovered((c) => (c.length ? c : live.topics.map((t) => t.chunk_id)));
    }
  }, [live]);

  if (error && !live) return <ErrorState message={error} onRetry={() => reload()} />;
  if (loading && !live) return <LoadingCards count={2} />;
  if (!live) return null;

  const platformDef = PLATFORMS.find((p) => p.id === platform)!;
  const nextSplit = live.attention.activity_splits.find((s) => s.end > elapsed);
  const inSplit = nextSplit && elapsed >= nextSplit.start;
  const minsToSplit = nextSplit ? Math.max(0, Math.ceil(nextSplit.start - elapsed)) : null;

  const start = async () => {
    setStarting(true);
    try {
      await app.startClass(sessionId);
      await reload(true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not start class");
    } finally {
      setStarting(false);
    }
  };

  const makePlan = async (regenerate = false) => {
    setPlanBusy(true);
    try {
      const res = await app.lessonPlan(sessionId, platformDef.label, regenerate);
      setPlan(res.lesson_plan_md);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not create the plan");
    } finally {
      setPlanBusy(false);
    }
  };

  const launch = async () => {
    setActBusy(true);
    try {
      setActivity(await app.launchActivity(sessionId, platform));
      await reload(true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not launch the activity");
    } finally {
      setActBusy(false);
    }
  };

  const copySets = async () => {
    if (!activity) return;
    await navigator.clipboard.writeText(setsToText(activity));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const downloadCsv = () => {
    if (!activity) return;
    const blob = new Blob([setsToKahootCsv(activity)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${live.course.course_code}_S${live.session.session_number}_kahoot.csv`;
    a.click();
  };

  const toggleRecord = async () => {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setTranscribing(true);
        try {
          const res = await app.transcribe(sessionId, new Blob(chunks.current, { type: rec.mimeType || "audio/webm" }));
          const text = res.text || res.partial_text;
          if (text) setTranscript((t) => (t ? t + "\n" : "") + text);
          if (!res.accepted) setNotice(res.reason ? `Transcription was unclear (${res.reason}). Tick the topics you covered instead.` : "Transcription was unclear. Tick the topics you covered instead.");
        } catch (e) {
          setNotice(e instanceof Error ? e.message : "Transcription failed");
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      setNotice("Microphone access was blocked. You can type a short summary instead.");
    }
  };

  const endClass = async () => {
    setEnding(true);
    try {
      const res = await app.endClass(sessionId, covered, transcript);
      setEndResult(res);
      setEndOpen(false);
      await reload(true);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not end class");
    } finally {
      setEnding(false);
    }
  };

  const present = live.roster.filter((r) => r.present);

  return (
    <>
      <Link href="/teacher" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Today
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow mb-2">
            {live.course.course_code} · Section {live.offering.section} · Session {live.session.session_number} · {formatDay(live.session.scheduled_date)} · {live.offering.time}
          </div>
          <h1 className="font-display text-[2.1rem] font-semibold leading-tight tracking-tight sm:text-[2.5rem]">{live.topics.map((t) => t.title).join(" · ") || live.course.course_title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={live.session.status} />
          {status === "SCHEDULED" && (
            <button type="button" className="btn-primary btn-lg" onClick={start} disabled={starting}>
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Start class
            </button>
          )}
          {running && (
            <button type="button" className="btn-dark btn-lg" onClick={() => setEndOpen(true)}>
              <Square className="h-4 w-4" /> End class
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="mb-5">
          <ErrorState message={notice} onRetry={() => setNotice(null)} />
        </div>
      )}

      {running && (
        <section className="mb-6 overflow-hidden rounded-3xl bg-ink-950 text-white shadow-lift animate-fade-up">
          <div className="grid gap-6 p-6 md:grid-cols-[auto_1fr] md:p-8">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">Attendance code</div>
              <div className="mt-2 font-mono text-7xl font-semibold tracking-[0.2em] text-gold-500 sm:text-8xl">{live.session.attendance_code}</div>
              <p className="mt-2 max-w-xs text-sm text-ink-300">Students open CampusAI, tap this class and enter the code.</p>
            </div>
            <div className="flex flex-col justify-between gap-5">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-5xl font-semibold">{live.present_count}</span>
                    <span className="text-lg text-ink-400">/ {live.enrolled_count}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-ink-400">
                    <Users className="h-3.5 w-3.5" /> checked in
                  </div>
                </div>
                <div>
                  <div className="font-display text-5xl font-semibold tabular-nums">{Math.floor(elapsed)}′</div>
                  <div className="flex items-center gap-1.5 text-xs text-ink-400">
                    <Timer className="h-3.5 w-3.5" /> into class
                  </div>
                </div>
                <div
                  className={clsx(
                    "ml-auto rounded-2xl px-4 py-3 text-sm font-medium",
                    inSplit ? "bg-gold-500 text-ink-950" : minsToSplit !== null && minsToSplit <= 3 ? "bg-white/10 text-gold-500" : "bg-white/5 text-ink-300",
                  )}
                >
                  {inSplit ? "Activity break now: launch your poll" : minsToSplit !== null ? `Activity break in ${minsToSplit} min` : "Wrap up and recap"}
                </div>
              </div>
              <div className="rounded-2xl bg-white p-3">
                <AttentionTimeline live={live} minute={elapsed} />
              </div>
            </div>
          </div>
        </section>
      )}

      {status === "COMPLETED" && (
        <section className="mb-6 panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
              <CheckCircle2 className="h-6 w-6 text-success-500" /> Class complete
            </h2>
            <span className="text-sm text-ink-500">
              {live.present_count} of {live.enrolled_count} attended
            </span>
          </div>
          {endResult && (
            <p className="mt-2 text-sm text-ink-600">
              {endResult.recalibration.uncovered_carried_over.length > 0
                ? `${endResult.recalibration.uncovered_carried_over.length} topic(s) moved to the next classes. `
                : "Everything planned was covered. "}
              The syllabus still finishes on {formatDay(endResult.recalibration.plan.syllabus_finishes_on)}.
            </p>
          )}
          {live.session.generated_class_notes_md && (
            <div className="mt-5 rounded-2xl border border-ink-100 bg-canvas/60 p-6">
              <div className="eyebrow mb-3">Class notes, shared with students</div>
              <Prose source={live.session.generated_class_notes_md} />
            </div>
          )}
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <section className="panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                <Sparkles className="h-5 w-5 text-gold-600" /> How to take this class
              </h2>
              {plan && (
                <button type="button" className="btn-ghost text-xs" onClick={() => makePlan(true)} disabled={planBusy}>
                  <RefreshCw className={clsx("h-3.5 w-3.5", planBusy && "animate-spin")} /> Regenerate
                </button>
              )}
            </div>
            {plan ? (
              <div className="mt-4">
                <Prose source={plan} />
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-brand-50/60 p-5">
                <p className="text-sm text-ink-700">
                  Get a minute-by-minute plan built from today&apos;s topics, your teaching style and Section {live.offering.section}&apos;s attention pattern, with ready-to-use poll questions.
                </p>
                <button type="button" className="btn-primary mt-4" onClick={() => makePlan(false)} disabled={planBusy}>
                  {planBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {planBusy ? "Writing the plan…" : "Create lesson plan with AI"}
                </button>
              </div>
            )}
          </section>

          <section className="panel p-6">
            <h2 className="font-display text-xl font-semibold">Today&apos;s topics</h2>
            <ol className="mt-4 space-y-3">
              {live.topics.map((t, i) => (
                <li key={t.chunk_id} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-700">{i + 1}</span>
                  <div>
                    <div className="text-[15px] font-semibold text-ink-950">{t.title}</div>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-600">{t.content}</p>
                    <div className="mt-1 text-xs text-ink-400">
                      Unit {t.unit}
                      {t.slide_range ? ` · ${t.slide_range}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel p-6">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
              <Zap className="h-5 w-5 text-brand-600" /> Activity break
            </h2>
            <p className="mt-1 text-sm text-ink-500">10 versions of the same question, so neighbours can&apos;t copy. Each student gets their own set on their phone.</p>
            <label className="label mt-4" htmlFor="platform">
              Run it on
            </label>
            <select id="platform" className="field" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn-primary mt-3 w-full" onClick={launch} disabled={actBusy || status === "COMPLETED"}>
              {actBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {actBusy ? "AI is writing 10 versions…" : activity || live.activity ? "Launch a new activity" : "Launch activity"}
            </button>
            {(activity || live.activity) && !activity && <p className="mt-2 text-xs text-success-700">An activity is live for students: {live.activity?.learning_goal}</p>}
            {activity && (
              <div className="mt-4 space-y-3 animate-fade-up">
                <div className="grid grid-cols-2 gap-2">
                  {activity.question_sets.slice(0, 2).map((s) => (
                    <div key={s.set_number} className="rounded-xl border border-gold-100 bg-gold-50 p-3">
                      <div className="font-mono text-[11px] font-semibold text-gold-700">SET {s.set_number}</div>
                      <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-ink-800">{s.questions[0]?.question}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-outline flex-1 text-xs" onClick={copySets}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy all sets"}
                  </button>
                  <button type="button" className="btn-outline flex-1 text-xs" onClick={downloadCsv}>
                    <Download className="h-3.5 w-3.5" /> Kahoot sheet
                  </button>
                  {platformDef.url && (
                    <a href={platformDef.url} target="_blank" rel="noreferrer" className="btn-outline w-full text-xs">
                      <ExternalLink className="h-3.5 w-3.5" /> Open {platformDef.label} and paste
                    </a>
                  )}
                </div>
                <p className="text-[11px] text-ink-400">Questions by {activity.generator.startsWith("gemini") ? "Gemini AI" : "the template generator"}, using only today&apos;s syllabus text.</p>
              </div>
            )}
          </section>

          <section className="panel p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Class list</h2>
              <span className="text-sm text-ink-500">
                {present.length}/{live.enrolled_count} present
              </span>
            </div>
            <ul className="mt-4 max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
              {live.roster.map((r) => (
                <li key={r.student_id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-ink-50">
                  <span className={clsx("flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold", r.present ? "bg-success-100 text-success-700" : "bg-ink-100 text-ink-400")}>
                    {r.present ? <Check className="h-3.5 w-3.5" /> : r.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">{r.name}</span>
                    <span className="block text-[11px] text-ink-400">{r.usn}</span>
                  </span>
                  {r.present && r.checked_in_at && <span className="text-[11px] text-ink-400">{new Date(r.checked_in_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <Dialog open={endOpen} onClose={() => setEndOpen(false)} title="End class">
        <p className="text-sm text-ink-600">Tick what you finished today. Anything left moves to the next class, and the AI writes notes for students.</p>
        <fieldset className="mt-4 space-y-2">
          <legend className="label">Topics covered</legend>
          {live.topics.map((t) => (
            <label key={t.chunk_id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-100 p-3 hover:bg-ink-50">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-brand-600"
                checked={covered.includes(t.chunk_id)}
                onChange={(e) => setCovered(e.target.checked ? [...covered, t.chunk_id] : covered.filter((c) => c !== t.chunk_id))}
              />
              <span className="text-sm font-medium text-ink-900">{t.title}</span>
            </label>
          ))}
        </fieldset>
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <label className="label mb-0" htmlFor="transcript">
              What you said (optional)
            </label>
            <button type="button" className={clsx("btn-ghost min-h-[32px] text-xs", recording && "text-critical-700")} onClick={toggleRecord} disabled={transcribing}>
              {transcribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className={clsx("h-3.5 w-3.5", recording && "animate-pulse")} />}
              {transcribing ? "Transcribing…" : recording ? "Stop recording" : "Record from mic"}
            </button>
          </div>
          <textarea
            id="transcript"
            rows={4}
            className="field mt-1.5"
            placeholder="A few lines about what you explained. Notes are built from the syllabus plus this."
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setEndOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={endClass} disabled={ending}>
            {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {ending ? "Writing notes…" : "End class and share notes"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
