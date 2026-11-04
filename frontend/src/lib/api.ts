"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { AttentionModel, CheckpointResult, DataSource, EvaluationData, LiveClassData, OcrEvaluation, RecalibrationSummary } from "@/types";
import {
  adaptActivity,
  adaptAttainment,
  adaptAttention,
  adaptAudit,
  adaptCheckpoint,
  adaptCompliance,
  adaptEvaluationList,
  adaptGraph,
  adaptLiveSession,
  adaptMemory,
  adaptPacing,
  adaptPyq,
  adaptRecalibration,
  adaptTasks,
  adaptUpload,
} from "./adapters";
import { fallbackAttentionModel } from "./attention";
import { buildActivity } from "./fallback/activity";
import { fallbackCompliance } from "./fallback/compliance";
import { fallbackMemory, fallbackTasks } from "./fallback/copilot";
import { fallbackGraph } from "./fallback/knowledgeGraph";
import { fallbackLiveSession } from "./fallback/liveSession";
import { fallbackAttainment, fallbackEvaluation } from "./fallback/ocr";
import { fallbackPacing } from "./fallback/pacing";
import { fallbackPyq } from "./fallback/pyq";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://campusai-backend-ak60.onrender.com/api/v1").replace(/\/$/, "");
const HEALTH_URL = `${API_URL.replace(/\/api\/v\d+$/, "")}/health`;

/** Render can take close to a minute to wake a sleeping service. */
const COLD_START_TIMEOUT_MS = 60_000;
const UNREACHABLE_TIMEOUT_MS = 5_000;

/** Stable IDs from the backend seed. */
export const IDS = {
  offering: process.env.NEXT_PUBLIC_DEMO_OFFERING_ID || "40000000-0000-0000-0000-000000000001",
  course: process.env.NEXT_PUBLIC_DEMO_COURSE_ID || "30000000-0000-0000-0000-000000000001",
  student: "20000000-0000-0000-0000-000000000005",
  faculty: "20000000-0000-0000-0000-000000000002",
};
export const DEMO_USN = "1RVU23CSE042";

export interface ApiResult<T> {
  data: T;
  source: DataSource;
  /** Why the demo data was used, written to complete "because ...". */
  note?: string;
}

const OFFLINE = "the backend is offline";

let actorId: string | null = null;
let reachable = true;

/** The backend reads the current role from this header. */
export function setActor(userId: string) {
  actorId = userId;
}

