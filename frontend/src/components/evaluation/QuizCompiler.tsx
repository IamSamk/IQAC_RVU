"use client";

import { ClipboardList, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Badge, Card, CardHeader, Notice } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import type { QuizDraft } from "@/types";

const TIMELINES = [
  { value: "WEEKLY", label: "Weekly (last 4 sessions)" },
  { value: "BIWEEKLY", label: "Biweekly (last 8 sessions)" },
  { value: "MONTHLY", label: "Monthly (last 16 sessions)" },
];

/** Agent 2: compiles a quiz from covered sessions, or an IQAC rubric mock test across CO1-CO4. */
export function QuizCompiler() {
  const [timeline, setTimeline] = useState("BIWEEKLY");
  const [draft, setDraft] = useState<QuizDraft | null>(null);
  const [busy, setBusy] = useState<"quiz" | "mock" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "quiz" | "mock") => {
    setBusy(kind);
    setError(null);
    const result = kind === "quiz" ? await api.compileQuiz(timeline) : await api.mockTest();
    if (result.data) setDraft(result.data);
    else setError(`Could not compile, because ${result.note ?? "the backend did not respond"}.`);
    setBusy(null);
  };

  return (
    <Card>
      <CardHeader
        title="Assessment compiler"
        description="Builds a quiz from the sessions actually covered, or an IQAC mock test that follows the CO and Bloom's rubric. Questions come only from the approved syllabus."
        action={<ClipboardList className="h-5 w-5 text-brand-600" aria-hidden />}
      />
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-slate-700">
          Timeline
          <select className="field mt-1 py-1.5" value={timeline} onChange={(e) => setTimeline(e.target.value)}>
            {TIMELINES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary" disabled={busy !== null} onClick={() => run("quiz")}>
          {busy === "quiz" && <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />}
          Compile quiz
        </button>
        <button type="button" className="btn-outline" disabled={busy !== null} onClick={() => run("mock")}>
          {busy === "mock" && <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />}
          IQAC mock test
        </button>
      </div>

      {error && (
        <div className="mt-3">
          <Notice tone="warning">{error}</Notice>
        </div>
      )}

      {draft && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="brand">{draft.timeline.replace(/_/g, " ")}</Badge>
            {draft.session_range && <span className="text-slate-700">Sessions {draft.session_range[0]}–{draft.session_range[1]}</span>}
            <span className="text-slate-700">· {draft.questions.length} questions · {draft.total_marks} marks</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {Object.entries(draft.co_split).map(([co, marks]) => (
              <Badge key={co}>
                {co}: {marks}
              </Badge>
            ))}
            {Object.entries(draft.blooms_split).map(([bloom, marks]) => (
              <Badge key={bloom} tone="teal">
                {bloom.toLowerCase()}: {marks}
              </Badge>
            ))}
          </div>
          <ol className="mt-3 space-y-2">
            {draft.questions.map((q, i) => (
              <li key={i} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-600">
                  <span>
                    Q{i + 1} · {q.topic}
                  </span>
                  <span>
                    {q.co} · {q.bloom.toLowerCase()} · {q.marks} marks
                  </span>
                </div>
                <p className="mt-1 text-slate-900">{q.question}</p>
                {q.options && q.options.length > 0 && <p className="mt-1 text-xs text-slate-600">Options: {q.options.join(" · ")}</p>}
                {q.answer && (
                  <details className="mt-1 text-xs text-slate-700">
                    <summary className="cursor-pointer text-brand-700">Answer key</summary>
                    {q.answer}
                  </details>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}
