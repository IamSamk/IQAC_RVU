"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useRole } from "@/lib/rbac";
import { HOME_FOR, useSession } from "@/lib/session";

/** UI-level gate; the backend's rank checks do the real enforcement. */
export function RoleGate({ children }: { children: ReactNode }) {
  const { role, hydrated } = useRole();
  const { user } = useSession();
  const pathname = usePathname();

  if (!hydrated) return null;
  if (role.routes.some((route) => route.href === pathname)) return <>{children}</>;

  return (
    <div className="panel mx-auto mt-16 max-w-md p-8 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-ink-100">
        <Lock className="h-5 w-5 text-ink-500" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-2xl">Not part of your workspace</h1>
      <p className="mt-2 text-sm text-ink-500">This page is for a different role. Head back to your home page.</p>
      <Link href={user ? HOME_FOR[user.portal] : "/login"} className="btn-primary mt-5">
        Go home
      </Link>
    </div>
  );
}
