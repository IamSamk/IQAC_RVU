"use client";

import { ArrowLeft, Network, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ErrorState, LoadingCards, Prose, formatDay } from "@/components/app/ui";
import { app, useFetch } from "@/lib/app-api";

export default function NoteDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { data, error, loading, reload } = useFetch(() => app.notes(sessionId), [sessionId]);

  if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (loading || !data) return <LoadingCards count={1} />;

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/student/notes" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 print:hidden">
        <ArrowLeft className="h-4 w-4" /> All notes
      </Link>
      <div className="eyebrow">
        {data.course_code} · Session {data.session_number} · {formatDay(data.scheduled_date)}
      </div>
      <h1 className="mt-2 font-display text-[2.4rem] font-semibold leading-tight tracking-tight">{data.topics.join(" · ") || data.course_title}</h1>
      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
        <button type="button" className="btn-outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print or save as PDF
        </button>
        <Link href="/knowledge-graph" className="btn-outline">
          <Network className="h-4 w-4" /> See it on your knowledge graph
        </Link>
      </div>
      <div className="panel mt-8 p-6 sm:p-10">
        {data.generated_class_notes_md ? <Prose source={data.generated_class_notes_md} className="prose-base" /> : <p className="text-ink-500">Notes for this class are not ready yet.</p>}
      </div>
    </article>
  );
}
