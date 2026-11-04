"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, Database, GraduationCap, PlayCircle, RotateCcw, Square } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, resetSources, useDataSource } from "@/lib/api";
import { DEMO_STEPS } from "@/lib/demo";
import { ROLES, RoleProvider, useRole } from "@/lib/rbac";
import { supabase } from "@/lib/supabase";
import type { RoleId } from "@/types";

const SOURCE_COPY = {
  idle: { label: "Connecting", dot: "bg-slate-400" },
  live: { label: "Live API", dot: "bg-success-500" },
  mixed: { label: "Partly live", dot: "bg-gold-500" },
  demo: { label: "Offline demo data", dot: "bg-gold-500" },
};

function DataSourceBadge() {
  const source = useDataSource();
  const copy = SOURCE_COPY[source];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-white/25 px-2.5 py-1 text-xs text-white"
      title={`Backend: ${copy.label}. Supabase client: ${supabase ? "configured" : "not configured"}.`}
    >
      <span className={clsx("h-2 w-2 rounded-full", copy.dot)} aria-hidden />
      <Database className="h-3.5 w-3.5" aria-hidden />
      {copy.label}
    </span>
  );
}

function RoleSwitcher({ onSwitch }: { onSwitch: (id: RoleId) => void }) {
  const { role } = useRole();
  return (
    <div role="radiogroup" aria-label="Demo role" className="flex gap-1.5 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
      {ROLES.map((item) => {
        const active = item.id === role.id;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSwitch(item.id)}
            className={clsx(
              "min-h-[44px] w-56 shrink-0 rounded-lg border px-3 py-1.5 text-left transition-colors duration-150 focus-visible:outline-white lg:w-auto lg:min-w-0",
              active ? "border-gold-500 bg-white text-slate-900" : "border-white/20 text-white hover:bg-white/10",
            )}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              {item.short}
              <span className={clsx("truncate font-normal", active ? "text-slate-700" : "text-indigo-100")}>· {item.name}</span>
            </span>
            <span className={clsx("block truncate text-xs", active ? "text-slate-600" : "text-indigo-200")}>{item.detail}</span>
          </button>
        );
      })}
    </div>
  );
}

function DemoStepper({ onGoTo }: { onGoTo: (index: number) => void }) {
  const [index, setIndex] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);

  const go = (next: number) => {
    setIndex(next);
    onGoTo(next);
  };

  const resetDemo = async () => {
    setResetting(true);
    await api.seedDemo();
    window.location.assign("/");
  };

  if (index === null) {
    return (
      <button type="button" onClick={() => go(0)} className="btn-gold whitespace-nowrap">
        <PlayCircle className="h-4 w-4" aria-hidden />
        Run 10-Min Judge Demo Flow
      </button>
    );
  }

  const step = DEMO_STEPS[index];
  return (
    <div className="w-full rounded-lg border border-gold-500/60 bg-brand-900 p-3 text-white lg:order-last">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-72" aria-live="polite">
          <div className="text-xs text-amber-200">
            Step {index + 1} of {DEMO_STEPS.length} · about {step.minutes} min
          </div>
          <div className="text-sm font-semibold">{step.title}</div>
          <p className="mt-0.5 text-sm text-indigo-100">{step.action}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn border border-white/30 text-white hover:bg-white/10" disabled={index === 0} onClick={() => go(index - 1)}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
          {index < DEMO_STEPS.length - 1 ? (
            <button type="button" className="btn-gold" onClick={() => go(index + 1)}>
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button type="button" className="btn-gold" onClick={() => setIndex(null)}>
              Finish
            </button>
          )}
          <button type="button" className="btn border border-white/30 text-white hover:bg-white/10" disabled={resetting} onClick={resetDemo}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            {resetting ? "Resetting" : "Reset"}
          </button>
          <button type="button" aria-label="Exit demo flow" className="btn border border-white/30 text-white hover:bg-white/10" onClick={() => setIndex(null)}>
            <Square className="h-4 w-4" aria-hidden />
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}

/** Often enough that a free Render service does not go to sleep mid-demo. */
const KEEP_AWAKE_MS = 10 * 60 * 1000;

function Shell({ children }: { children: ReactNode }) {
  const { role, setRole } = useRole();
  const pathname = usePathname();
  const router = useRouter();
  const source = useDataSource();

  useEffect(() => {
    resetSources();
  }, [pathname]);

  useEffect(() => {
    const timer = window.setInterval(() => void api.ping(), KEEP_AWAKE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const switchRole = (id: RoleId) => {
    const next = ROLES.find((item) => item.id === id);
    if (!next) return;
    setRole(id);
    if (!next.routes.some((route) => route.href === pathname)) router.push(next.routes[0].href);
  };

  const goToStep = (index: number) => {
    const step = DEMO_STEPS[index];
    setRole(step.role);
    if (step.href !== pathname) router.push(step.href);
  };

  return (
    <>
      <header className="bg-brand-950 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold focus-visible:outline-white">
            <GraduationCap className="h-6 w-6 text-gold-500" aria-hidden />
            <span className="text-lg tracking-tight">CampusAI</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2 lg:contents">
            <div className="lg:order-1 lg:ml-auto">
              <DataSourceBadge />
            </div>
            <div className="contents lg:order-2">
              <DemoStepper onGoTo={goToStep} />
            </div>
          </div>
          <div className="w-full lg:order-last">
            <RoleSwitcher onSwitch={switchRole} />
          </div>
        </div>
      </header>
      <nav aria-label="Portal views" className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {role.routes.map((route) => {
            const active = route.href === pathname;
            return (
              <Link
                key={route.href}
                href={route.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors duration-150",
                  active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-600 hover:text-slate-900",
                )}
              >
                {route.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {source === "idle" && (
        <p role="status" className="border-b border-amber-200 bg-gold-50 px-4 py-1.5 text-center text-xs text-gold-700">
          Connecting to the live backend. It can take up to a minute to wake, and demo data shows until then.
        </p>
      )}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:py-6">{children}</main>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <RoleProvider>
      <Shell>{children}</Shell>
    </RoleProvider>
  );
}