/**
 * The deployed backend answers most simultaneous requests with HTTP 500, so the
 * client sends one at a time. Its 500s also lack CORS headers, which the browser
 * reports as a network error, so reads retry on either kind of failure. Writes
 * never retry: a failed write may still have been applied.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

const READ_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function send(path: string, init: RequestInit): Promise<Response> {
  const attempts = !init.method || init.method === "GET" ? READ_ATTEMPTS : 1;
  for (let attempt = 1; ; attempt += 1) {
    const last = attempt >= attempts;
    try {
      const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: { ...init.headers, ...(actorId ? { "X-User-Id": actorId } : {}) },
        signal: AbortSignal.timeout(reachable ? COLD_START_TIMEOUT_MS : UNREACHABLE_TIMEOUT_MS),
      });
      if (response.status < 500 || last) return response;
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      if (last || timedOut) throw error;
    }
    await wait(RETRY_DELAY_MS * attempt);
  }
}

async function call<T>(path: string, init: RequestInit, fallback: T, parse: (raw: unknown) => T): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await enqueue(() => send(path, init));
    reachable = true;
  } catch {
    reachable = false;
    return { data: fallback, source: "demo", note: OFFLINE };
  }

  if (!response.ok) {
    return { data: fallback, source: "demo", note: `the backend rejected the request (${response.status})` };
  }
  try {
    const text = await response.text();
    return { data: parse(text ? JSON.parse(text) : {}), source: "live" };
  } catch {
    return { data: fallback, source: "demo", note: "the backend returned an unexpected response" };
  }
}

const postJson = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const q = encodeURIComponent;
const any = (raw: unknown) => raw;
const asAny = <T,>(adapter: (raw: never) => T) => adapter as unknown as (raw: unknown) => T;

const FALLBACK_MODEL = fallbackAttentionModel();

export const api = {
  ping: async () => {
    try {
      const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(COLD_START_TIMEOUT_MS) });
      reachable = response.ok;
    } catch {
      reachable = false;
    }
  },

  getPacing: () => call(`/pacing/${q(IDS.offering)}`, {}, fallbackPacing, asAny(adaptPacing)),
  recalibratePacing: (body: { pedagogical_system_prompt: string }) =>
    call<RecalibrationSummary | null>(`/pacing/${q(IDS.offering)}`, postJson({ ...body, preserve_completed: true }), null, asAny(adaptRecalibration)),

  getLiveClass: async (): Promise<ApiResult<LiveClassData>> => {
    const fallback: LiveClassData = { session: fallbackLiveSession, model: FALLBACK_MODEL };
    const current = await call<unknown>(`/live-class/current?offering_id=${q(IDS.offering)}`, {}, null, any);
    if (current.source === "demo" || !current.data) return { data: fallback, source: "demo", note: current.note };
    const chunks = await call<unknown[]>(`/courses/${q(IDS.course)}/chunks`, {}, [], asAny((raw: unknown[]) => raw));
    try {
      const session = adaptLiveSession(current.data, chunks.data);
      const model = await call(`/live-class/${q(session.session_id)}/attention-model?use_poll=false`, {}, FALLBACK_MODEL, asAny(adaptAttention));
      return { data: { session, model: model.data }, source: model.source, note: model.note };
    } catch {
      return { data: fallback, source: "demo", note: "the backend returned an unexpected response" };
    }
  },
  getAttentionVariant: (sessionId: string, params: Record<string, string>, fallback: AttentionModel) =>
    call(`/live-class/${q(sessionId)}/attention-model?${new URLSearchParams(params)}`, {}, fallback, asAny(adaptAttention)),
  sendVote: (sessionId: string, body: { minute_of_class: number; reported_focus_score: number; preferred_split_min: number }) =>
    call<unknown>(`/live-class/${q(sessionId)}/attention-vote`, postJson({ student_id: IDS.student, ...body }), null, any),
  fallbackCheckpoint: (sessionId: string, body: { slide_number?: number; chunk_id?: string; topic?: string }) =>
    call<CheckpointResult | null>(`/live-class/${q(sessionId)}/fallback-checkpoint`, postJson(body), null, asAny(adaptCheckpoint)),
  triggerActivity: (sessionId: string, platform: string) =>
    call(`/live-class/${q(sessionId)}/trigger-activity`, postJson({ delivery_platform: platform }), buildActivity(platform), asAny(adaptActivity)),

  getGraph: () => call(`/knowledge-graph/${q(IDS.student)}`, {}, fallbackGraph, asAny(adaptGraph)),
  getPyq: () => call(`/pyq/search?course_id=${q(IDS.course)}`, {}, fallbackPyq, asAny(adaptPyq)),

  getEvaluation: async (): Promise<ApiResult<EvaluationData>> => {
    const fallback: EvaluationData = { evaluation: fallbackEvaluation, attainment: fallbackAttainment };
    const list = await call<OcrEvaluation | null>(
      `/ocr/evaluations?offering_id=${q(IDS.offering)}`,
      {},
      null,
      (raw) => adaptEvaluationList(raw as unknown[], DEMO_USN),
    );
    if (list.source === "demo" || !list.data) return { data: fallback, source: "demo", note: list.note };
    const attainment = await call(`/assessments/co-attainment/${q(IDS.offering)}`, {}, fallbackAttainment, asAny(adaptAttainment));
    return { data: { evaluation: list.data, attainment: attainment.data }, source: attainment.source, note: attainment.note };
  },
  uploadSheet: (file: File) => {
    const form = new FormData();
    form.append("image", file);
    form.append("offering_id", IDS.offering);
    return call<ReturnType<typeof adaptUpload> | null>(`/ocr/evaluate-sheet/upload`, { method: "POST", body: form }, null, asAny(adaptUpload));
  },
  approveAndSync: (evalId: string, corrections: Record<string, number>) =>
    call<ReturnType<typeof adaptAttainment> | null>(`/ocr/${q(evalId)}/approve-and-sync`, postJson({ corrections }), null, (raw) =>
      adaptAttainment((raw as { co_attainment: unknown }).co_attainment),
    ),

  getTasks: () => call(`/copilot/tasks?faculty_id=${q(IDS.faculty)}`, {}, fallbackTasks, asAny(adaptTasks)),
  approveTask: (taskId: string) => call<unknown>(`/copilot/tasks/${q(taskId)}/approve`, { method: "POST" }, null, any),
  getMemory: () => call(`/copilot/memory/${q(IDS.faculty)}`, {}, fallbackMemory, asAny(adaptMemory)),

  getCompliance: async () => {
    const audit = await call(`/audit-logs?limit=10`, {}, fallbackCompliance.audit, asAny(adaptAudit));
    return call(`/admin/compliance`, {}, fallbackCompliance, (raw) => adaptCompliance(raw, audit.data));
  },

  seedDemo: () => call<unknown>(`/seed-demo`, { method: "POST" }, null, any),
};

/* Tracks where the current page's data came from, for the badge in the top bar. */
const sources = new Map<unknown, DataSource>();
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
 * Renders the demo data immediately and swaps in the backend's data when it
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
      setState({ data: result.data, source: result.source, loading: false });
      sources.set(load, result.source);
      publish();
    });
    return () => {
      active = false;
    };
  }, [load]);

  return state;
}
