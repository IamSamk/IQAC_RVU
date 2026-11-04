"use client";

import { BookOpen, FileUp, Users } from "lucide-react";
import Link from "next/link";
import { EmptyState, ErrorState, LoadingCards, PageTitle, ProgressBar } from "@/components/app/ui";
import { app, useFetch } from "@/lib/app-api";

export default function CoursesPage() {
  const { data, error, loading, reload } = useFetch(app.teacherHome);
  return (
    <>
      <PageTitle
        eyebrow="Teaching"
        title="My courses"
        subtitle="Every course you teach, with each section's progress through the semester plan."
        actions={
          <Link href="/teacher/upload" className="btn-primary">
            <FileUp className="h-4 w-4" /> Add a course
          </Link>
        }
      />
      {error && <ErrorState message={error} onRetry={() => reload()} />}
      {loading && !data && <LoadingCards count={2} />}
      {data && data.courses.length === 0 && (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="No courses yet"
          body="Upload a syllabus to create your first course."
          action={
            <Link href="/teacher/upload" className="btn-primary">
              Upload a syllabus
            </Link>
          }
        />
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {data?.courses.map((c) => {
          const done = c.sections.reduce((a, s) => a + s.sessions_done, 0);
          const total = c.sections.reduce((a, s) => a + s.sessions_total, 0);
          const students = c.sections.reduce((a, s) => a + s.students, 0);
          return (
            <Link key={c.course_id} href={`/teacher/courses/${c.course_id}`} className="panel group p-6 transition hover:-translate-y-0.5 hover:shadow-lift">
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-xs font-semibold text-brand-700">{c.course_code}</span>
                {c.uploaded && <span className="chip">From your upload</span>}
              </div>
              <h2 className="mt-2 font-display text-2xl font-semibold leading-snug">{c.course_title}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-500">
                <span className="chip">Semester {c.semester}</span>
                <span className="chip">L:T:P {c.ltp}</span>
                <span className="chip">
                  <Users className="h-3 w-3" /> {students} students
                </span>
              </div>
              <div className="mt-5">
                <div className="mb-1.5 flex justify-between text-xs text-ink-500">
                  <span>{c.sections.map((s) => `Sec ${s.section}`).join(" · ")}</span>
                  <span>
                    {done}/{total} classes held
                  </span>
                </div>
                <ProgressBar value={done} max={total} />
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
