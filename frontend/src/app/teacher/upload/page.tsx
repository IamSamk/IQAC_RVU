"use client";

import clsx from "clsx";
import { ArrowRight, Check, Download, FileText, Loader2, Network, Sparkles, UploadCloud, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { ErrorState, PageTitle } from "@/components/app/ui";
import { app } from "@/lib/app-api";
import { useSession } from "@/lib/session";
import type { UploadResult } from "@/types/app";

const STEPS = [
  { label: "Reading your file", at: 0 },
  { label: "AI is finding units and topics", at: 3 },
  { label: "Creating sections A, B and C", at: 18 },
  { label: "Planning every class to the last working day", at: 24 },
  { label: "Linking topics to students' other courses", at: 30 },
];
const SECTIONS = ["A", "B", "C"];

export default function UploadPage() {
  const { refreshCourses } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [semester, setSemester] = useState(5);
  const [ltp, setLtp] = useState({ l: 3, t: 0, p: 1 });
  const [sections, setSections] = useState<string[]>(["A", "B", "C"]);
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [lwd, setLwd] = useState("2026-12-18");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed((Date.now() - t0) / 1000), 250);
    return () => window.clearInterval(id);
  }, [busy]);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!/\.(pdf|docx|txt|md)$/i.test(f.name)) {
      setError("Please choose a PDF, Word (.docx) or text file.");
      return;
    }
    setError(null);
    setFile(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setElapsed(0);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("course_code", code);
    form.append("course_title", title);
    form.append("semester", String(semester));
    form.append("l", String(ltp.l));
    form.append("t", String(ltp.t));
    form.append("p", String(ltp.p));
    form.append("sections", sections.join(","));
    form.append("start_date", start);
    form.append("last_working_day", lwd);
    try {
      const res = await app.uploadSyllabus(form);
      setResult(res);
      await refreshCourses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <>
        <PageTitle
          eyebrow="Syllabus uploaded"
          title={
            <>
              {result.course.course_code} <span className="text-ink-400">·</span> {result.course.course_title}
            </>
          }
          subtitle={`Read by ${result.parse_engine.startsWith("gemini") ? "Gemini AI" : "the built-in parser"}: ${result.units.length} units and ${result.topics} topics, planned for ${result.sections.length} sections.`}
          actions={
            <>
              <Link href={`/teacher/courses/${result.course.course_id}`} className="btn-primary">
                Open the semester plan <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/teacher" className="btn-outline">
                Today&apos;s classes
              </Link>
            </>
          }
        />
        <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          <section className="panel p-6">
            <h2 className="font-display text-xl font-semibold">What the AI found</h2>
            <ol className="mt-4 space-y-3">
              {result.units.map((u) => (
                <li key={u.unit_number} className="flex items-center gap-3 rounded-xl border border-ink-100 px-4 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 font-mono text-sm font-semibold text-brand-700">{u.unit_number}</span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink-900">{u.title}</span>
                  <span className="text-xs text-ink-500">{u.topics} topics</span>
                </li>
              ))}
            </ol>
            {result.course_outcomes.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-semibold text-ink-900">Course outcomes</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
                  {result.course_outcomes.map((co) => (
                    <li key={co.co}>
                      <span className="mr-2 font-mono text-xs font-semibold text-brand-700">{co.co}</span>
                      {co.statement}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          <div className="space-y-5">
            <section className="panel p-6">
              <h2 className="font-display text-xl font-semibold">Sections</h2>
              <ul className="mt-4 space-y-2.5">
                {result.sections.map((s) => (
                  <li key={s.offering_id} className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3 text-sm">
                    <span className="font-semibold">Section {s.section}</span>
                    <span className="text-ink-500">
                      {s.students} students · {s.sessions} classes
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel p-6">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
                <Network className="h-5 w-5 text-gold-600" /> Links to other courses
              </h2>
              {result.bridges.length === 0 ? (
                <p className="mt-3 text-sm text-ink-500">No overlaps with your students&apos; other courses yet.</p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {result.bridges.slice(0, 5).map((b, i) => (
                    <li key={i} className="rounded-xl border border-gold-100 bg-gold-50 px-4 py-3 text-sm">
                      <span className="font-medium text-ink-900">{b.from}</span>
                      <span className="mx-1.5 text-gold-600">↔</span>
                      <span className="font-medium text-ink-900">{b.to}</span>
                      <span className="mt-1 block text-xs text-ink-500">{b.shared.join(" · ")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </>
    );
  }

  const stepIndex = STEPS.reduce((idx, s, i) => (elapsed >= s.at ? i : idx), 0);

  return (
    <>
      <PageTitle
        eyebrow="New course"
        title="Upload a syllabus"
        subtitle="The AI reads your syllabus exactly as written, splits it into class-sized topics, and plans every section. Nothing from outside your document is added."
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !busy && input.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
            className={clsx(
              "flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition",
              dragging ? "border-brand-500 bg-brand-50" : file ? "border-success-500/50 bg-white" : "border-ink-200 bg-white hover:border-brand-500/60 hover:bg-brand-50/40",
            )}
          >
            <input ref={input} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            {file ? (
              <>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-100 text-success-700">
                  <FileText className="h-7 w-7" />
                </span>
                <p className="mt-4 font-display text-xl font-semibold">{file.name}</p>
                <p className="mt-1 text-sm text-ink-500">{(file.size / 1024).toFixed(0)} KB · click to choose a different file</p>
                {!busy && (
                  <button
                    type="button"
                    className="btn-ghost mt-3 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                  >
                    <X className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </>
            ) : (
              <>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <UploadCloud className="h-7 w-7" />
                </span>
                <p className="mt-4 font-display text-xl font-semibold">Drop your syllabus here</p>
                <p className="mt-1 text-sm text-ink-500">PDF, Word (.docx) or text · up to 15 MB</p>
              </>
            )}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
            No syllabus handy? Try ours:
            <a href="/samples/CS310_Digital_Image_Processing_Syllabus.pdf" download className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
              <Download className="h-3.5 w-3.5" /> CS310 sample (PDF)
            </a>
            <a href="/samples/CS310_Digital_Image_Processing_Syllabus.docx" download className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
              <Download className="h-3.5 w-3.5" /> Word
            </a>
          </p>

          {busy && (
            <div className="panel mt-6 p-6 animate-fade-up">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <Sparkles className="h-4 w-4 text-gold-600" /> Working on it · {Math.round(elapsed)}s
              </div>
              <ol className="mt-4 space-y-3">
                {STEPS.map((s, i) => (
                  <li key={s.label} className="flex items-center gap-3 text-sm">
                    <span
                      className={clsx(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        i < stepIndex ? "bg-success-500 text-white" : i === stepIndex ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-400",
                      )}
                    >
                      {i < stepIndex ? <Check className="h-3.5 w-3.5" /> : i === stepIndex ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : i + 1}
                    </span>
                    <span className={i <= stepIndex ? "text-ink-900" : "text-ink-400"}>{s.label}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs text-ink-400">This usually takes 30–90 seconds.</p>
            </div>
          )}
          {error && (
            <div className="mt-6">
              <ErrorState message={error} />
            </div>
          )}
        </div>

        <div className="panel h-fit p-6">
          <h2 className="font-display text-xl font-semibold">Course details</h2>
          <p className="mt-1 text-sm text-ink-500">Leave code and title blank to use what the AI reads from the file.</p>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="code">
                Course code
              </label>
              <input id="code" className="field" placeholder="e.g. CS310" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="sem">
                Semester
              </label>
              <select id="sem" className="field" value={semester} onChange={(e) => setSemester(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    Semester {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="title">
                Course title
              </label>
              <input id="title" className="field" placeholder="Read from the file" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="col-span-2">
              <span className="label">Hours per week (Lecture : Tutorial : Practical)</span>
              <div className="flex items-center gap-2">
                {(["l", "t", "p"] as const).map((k, i) => (
                  <div key={k} className="flex items-center gap-2">
                    {i > 0 && <span className="text-ink-400">:</span>}
                    <input
                      aria-label={k.toUpperCase()}
                      type="number"
                      min={0}
                      max={5}
                      className="field w-16 text-center"
                      value={ltp[k]}
                      onChange={(e) => setLtp({ ...ltp, [k]: Math.max(0, Math.min(5, Number(e.target.value))) })}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <span className="label">Sections you teach</span>
              <div className="flex gap-2">
                {SECTIONS.map((s) => {
                  const on = sections.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSections(on ? sections.filter((x) => x !== s) : [...sections, s].sort())}
                      className={clsx("h-11 w-14 rounded-xl border text-sm font-semibold transition", on ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 bg-white text-ink-700 hover:border-brand-500")}
                      aria-pressed={on}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-ink-500">Students in these sections are enrolled automatically. A meets at 9 AM, B at 11 AM, C at 2 PM.</p>
            </div>
            <div>
              <label className="label" htmlFor="start">
                First class
              </label>
              <input id="start" type="date" className="field" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="lwd">
                Last working day
              </label>
              <input id="lwd" type="date" className="field" value={lwd} onChange={(e) => setLwd(e.target.value)} />
            </div>
          </div>
          <button type="button" className="btn-primary btn-lg mt-6 w-full" disabled={!file || busy || sections.length === 0} onClick={submit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Building your course…" : "Read syllabus and plan the semester"}
          </button>
        </div>
      </div>
    </>
  );
}
