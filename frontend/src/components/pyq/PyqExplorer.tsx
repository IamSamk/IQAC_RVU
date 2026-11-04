"use client";

import { Ban, CheckCircle2, ChevronDown, GitCompareArrows, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Card, CardHeader, PageHeader, StatTile } from "@/components/ui/primitives";
import { api, useResource } from "@/lib/api";
import { fallbackPyq } from "@/lib/fallback/pyq";
import type { PyqQuestion } from "@/types";

const SIMILARITY_THRESHOLD = 0.85;

function TopicColumn({ title, topics, tone }: { title: string; topics: string[]; tone: "success" | "brand" | "critical" }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Badge tone={tone}>{topics.length}</Badge>
        {title}
      </div>
      <ul className="mt-2 space-y-1 text-sm text-slate-700">
        {topics.map((topic) => (
          <li key={topic}>{topic}</li>
        ))}
      </ul>
    </div>
  );
}

function QuestionCard({ question }: { question: PyqQuestion }) {
  return (
    <li className="rounded-lg border border-emerald-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="success">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Similarity {question.similarity.toFixed(2)}
        </Badge>
        {question.mapped_unit && <Badge tone="brand">{question.mapped_unit}</Badge>}
        {question.co_code && <Badge>{question.co_code}</Badge>}
        <span className="ml-auto text-xs text-slate-600">
          {question.origin_course_code} {question.exam_year} {question.exam_type} · {question.marks} marks
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-900">{question.question_text}</p>
    </li>
  );
}

export function PyqExplorer() {
  const { data } = useResource(api.getPyq, fallbackPyq);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [examType, setExamType] = useState("all");

  const valid = useMemo(() => data.questions.filter((question) => question.status === "VALID"), [data]);
  const blocked = useMemo(() => data.questions.filter((question) => question.status !== "VALID"), [data]);
  const years = useMemo(() => [...new Set(valid.map((question) => question.exam_year))].sort((a, b) => b - a), [valid]);
  const examTypes = useMemo(() => [...new Set(valid.map((question) => question.exam_type))].sort(), [valid]);

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return valid
      .filter((question) => year === "all" || String(question.exam_year) === year)
      .filter((question) => examType === "all" || question.exam_type === examType)
      .filter((question) => !term || question.question_text.toLowerCase().includes(term))
      .sort((a, b) => b.similarity - a.similarity);
  }, [valid, query, year, examType]);

  return (
    <>
      <PageHeader
        title="Syllabus-Diffed PYQ Engine"
        description={`Past questions from ${data.predecessor_code} are matched against the revised ${data.course_code} syllabus, so juniors only practise what can still be asked.`}
      />

      <Card>
        <CardHeader
          title={`${data.predecessor_code} (2024 Image Processing) to ${data.course_code} (2026 Computer Vision)`}
          description={`Mapping approved by ${data.approved_by}.`}
          action={<GitCompareArrows className="h-5 w-5 text-brand-600" aria-hidden />}
        />
        <div className="grid gap-4 md:grid-cols-[10rem_1fr_1fr_1fr]">
          <StatTile label="Syllabus overlap" value={`${data.overlap_percent}%`} hint="Course Lead approved" />
          <TopicColumn title="Retained" topics={data.retained_topics} tone="success" />
          <TopicColumn title="New in 2026" topics={data.added_topics} tone="brand" />
          <TopicColumn title="Deprecated" topics={data.deprecated_topics} tone="critical" />
        </div>
      </Card>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_9rem_9rem]">
        <label className="relative block">
          <span className="sr-only">Search questions</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search questions" className="field min-h-[40px] pl-9" />
        </label>
        <label>
          <span className="sr-only">Exam year</span>
          <select className="field min-h-[40px]" value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="all">All years</option>
            {years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Exam type</span>
          <select className="field min-h-[40px]" value={examType} onChange={(event) => setExamType(event.target.value)}>
            <option value="all">All exams</option>
            {examTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <h2 className="mt-4 text-sm font-semibold" aria-live="polite">
        {shown.length} questions match the current syllabus (similarity at or above {SIMILARITY_THRESHOLD})
      </h2>
      {shown.length > 0 ? (
        <ul className="mt-2 grid gap-2 lg:grid-cols-2">
          {shown.map((question) => (
            <QuestionCard key={question.pyq_id} question={question} />
          ))}
        </ul>
      ) : (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <p className="text-slate-700">No questions match these filters.</p>
          <button
            type="button"
            className="btn-outline mt-2"
            onClick={() => {
              setQuery("");
              setYear("all");
              setExamType("all");
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      <details className="group mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-critical-700 [&::-webkit-details-marker]:hidden">
          <Ban className="h-4 w-4" aria-hidden />
          Blocked Outdated Syllabus Questions ({blocked.length} Excluded)
          <ChevronDown className="ml-auto h-4 w-4 transition-transform duration-150 group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="mt-3 space-y-2">
          {blocked.map((question) => (
            <li key={question.pyq_id} className="rounded-lg border border-red-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="critical">Similarity {question.similarity.toFixed(2)}</Badge>
                <span className="text-xs text-slate-600">
                  {question.origin_course_code} {question.exam_year} {question.exam_type}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600 line-through decoration-slate-400">{question.question_text}</p>
              {question.deprecated_reason && <p className="mt-1 text-xs font-medium text-critical-700">{question.deprecated_reason}</p>}
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
