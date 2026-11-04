"use client";

import clsx from "clsx";
import { ArrowRight, BookOpen, Check, CheckCircle2, Clock, Loader2, Network, NotebookPen, Radio, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { EmptyState, ErrorState, LoadingCards, PageTitle, ProgressBar, StatusPill, formatDay, greeting } from "@/components/app/ui";
import { app, useFetch, usePolling } from "@/lib/app-api";
import { useSession } from "@/lib/session";
import type { ClassCard, MyActivity } from "@/types/app";

/** One numeric field drawn as four boxes, so fast typing and paste both work. */
function CodeInput({ onSubmit, busy }: { onSubmit: (code: string) => void; busy: boolean }) {
  const [code, setCode] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const change = (v: string) => {
    const next = v.replace(/\D/g, "").slice(0, 4);
    setCode(next);
    if (next.length === 4) onSubmit(next);
  };
  return (
    <div className="flex items-center gap-3">
      <label className="relative block cursor-text" onClick={() => ref.current?.focus()}>
        <span className="sr-only">Attendance code</span>
        <span className="flex gap-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={clsx(
                "flex h-16 w-14 items-center justify-center rounded-2xl border-2 bg-white/10 font-mono text-3xl font-semibold text-white transition",
                i === Math.min(code.length, 3) && !busy ? "border-gold-500" : "border-white/20",
              )}
            >
              {code[i] ?? ""}
            </span>
          ))}
        </span>
        <input
          ref={ref}
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="Attendance code"
          value={code}
          disabled={busy}
          onChange={(e) => change(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
        />
      </label>
      {busy && <Loader2 className="h-6 w-6 animate-spin text-gold-500" />}
    </div>
  );
}

function LiveActivity({ sessionId }: { sessionId: string }) {
  const { data, reload } = useFetch<MyActivity>(() => app.myActivity(sessionId), [sessionId]);
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [done, setDone] = useState(false);
  usePolling(() => void reload(true), 5000, !data?.questions?.length);

  if (!data?.questions?.length) {
    return (
      <div className="mt-5 rounded-2xl bg-white/5 p-4 text-sm text-ink-300">
        <Sparkles className="mr-2 inline h-4 w-4 text-gold-500" /> When your teacher starts an activity, your question appears here.
      </div>
    );
  }
  return (
    <div className="mt-5 rounded-2xl bg-white p-5 text-ink-900 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="eyebrow">Your question · set {data.set_number} of {data.total_sets}</div>
        <span className="chip">Only you have this version</span>
      </div>
      <ol className="mt-3 space-y-4">
        {data.questions.map((q, i) => (
          <li key={i}>
            <p className="text-[15px] font-medium leading-relaxed">{q.question}</p>
            {q.options && q.options.length > 0 ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {q.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    disabled={done}
                    onClick={() => setPicked({ ...picked, [i]: o })}
                    className={clsx("rounded-xl border px-3 py-2 text-left text-sm transition", picked[i] === o ? "border-brand-600 bg-brand-50 font-medium text-brand-800" : "border-ink-200 hover:border-brand-500")}
                  >
                    {o}
                  </button>
                ))}
              </div>
            ) : (
              <input className="field mt-2" placeholder="Your answer" disabled={done} onChange={(e) => setPicked({ ...picked, [i]: e.target.value })} />
            )}
          </li>
        ))}
      </ol>
      <button type="button" className="btn-primary mt-4" disabled={done} onClick={() => setDone(true)}>
        {done ? <Check className="h-4 w-4" /> : null}
        {done ? "Submitted" : "Submit answers"}
      </button>
    </div>
  );
}

