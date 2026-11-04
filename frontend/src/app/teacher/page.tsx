"use client";

import { ArrowRight, CalendarDays, Clock, Download, FileUp, Play, Radio, Users } from "lucide-react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingCards, PageTitle, ProgressBar, StatusPill, formatDay, greeting } from "@/components/app/ui";
import { app, useFetch } from "@/lib/app-api";
import { useSession } from "@/lib/session";
import type { ClassCard } from "@/types/app";

function TodayCard({ c }: { c: ClassCard }) {
  const live = c.status === "IN_PROGRESS";
  return (
    <Link
      href={`/teacher/class/${c.session_id}`}
      className={`group panel relative flex flex-col overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-lift ${live ? "ring-2 ring-critical-600/40" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-brand-700">
          {c.course_code} · Section {c.section}
        </span>
        <StatusPill status={c.status} />
      </div>
      <h3 className="mt-3 font-display text-xl font-semibold leading-snug">{c.topics[0]?.title ?? "Class"}</h3>
      {c.topics.length > 1 && <p className="mt-1 text-sm text-ink-500">+ {c.topics.slice(1).map((t) => t.title).join(", ")}</p>}
      <div className="mt-4 flex items-center gap-4 text-sm text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-4 w-4" /> {c.time}
        </span>
        <span>Session {c.session_number}</span>
        {c.ltp === "P" && <span className="chip">Lab</span>}
      </div>
      <span className={`mt-5 inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${live ? "bg-critical-600 text-white" : "bg-ink-950 text-white group-hover:bg-brand-600"}`}>
        {live ? <Radio className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {live ? `Back to class · code ${c.attendance_code}` : "Open class"}
      </span>
    </Link>
  );
}

export default function TeacherHomePage() {
  const { user } = useSession();
  const { data, error, loading, reload } = useFetch(app.teacherHome);

  return (
    <>
      <PageTitle
        eyebrow={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        title={
          <>
            {greeting()}, <span className="text-brand-700">{user?.full_name}</span>
          </>
        }
        subtitle="Your classes for today, ready to run. Each one has an AI lesson plan, an attendance code and timed activity breaks."
        actions={
          <Link href="/teacher/upload" className="btn-primary">
            <FileUp className="h-4 w-4" /> Upload syllabus
          </Link>
        }
      />

      {error && <ErrorState message={error} onRetry={() => reload()} />}
      {loading && !data && <LoadingCards />}

      {data && data.courses.length === 0 && (
        <EmptyState
          icon={<FileUp className="h-6 w-6" />}
          title="Start by uploading a syllabus"
          body="Drop in your course syllabus (PDF, Word or text). The AI reads the units and topics, sets up sections A, B and C, and plans every class up to the last working day."
          action={
            <>
              <Link href="/teacher/upload" className="btn-primary btn-lg">
                <FileUp className="h-4 w-4" /> Upload a syllabus
              </Link>
              <a href="/samples/CS310_Digital_Image_Processing_Syllabus.pdf" download className="btn-outline btn-lg">
                <Download className="h-4 w-4" /> Get a sample syllabus
              </a>
            </>
          }
        />
      )}

      {data && data.courses.length > 0 && (
        <div className="space-y-12">
          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-2xl font-semibold">Today</h2>
              <span className="text-sm text-ink-500">{data.todays_classes.length} classes</span>
            </div>
            {data.todays_classes.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.todays_classes.map((c) => (
                  <TodayCard key={c.session_id} c={c} />
                ))}
              </div>
            ) : (
              <div className="panel flex items-center gap-3 px-5 py-4 text-sm text-ink-500">
                <CalendarDays className="h-5 w-5 text-ink-400" /> No classes scheduled today. Your next ones are below.
              </div>
            )}
          </section>

          {data.upcoming.length > 0 && (
            <section>
              <h2 className="mb-4 font-display text-2xl font-semibold">Coming up</h2>
              <div className="panel divide-y divide-ink-100">
                {data.upcoming.map((c) => (
                  <Link key={c.session_id} href={`/teacher/class/${c.session_id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-ink-50">
                    <span className="w-28 text-sm font-medium text-ink-900">{formatDay(c.date)}</span>
                    <span className="w-20 text-sm text-ink-500">{c.time}</span>
                    <span className="font-mono text-xs font-semibold text-brand-700">
                      {c.course_code} · {c.section}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-700">{c.topics.map((t) => t.title).join(", ")}</span>
                    <ArrowRight className="h-4 w-4 text-ink-400" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-2xl font-semibold">Your courses</h2>
              <Link href="/teacher/courses" className="text-sm font-medium text-brand-700 hover:underline">
                See all
              </Link>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {data.courses.map((c) => (
                <Link key={c.course_id} href={`/teacher/courses/${c.course_id}`} className="panel group p-5 transition hover:shadow-lift">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-mono text-xs font-semibold text-brand-700">{c.course_code}</span>
                      <h3 className="mt-1 font-display text-xl font-semibold leading-snug">{c.course_title}</h3>
                    </div>
                    <span className="chip shrink-0">L:T:P {c.ltp}</span>
                  </div>
                  <div className="mt-5 space-y-3">
                    {c.sections.map((s) => (
                      <div key={s.offering_id} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-sm">
                        <span className="font-medium text-ink-800">Section {s.section}</span>
                        <ProgressBar value={s.sessions_done} max={s.sessions_total} />
                        <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                          <Users className="h-3.5 w-3.5" /> {s.students} · {s.sessions_done}/{s.sessions_total}
                        </span>
                      </div>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
