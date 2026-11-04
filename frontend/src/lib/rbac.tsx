"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { RoleId } from "@/types";
import { setActor } from "./api";

export interface RouteDef {
  href: string;
  label: string;
}

export const ROUTES = {
  pacing: { href: "/pacing", label: "Pacing Studio" },
  live: { href: "/live-class", label: "Live Classroom" },
  graph: { href: "/knowledge-graph", label: "Knowledge Graph" },
  pyq: { href: "/pyq", label: "PYQ Engine" },
  evaluation: { href: "/evaluation", label: "OCR & Co-Pilot" },
  admin: { href: "/admin", label: "IQAC Compliance" },
} satisfies Record<string, RouteDef>;

export interface RoleDef {
  id: RoleId;
  /** Sent as X-User-Id, so the backend applies this role's rank. */
  userId: string;
  name: string;
  short: string;
  detail: string;
  routes: RouteDef[];
}

export const ROLES: RoleDef[] = [
  {
    id: "faculty",
    userId: "20000000-0000-0000-0000-000000000002",
    name: "Prof. S. Darshan",
    short: "Faculty",
    detail: "Computer Vision CS304, L:T:P 3:0:1",
    routes: [ROUTES.pacing, ROUTES.live, ROUTES.evaluation],
  },
  {
    id: "student",
    userId: "20000000-0000-0000-0000-000000000005",
    name: "Aarav Sharma",
    short: "Student",
    detail: "Major: Computer Vision, Elective: Digital Photography",
    routes: [ROUTES.graph, ROUTES.live],
  },
  {
    id: "junior",
    userId: "20000000-0000-0000-0000-000000000006",
    name: "Riya Patel",
    short: "Junior",
    detail: "Searching revised 2026 syllabus PYQs",
    routes: [ROUTES.pyq],
  },
  {
    id: "iqac",
    userId: "20000000-0000-0000-0000-000000000001",
    name: "Dr. Veena A.",
    short: "IQAC Admin",
    detail: "RBAC matrix, CO-PO rubrics, department compliance",
    routes: [ROUTES.admin, ROUTES.evaluation],
  },
];

const STORAGE_KEY = "campusai.role";

interface RoleContextValue {
  role: RoleDef;
  hydrated: boolean;
  setRole: (id: RoleId) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [roleId, setRoleId] = useState<RoleId>("faculty");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (ROLES.some((role) => role.id === saved)) setRoleId(saved as RoleId);
    } catch {
      // Storage can be unavailable in private windows; the default role is fine.
    }
    setHydrated(true);
  }, []);

  const setRole = useCallback((id: RoleId) => {
    setRoleId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // See above.
    }
  }, []);

  const value = useMemo(() => {
    const role = ROLES.find((item) => item.id === roleId) ?? ROLES[0];
    // Set during render, not in an effect, so it applies before children's requests.
    setActor(role.userId);
    return { role, hydrated, setRole };
  }, [roleId, hydrated, setRole]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole must be used inside RoleProvider");
  return context;
}
