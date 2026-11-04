"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SessionUser, TeacherCourse } from "@/types/app";
import { IDS, setActor, setAuthToken } from "./api";
import { app, setToken } from "./app-api";

const STORAGE_KEY = "campusai.session";
const FOCUS_KEY = "campusai.focus";

export interface Focus {
  course_id: string;
  offering_id: string;
  course_code: string;
  section: string;
}

interface SessionValue {
  user: SessionUser | null;
  ready: boolean;
  courses: TeacherCourse[];
  focus: Focus | null;
  setFocus: (focus: Focus) => void;
  refreshCourses: () => Promise<void>;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

function applyIdentity(user: SessionUser | null, token: string | null) {
  setToken(token);
  setAuthToken(token);
  if (!user) return;
  setActor(user.user_id);
  if (user.portal === "student") IDS.student = user.user_id;
  if (user.portal === "teacher") IDS.faculty = user.user_id;
}

/** Points the analytics pages (pacing, attention, evaluation) at the course the teacher is focused on. */
function applyFocus(focus: Focus | null) {
  if (!focus) return;
  IDS.offering = focus.offering_id;
  IDS.course = focus.course_id;
}

function pickFocus(courses: TeacherCourse[], saved: Focus | null): Focus | null {
  const all = courses.flatMap((c) => c.sections.map((s) => ({ course_id: c.course_id, offering_id: s.offering_id, course_code: c.course_code, section: s.section, uploaded: c.uploaded })));
  if (saved && all.some((f) => f.offering_id === saved.offering_id)) return saved;
  const first = all.find((f) => f.uploaded) ?? all[0];
  return first ? { course_id: first.course_id, offering_id: first.offering_id, course_code: first.course_code, section: first.section } : null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [focus, setFocusState] = useState<Focus | null>(null);

  const loadCourses = useCallback(async (u: SessionUser | null) => {
    if (!u || u.portal === "student") return;
    try {
      const home = await app.teacherHome();
      setCourses(home.courses);
      let saved: Focus | null = null;
      try {
        saved = JSON.parse(window.localStorage.getItem(FOCUS_KEY) || "null");
      } catch {
        saved = null;
      }
      const next = pickFocus(home.courses, saved);
      applyFocus(next);
      setFocusState(next);
    } catch {
      // The pages show their own errors; analytics fall back to the demo course.
    }
  }, []);

  useEffect(() => {
    (async () => {
      let stored: { token: string; user: SessionUser } | null = null;
      try {
        stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      } catch {
        stored = null;
      }
      if (stored?.token) {
        applyIdentity(stored.user, stored.token);
        setUser(stored.user);
        await loadCourses(stored.user);
        app.me().then(
          (fresh) => setUser(fresh),
          (error) => {
            if (error?.status === 401) {
              window.localStorage.removeItem(STORAGE_KEY);
              applyIdentity(null, null);
              setUser(null);
            }
          },
        );
      }
      setReady(true);
    })();
  }, [loadCourses]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await app.login(email, password);
      applyIdentity(result.user, result.token);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
      } catch {
        // Private windows: the session simply lasts for this tab.
      }
      setUser(result.user);
      await loadCourses(result.user);
      return result.user;
    },
    [loadCourses],
  );

  const logout = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    applyIdentity(null, null);
    setUser(null);
    setCourses([]);
    setFocusState(null);
  }, []);

  const setFocus = useCallback((next: Focus) => {
    applyFocus(next);
    setFocusState(next);
    try {
      window.localStorage.setItem(FOCUS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const refreshCourses = useCallback(() => loadCourses(user), [loadCourses, user]);

  const value = useMemo(() => ({ user, ready, courses, focus, setFocus, refreshCourses, login, logout }), [user, ready, courses, focus, setFocus, refreshCourses, login, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

export const HOME_FOR: Record<SessionUser["portal"], string> = { teacher: "/teacher", student: "/student", admin: "/admin" };
