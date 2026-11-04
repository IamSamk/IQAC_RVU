"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type {
  ActivityResponse,
  AttentionModel,
  CopilotTask,
  DataSource,
  KnowledgeGraph,
  OcrEvaluation,
  PacingPlan,
  PyqResult,
} from "@/types";
import { fallbackAttentionModel } from "./attention";
import { buildActivity } from "./fallback/activity";
import { fallbackTasks } from "./fallback/copilot";
import { fallbackGraph } from "./fallback/knowledgeGraph";
import { fallbackEvaluation } from "./fallback/ocr";
import { fallbackPacing } from "./fallback/pacing";
import { fallbackPyq } from "./fallback/pyq";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
const TIMEOUT_MS = 3000;

const ids = {
  offering: process.env.NEXT_PUBLIC_DEMO_OFFERING_ID || "demo-offering-cs304",
  session: process.env.NEXT_PUBLIC_DEMO_SESSION_ID || "demo-session-12",
  student: process.env.NEXT_PUBLIC_DEMO_STUDENT_ID || "demo-student-aarav",
  faculty: process.env.NEXT_PUBLIC_DEMO_FACULTY_ID || "demo-faculty-darshan",
  course: process.env.NEXT_PUBLIC_DEMO_COURSE_ID || "demo-course-cs304",
  evaluation: process.env.NEXT_PUBLIC_DEMO_EVAL_ID || "demo-eval-ia1",
};

export interface ApiResult<T> {
  data: T;
  source: DataSource;
}

type Guard<T> = (value: unknown) => value is T;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasArrays = (value: unknown, ...keys: string[]) =>
  isRecord(value) && keys.every((key) => Array.isArray(value[key]));

const isPacing: Guard<PacingPlan> = (v): v is PacingPlan =>
  hasArrays(v, "sessions", "milestones") && typeof (v as Record<string, unknown>).course_code === "string";
const isAttention: Guard<AttentionModel> = (v): v is AttentionModel =>
  hasArrays(v, "t", "passive_curve", "active_intervened_curve", "strata_curves") &&
  typeof (v as Record<string, unknown>).dip_trigger_minute === "number";
const isGraph: Guard<KnowledgeGraph> = (v): v is KnowledgeGraph => hasArrays(v, "nodes", "edges");
const isPyq: Guard<PyqResult> = (v): v is PyqResult =>
  hasArrays(v, "questions", "retained_topics", "added_topics", "deprecated_topics");
const isEvaluation: Guard<OcrEvaluation> = (v): v is OcrEvaluation =>
  hasArrays(v, "cells") && typeof (v as Record<string, unknown>).eval_id === "string";
const isActivity: Guard<ActivityResponse> = (v): v is ActivityResponse =>
  hasArrays(v, "question_sets_json") && (v as { question_sets_json: unknown[] }).question_sets_json.length > 0;
const isTasks: Guard<CopilotTask[]> = (v): v is CopilotTask[] => Array.isArray(v);
const isAnything: Guard<unknown> = (v): v is unknown => v !== undefined;

async function call<T>(path: string, init: RequestInit, fallback: T, guard: Guard<T>): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${API_URL}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return { data: fallback, source: "demo" };
    const text = await response.text();
    const body: unknown = text ? JSON.parse(text) : {};
    return guard(body) ? { data: body, source: "live" } : { data: fallback, source: "demo" };
  } catch {
    return { data: fallback, source: "demo" };
  }
}

const postJson = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const q = encodeURIComponent;

export const api = {
  getPacing: () => call(`/pacing/${q(ids.offering)}`, {}, fallbackPacing, isPacing),
  recalibratePacing: (body: unknown) =>
    call<PacingPlan | null>(`/pacing/${q(ids.offering)}`, postJson(body), null, isPacing as Guard<PacingPlan | null>),
  getAttention: () =>
    call(`/live-class/${q(ids.session)}/attention-model`, {}, fallbackAttentionModel(), isAttention),
  fallbackCheckpoint: (body: { slide?: number; topic?: string }) =>
    call(`/live-class/${q(ids.session)}/fallback-checkpoint`, postJson(body), null as unknown, isAnything),
  triggerActivity: (platform: string) =>
    call(
      `/live-class/${q(ids.session)}/trigger-activity`,
      postJson({ delivery_platform: platform }),
      buildActivity(platform),
      isActivity,
    ),
  getGraph: () => call(`/knowledge-graph/${q(ids.student)}`, {}, fallbackGraph, isGraph),
  getPyq: () => call(`/pyq/search?course_id=${q(ids.course)}`, {}, fallbackPyq, isPyq),
  evaluateSheet: (file?: File) => {
    const form = new FormData();
    if (file) form.append("file", file);
    else form.append("sample", "ia1-1RVU23CSE042");
    return call(`/ocr/evaluate-sheet`, { method: "POST", body: form }, fallbackEvaluation, isEvaluation);
  },
  approveAndSync: (evalId: string, body: unknown) =>
    call(`/ocr/${q(evalId)}/approve-and-sync`, postJson(body), null as unknown, isAnything),
  getTasks: () => call(`/copilot/tasks?faculty_id=${q(ids.faculty)}`, {}, fallbackTasks, isTasks),
  approveTask: (taskId: string) =>
    call(`/copilot/tasks/${q(taskId)}/approve`, { method: "POST" }, null as unknown, isAnything),
  seedDemo: () => call(`/seed-demo`, { method: "POST" }, null as unknown, isAnything),
};

/* Tracks where the current page's data came from, for the badge in the top bar. */
const sources = new Map<string, DataSource>();
const listeners = new Set<() => void>();
let snapshot: DataSource | "mixed" | "idle" = "idle";

function publish() {
  const values = new Set(sources.values());
  if (values.size === 0) snapshot = "idle";
  else if (values.size === 2) snapshot = "mixed";
  else snapshot = [...values][0];
  listeners.forEach((listener) => listener());
}

export function resetSources() {
  sources.clear();
  publish();
}

export function useDataSource() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => "idle" as const,
  );
}

/**
 * Renders the demo data immediately and swaps in the backend's data if it
 * responds. `load` must be a stable reference, such as a method of `api`.
 */
export function useResource<T>(load: () => Promise<ApiResult<T>>, fallback: T) {
  const [state, setState] = useState<{ data: T; source: DataSource; loading: boolean }>({
    data: fallback,
    source: "demo",
    loading: true,
  });

  useEffect(() => {
    let active = true;
    load().then((result) => {
      if (!active) return;
      setState({ ...result, loading: false });
      sources.set(load.name || String(load), result.source);
      publish();
    });
    return () => {
      active = false;
    };
  }, [load]);

  return state;
}
