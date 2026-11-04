"use client";

import { useMemo } from "react";
import type { RoleId } from "@/types";
import type { SessionUser } from "@/types/app";
import { useSession } from "./session";

export interface RouteDef {
  href: string;
  label: string;
}

export const ROUTES = {
  pacing: { href: "/pacing", label: "Pacing studio" },
  live: { href: "/live-class", label: "Attention lab" },
  graph: { href: "/knowledge-graph", label: "Knowledge graph" },
  pyq: { href: "/pyq", label: "Past papers" },
  evaluation: { href: "/evaluation", label: "Marks & co-pilot" },
  admin: { href: "/admin", label: "IQAC compliance" },
} satisfies Record<string, RouteDef>;

export interface RoleDef {
  id: RoleId;
  userId: string;
  name: string;
  short: string;
  detail: string;
  routes: RouteDef[];
}

const ROLE_ROUTES: Record<RoleId, { short: string; routes: RouteDef[] }> = {
  faculty: { short: "Teacher", routes: [ROUTES.pacing, ROUTES.live, ROUTES.evaluation] },
  student: { short: "Student", routes: [ROUTES.graph, ROUTES.pyq] },
  junior: { short: "Student", routes: [ROUTES.graph, ROUTES.pyq] },
  iqac: { short: "IQAC admin", routes: [ROUTES.admin, ROUTES.evaluation, ROUTES.pacing, ROUTES.live] },
};

export function roleIdFor(user: SessionUser | null): RoleId {
  if (!user) return "student";
  if (user.portal === "admin") return "iqac";
  if (user.portal === "teacher") return "faculty";
  return "student";
}

/** The signed-in user's role, in the shape the analytics pages expect. */
export function useRole() {
  const { user, ready } = useSession();
  const role = useMemo<RoleDef>(() => {
    const id = roleIdFor(user);
    return { id, userId: user?.user_id ?? "", name: user?.full_name ?? "", short: ROLE_ROUTES[id].short, detail: user?.department ?? "", routes: ROLE_ROUTES[id].routes };
  }, [user]);
  return { role, hydrated: ready };
}