function LiveClassBanner({ c, onCheckedIn }: { c: ClassCard; onCheckedIn: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const checkIn = async (code: string) => {
    setBusy(true);
    setError(null);
    try {
      await app.attend(c.session_id, code);
      onCheckedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
      setAttempt((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="relative mb-8 overflow-hidden rounded-3xl bg-ink-950 p-6 text-white shadow-lift sm:p-8 animate-fade-up">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-700/40 blur-3xl" aria-hidden />
      <div className="relative">
        <div className="flex items-center gap-2 text-sm font-semibold text-critical-100">
          <span className="h-2 w-2 rounded-full bg-critical-600 animate-live-dot" /> Class is live
        </div>
        <h2 className="mt-2 font-display text-3xl font-semibold text-white">
          {c.course_code} · {c.topics[0]?.title ?? c.course_title}
        </h2>
        <p className="mt-1 text-sm text-ink-300">
          {c.teacher} · Section {c.section} · {c.time}
        </p>
        {c.attended ? (
          <>
            <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-success-500/20 px-4 py-2 text-sm font-semibold text-success-100">
              <CheckCircle2 className="h-4 w-4" /> You&apos;re checked in
            </div>
            <LiveActivity sessionId={c.session_id} />
          </>
        ) : (
          <div className="mt-6">
            <div className="mb-2 text-sm text-ink-300">Enter the code on your teacher&apos;s screen</div>
            <CodeInput key={attempt} onSubmit={checkIn} busy={busy} />
            {error && <p className="mt-3 text-sm text-critical-100">{error}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

export default function StudentHomePage() {
  const { user } = useSession();
  const { data, error, loading, reload } = useFetch(app.studentHome);
  const liveClass = data?.todays_classes.find((c) => c.status === "IN_PROGRESS");
  usePolling(() => void reload(true), 6000, !!data);
  const others = data?.todays_classes.filter((c) => c !== liveClass) ?? [];

  return (
    <>
      <PageTitle
        eyebrow={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        title={
          <>
            {greeting()}, <span className="text-brand-700">{user?.full_name.split(" ")[0]}</span>
          </>
        }
        subtitle="Check in to class, answer your own version of the activity, and read notes the moment class ends."
      />
      {error && <ErrorState message={error} onRetry={() => reload()} />}
      {loading && !data && <LoadingCards />}

      {data && (
        <>
          {liveClass && <LiveClassBanner c={liveClass} onCheckedIn={() => reload(true)} />}

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <div className="space-y-8">
              <section>
                <h2 className="mb-4 font-display text-2xl font-semibold">Today</h2>
                {others.length === 0 && !liveClass ? (
                  <div className="panel px-5 py-4 text-sm text-ink-500">No classes today.</div>
                ) : (
                  <div className="panel divide-y divide-ink-100">
                    {others.map((c) => (
                      <div key={c.session_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                        <span className="inline-flex w-20 items-center gap-1.5 text-sm text-ink-500">
                          <Clock className="h-4 w-4" />
                          {c.time}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-xs font-semibold text-brand-700">{c.course_code}</div>
                          <div className="truncate text-sm font-medium text-ink-900">{c.topics.map((t) => t.title).join(", ")}</div>
                        </div>
                        {c.status === "COMPLETED" ? (
                          <Link href={`/student/notes/${c.session_id}`} className="btn-outline min-h-[34px] py-1 text-xs">
                            <NotebookPen className="h-3.5 w-3.5" /> Notes
                          </Link>
                        ) : (
                          <StatusPill status={c.status} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="font-display text-2xl font-semibold">Latest notes</h2>
                  <Link href="/student/notes" className="text-sm font-medium text-brand-700 hover:underline">
                    All notes
                  </Link>
                </div>
                {data.recent_notes.length === 0 ? (
                  <EmptyState icon={<NotebookPen className="h-6 w-6" />} title="No notes yet" body="Notes appear here as soon as your teacher ends a class." />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.recent_notes.slice(0, 6).map((n) => (
                      <Link key={n.session_id} href={`/student/notes/${n.session_id}`} className="panel group p-4 transition hover:shadow-lift">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-brand-700">
                            {n.course_code} · S{n.session_number}
                          </span>
                          <span className="text-xs text-ink-400">{formatDay(n.date)}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm font-medium text-ink-900">{n.topics.join(", ")}</p>
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-700 group-hover:underline">
                          Read <ArrowRight className="h-3 w-3" />
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-6">
              <Link href="/knowledge-graph" className="group block overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-brand-950 p-6 text-white shadow-lift">
                <Network className="h-7 w-7 text-gold-500" />
                <h3 className="mt-4 font-display text-2xl font-semibold text-white">See how your subjects connect</h3>
                <p className="mt-1.5 text-sm text-brand-100">Your courses as one map, with the links between them and the topics to revise.</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-500 group-hover:gap-2.5">
                  Open knowledge graph <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
              <section className="panel p-5">
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                  <BookOpen className="h-5 w-5 text-brand-600" /> My courses
                </h2>
                <ul className="mt-4 space-y-4">
                  {data.courses.map((c) => (
                    <li key={c.course_id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-medium text-ink-900">
                          <span className="font-mono text-xs text-brand-700">{c.course_code}</span> {c.course_title}
                        </span>
                        <span className="shrink-0 text-xs text-ink-500">
                          {c.attended}/{c.sessions_done} attended
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <ProgressBar value={c.sessions_done} max={c.sessions_total} tone="success" />
                      </div>
                      <div className="mt-1 text-[11px] text-ink-400">
                        {c.teacher} · Sec {c.section} · {c.category.toLowerCase()}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
              {liveClass && !liveClass.attended && (
                <div className="flex items-center gap-2 rounded-2xl bg-critical-100 px-4 py-3 text-sm font-medium text-critical-700">
                  <Radio className="h-4 w-4" /> {liveClass.course_code} is live. Check in above.
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </>
  );
}
