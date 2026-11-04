"use client";

import { ArrowRight, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingCards, PageTitle, formatDay } from "@/components/app/ui";
import { app, useFetch } from "@/lib/app-api";

export default function NotesPage() {
  const { data, error, loading, reload } = useFetch(app.allNotes);
  const [course, setCourse] = useState("ALL");
  const courses = useMemo(() => [...new Set((data ?? []).map((n) => n.course_code))], [data]);
  const shown = (data ?? []).filter((n) => course === "ALL" || n.course_code === course);

  return (
    <>
      <PageTitle eyebrow="Learn" title="Class notes" subtitle="Written by AI after each class from the approved syllabus and what your teacher covered. Nothing from outside your syllabus." />
      {error && <ErrorState message={error} onRetry={() => reload()} />}
      {loading && !data && <LoadingCards />}
      {data && data.length === 0 && <EmptyState icon={<NotebookPen className="h-6 w-6" />} title="No notes yet" body="Notes appear here as soon as your teacher ends a class." />}
      {data && data.length > 0 && (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {["ALL", ...courses].map((c) => (
              <button key={c} type="button" onClick={() => setCourse(c)} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${course === c ? "border-ink-950 bg-ink-950 text-white" : "border-ink-200 bg-white hover:border-ink-400"}`}>
                {c === "ALL" ? "All courses" : c}
              </button>
            ))}
          </div>
          <div className="panel divide-y divide-ink-100">
            {shown.map((n) => (
              <Link key={n.session_id} href={`/student/notes/${n.session_id}`} className="group flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-4 hover:bg-ink-50">
                <span className="w-28 text-sm text-ink-500">{formatDay(n.scheduled_date)}</span>
                <span className="font-mono text-xs font-semibold text-brand-700">
                  {n.course_code} · S{n.session_number}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900">{n.topics.join(", ")}</span>
                <ArrowRight className="h-4 w-4 text-ink-400 transition group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
