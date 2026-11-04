"use client";

import { Lock } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ROLES, useRole } from "@/lib/rbac";

/**
 * Demonstrates role-based views in the UI. Real enforcement belongs to the
 * backend's RBAC middleware.
 */
export function RoleGate({ children }: { children: ReactNode }) {
  const { role, hydrated, setRole } = useRole();
  const pathname = usePathname();

  if (!hydrated) return null;
  if (role.routes.some((route) => route.href === pathname)) return <>{children}</>;

  const allowed = ROLES.filter((item) => item.routes.some((route) => route.href === pathname));
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
      <Lock className="mx-auto h-6 w-6 text-slate-500" aria-hidden />
      <h1 className="mt-2 text-lg font-semibold">Not available to the {role.short} role</h1>
      <p className="mt-1 text-sm text-slate-600">Switch to a role that can open this view.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {allowed.map((item) => (
          <button key={item.id} type="button" className="btn-primary" onClick={() => setRole(item.id)}>
            Switch to {item.short}
          </button>
        ))}
      </div>
    </div>
  );
}
