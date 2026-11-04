"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ActivityLaunch,
  CourseDetail,
  EndClassResult,
  LiveClass,
  MyActivity,
  SessionNotes,
  SessionUser,
  StudentHome,
  TeacherHome,
  UploadResult,
} from "@/types/app";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://campusai-backend-ak60.onrender.com/api/v1").replace(/\/$/, "");

let token: string | null = null;
export function setToken(value: string | null) {
  token = value;
}
export function getToken() {
  return token;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 90_000): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new ApiError(timedOut ? "The server took too long to answer. It may be waking up, so try again in a moment." : "Can't reach the server. Check your connection, or wait a minute while it wakes up.", 0);
  }
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail = body && typeof body.detail === "string" ? body.detail : `Request failed (${response.status})`;
    throw new ApiError(detail, response.status);
  }
  return body as T;
}

const post = (body?: unknown): RequestInit => ({ method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const app = {
  login: (email: string, password: string) => request<{ token: string; user: SessionUser }>("/auth/login", post({ email, password }), 75_000),
  me: () => request<SessionUser>("/auth/me"),

  teacherHome: () => request<TeacherHome>("/teacher/home"),
  uploadSyllabus: (form: FormData) => request<UploadResult>("/teacher/syllabus", { method: "POST", body: form }, 240_000),
  course: (courseId: string) => request<CourseDetail>(`/teacher/courses/${courseId}`),
  startClass: (sessionId: string) => request<LiveClass>(`/classes/${sessionId}/start`, post()),
  live: (sessionId: string) => request<LiveClass>(`/classes/${sessionId}/live`),
  lessonPlan: (sessionId: string, platform: string, regenerate = false) =>
    request<{ lesson_plan_md: string; engine: string }>(`/classes/${sessionId}/lesson-plan`, post({ platform, regenerate }), 120_000),
  launchActivity: (sessionId: string, platform: string, chunkId?: string) =>
    request<ActivityLaunch>(`/live-class/${sessionId}/trigger-activity`, post({ delivery_platform: platform, chunk_id: chunkId }), 120_000),
  endClass: (sessionId: string, coveredChunkIds: string[], transcript?: string) =>
    request<EndClassResult>(`/live-class/${sessionId}/end-session`, post({ covered_chunk_ids: coveredChunkIds, transcript: transcript || undefined }), 150_000),
  transcribe: (sessionId: string, clip: Blob) => {
    const form = new FormData();
    form.append("audio", clip, "lecture.webm");
    return request<{ accepted: boolean; fallback_required: boolean; text?: string; partial_text?: string; reason?: string }>(
      `/live-class/${sessionId}/transcribe-audio`,
      { method: "POST", body: form },
      150_000,
    );
  },

  studentHome: () => request<StudentHome>("/student/home"),
  attend: (sessionId: string, code: string) => request<{ status: string }>(`/classes/${sessionId}/attend`, post({ code })),
  myActivity: (sessionId: string) => request<MyActivity>(`/classes/${sessionId}/my-activity`),
  notes: (sessionId: string) => request<SessionNotes>(`/classes/${sessionId}/notes`),
  allNotes: () => request<SessionNotes[]>("/student/notes"),
};

/** Load data for a page; `reload` refetches. Keeps previous data while refreshing. */
export function useFetch<T>(load: (() => Promise<T>) | null, deps: unknown[] = []) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async (quiet = false) => {
    if (!loadRef.current) return;
    if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loadRef.current();
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState((s) => ({ ...s, error: error instanceof Error ? error.message : "Something went wrong", loading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void run();
  }, [run]);

  return { ...state, reload: run };
}

/** Polls `fn` every `ms` while `active`. */
export function usePolling(fn: () => void, ms: number, active: boolean) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => ref.current(), ms);
    return () => window.clearInterval(id);
  }, [ms, active]);
}
