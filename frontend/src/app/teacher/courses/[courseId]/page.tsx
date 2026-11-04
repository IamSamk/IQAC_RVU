"use client";

import clsx from "clsx";
import { ArrowLeft, Brain, CalendarRange, Clock, FileText, Play, Target } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ErrorState, LoadingCards, PageTitle, ProgressBar, StatusPill, formatDay } from "@/components/app/ui";
import { app, useFetch } from "@/lib/app-api";

const BLOOM_TONE: Record<string, string> = {
  UNDERSTAND: "bg-sky-50 text-sky-700",
  APPLY: "bg-brand-50 text-brand-700",
  ANALYZE: "bg-gold-50 text-gold-700",
  CREATE: "bg-success-100 text-success-700",
};

function AttentionStrip({ dip, splits }: { dip: number; splits: { start: number; end: number }[] }) {
  return (
    <div>
      <div className="relative h-8 overflow-hidden rounded-lg bg-ink-100">
        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-success-500/30 via-gold-500/20 to-critical-600/20" style={{ width: "100%" }} />
        {splits.map((s) => (
          <div key={s.start} className="absolute inset-y-0 bg-brand-600/80" style={{ left: `${(s.start / 60) * 100}%`, width: `${((s.end - s.start) / 60) * 100}%` }} title={`Activity ${s.start}-${s.end} min`} />
        ))}
        <div className="absolute inset-y-0 w-0.5 bg-critical-600" style={{ left: `${(dip / 60) * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-ink-400">
        <span>0 min</span>
        <span className="text-critical-700">Focus dips at {dip} min</span>
        <span>60 min</span>
      </div>
    </div>
  );
}

export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data, error, loading, reload } = useFetch(() => app.course(courseId), [courseId]);
  const [sec, setSec] = useState(0);
  const [tab, setTab] = useState<"plan" | "syllabus">("plan");

  if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (loading || !data) return <LoadingCards count={3} />;

  const { course } = data;
  const section = data.sections[sec];
  const nextIdx = section?.sessions.findIndex((s) => s.status === "SCHEDULED" || s.status === "IN_PROGRESS") ?? -1;

  return (
    <>
      <Link href="/teacher/courses" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> My courses
      </Link>
      <PageTitle
        eyebrow={`${course.course_code} · Semester ${course.semester} · L:T:P ${course.l_ratio}:${course.t_ratio}:${course.p_ratio}`}
        title={course.course_title}
        subtitle={
          data.upload ? (
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Planned from {data.upload.file_name} · read by {data.upload.parse_engine.startsWith("gemini") ? "Gemini AI" : "the built-in parser"}
            </span>
          ) : (
            "Semester plan for each section, built from the approved syllabus."
          )
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-ink-100 p-1">
          {(["plan", "syllabus"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={clsx("rounded-lg px-4 py-1.5 text-sm font-medium transition", tab === t ? "bg-white text-ink-950 shadow-card" : "text-ink-500 hover:text-ink-900")}>
              {t === "plan" ? "Semester plan" : "Syllabus & outcomes"}
            </button>
          ))}
        </div>
        {tab === "plan" && data.sections.length > 1 && (
          <div className="flex gap-2">
            {data.sections.map((s, i) => (
              <button key={s.offering_id} type="button" onClick={() => setSec(i)} className={clsx("rounded-xl border px-4 py-2 text-sm font-semibold transition", i === sec ? "border-ink-950 bg-ink-950 text-white" : "border-ink-200 bg-white hover:border-ink-400")}>
                Section {s.section}
                <span className={clsx("ml-2 text-xs font-normal", i === sec ? "text-ink-300" : "text-ink-400")}>{s.time}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "plan" && section && (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="panel overflow-hidden">
            <div className="grid grid-cols-[64px_120px_1fr_120px] gap-3 border-b border-ink-100 bg-ink-50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-500 max-md:hidden">
              <span>#</span>
              <span>Date</span>
              <span>Topics</span>
              <span className="text-right">Status</span>
            </div>
            <ol className="divide-y divide-ink-100">
              {section.sessions.map((s, i) => {
                const special = s.session_type !== "REGULAR_CLASS";
                const isNext = i === nextIdx;
                return (
                  <li key={s.session_id} className={clsx("grid gap-x-3 gap-y-1 px-5 py-3.5 md:grid-cols-[64px_120px_1fr_120px] md:items-center", isNext && "bg-brand-50/60")}>
                    <span className="font-mono text-sm text-ink-500">S{s.session_number}</span>
                    <span className="text-sm font-medium text-ink-800">{formatDay(s.date)}</span>
                    <span className="min-w-0 text-sm text-ink-700">
                      {special ? (
                        <span className="chip border-gold-100 bg-gold-50 text-gold-700">{s.session_type.replace(/_/g, " ").toLowerCase()}</span>
                      ) : (
                        <span className="line-clamp-2">{s.topics.join(" · ") || "—"}</span>
                      )}
                      {s.duration > 90 && <span className="chip ml-2">Lab</span>}
                    </span>
                    <span className="flex items-center gap-2 md:justify-end">
                      {isNext ? (
                        <Link href={`/teacher/class/${s.session_id}`} className="btn-primary min-h-[32px] px-3 py-1 text-xs">
                          <Play className="h-3.5 w-3.5" /> Open
                        </Link>
                      ) : s.status === "COMPLETED" ? (
                        <Link href={`/teacher/class/${s.session_id}`} className="text-xs font-medium text-success-700 hover:underline">
                          Done · notes
                        </Link>
                      ) : (
                        <StatusPill status={s.status} />
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          <aside className="space-y-5">
            <div className="panel p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CalendarRange className="h-4 w-4 text-brand-600" /> Progress
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <div className="mb-1 flex justify-between text-ink-500">
                    <span>Classes held</span>
                    <span>
                      {section.progress.sessions_completed}/{section.progress.sessions_total}
                    </span>
                  </div>
                  <ProgressBar value={section.progress.sessions_completed} max={section.progress.sessions_total} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-ink-500">
                    <span>Topics covered</span>
                    <span>
                      {section.progress.chunks_covered}/{section.progress.chunks_total}
                    </span>
                  </div>
                  <ProgressBar value={section.progress.chunks_covered} max={section.progress.chunks_total} tone="success" />
                </div>
                <p className="text-xs text-ink-500">Last working day {formatDay(course.last_working_day)}. If a class runs over, later classes shift automatically.</p>
              </div>
            </div>
            <div className="panel p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Brain className="h-4 w-4 text-brand-600" /> Attention for Section {section.section}
              </div>
              <p className="mt-1 text-xs text-ink-500">
                <Clock className="mr-1 inline h-3 w-3" />
                {section.time} class. Purple blocks are the activity breaks planned into every lecture.
              </p>
              <div className="mt-4">
                <AttentionStrip dip={section.dip_minute} splits={section.activity_splits} />
              </div>
            </div>
          </aside>
        </div>
      )}

      {tab === "syllabus" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            {data.units.map((u) => (
              <section key={u.unit_number} className="panel p-6">
                <div className="eyebrow">Unit {u.unit_number}</div>
                <ol className="mt-3 space-y-3">
                  {u.topics.map((t) => (
                    <li key={t.chunk_id} className="rounded-xl border border-ink-100 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="mr-auto text-[15px] font-semibold text-ink-950">{t.topic_title}</h3>
                        <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold", BLOOM_TONE[t.bloom_level] ?? "bg-ink-100 text-ink-700")}>{t.bloom_level.toLowerCase()}</span>
                        <span className="chip">{t.co_mapping}</span>
                        <span className="chip">{t.ltp_type === "P" ? "Lab" : `${t.estimated_minutes} min`}</span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{t.syllabus_content}</p>
                      {t.canonical_keywords.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {t.canonical_keywords.map((k) => (
                            <span key={k} className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[11px] text-ink-500">
                              {k}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
          <aside className="panel h-fit p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Target className="h-4 w-4 text-brand-600" /> Course outcomes
            </div>
            {course.course_outcomes && course.course_outcomes.length > 0 ? (
              <ul className="mt-3 space-y-2.5 text-sm text-ink-700">
                {course.course_outcomes.map((co) => (
                  <li key={co.co}>
                    <span className="mr-1.5 font-mono text-xs font-semibold text-brand-700">{co.co}</span>
                    {co.statement}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-500">This syllabus did not list course outcomes. Topics are mapped to CO1–CO5 by unit.</p>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
