"use client";

import clsx from "clsx";
import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  FileUp,
  GanttChart,
  LibraryBig,
  LogOut,
  Menu,
  Network,
  NotebookPen,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, resetSources } from "@/lib/api";
import { HOME_FOR, SessionProvider, useSession } from "@/lib/session";
import type { Portal } from "@/types/app";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: Record<Portal, { title: string; items: NavItem[] }[]> = {
  teacher: [
    {
      title: "Teach",
      items: [
        { href: "/teacher", label: "Today", icon: CalendarCheck },
        { href: "/teacher/courses", label: "My courses", icon: BookOpen },
        { href: "/teacher/upload", label: "Upload syllabus", icon: FileUp },
      ],
    },
    {
      title: "Insights",
      items: [
        { href: "/pacing", label: "Pacing studio", icon: GanttChart },
        { href: "/live-class", label: "Attention lab", icon: Activity },
        { href: "/evaluation", label: "Marks & co-pilot", icon: ClipboardCheck },
      ],
    },
  ],
  student: [
    {
      title: "Learn",
      items: [
        { href: "/student", label: "Today", icon: CalendarCheck },
        { href: "/student/notes", label: "Class notes", icon: NotebookPen },
        { href: "/knowledge-graph", label: "Knowledge graph", icon: Network },
        { href: "/pyq", label: "Past papers", icon: LibraryBig },
      ],
    },
  ],
  admin: [
    {
      title: "Quality",
      items: [
        { href: "/admin", label: "IQAC compliance", icon: ShieldCheck },
        { href: "/evaluation", label: "Marks & co-pilot", icon: ClipboardCheck },
        { href: "/pacing", label: "Pacing studio", icon: GanttChart },
        { href: "/live-class", label: "Attention lab", icon: BarChart3 },
      ],
    },
  ],
};

const PUBLIC = ["/login"];
const KEEP_AWAKE_MS = 10 * 60 * 1000;

function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill={light ? "#F2A922" : "#5640E0"} />
        <circle cx="10" cy="11" r="3" fill={light ? "#0E0C1D" : "#fff"} />
        <circle cx="22" cy="10" r="2.4" fill={light ? "#0E0C1D" : "#fff"} opacity=".8" />
        <circle cx="16" cy="22" r="3.4" fill={light ? "#0E0C1D" : "#fff"} />
        <path d="M10 11 L16 22 L22 10" stroke={light ? "#0E0C1D" : "#fff"} strokeWidth="1.6" fill="none" opacity=".7" />
      </svg>
      <span className={clsx("font-display text-[22px] font-semibold tracking-tight", light ? "text-white" : "text-ink-950")}>
        Campus<span className="text-gold-500">AI</span>
      </span>
    </span>
  );
}

function initials(name: string) {
  return name
    .replace(/^(Prof|Dr|Mr|Ms)\.?\s+/i, "")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function FocusPicker() {
  const { courses, focus, setFocus } = useSession();
  const router = useRouter();
  const options = courses.flatMap((c) => c.sections.map((s) => ({ value: s.offering_id, label: `${c.course_code} · Section ${s.section}`, course: c, section: s.section })));
  if (options.length === 0) return null;
  return (
    <label className="mx-3 mb-2 block">
      <span className="mb-1 block px-1 text-[11px] text-ink-400">Showing insights for</span>
      <select
        className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        value={focus?.offering_id ?? ""}
        onChange={(e) => {
          const o = options.find((x) => x.value === e.target.value);
          if (!o) return;
          setFocus({ course_id: o.course.course_id, offering_id: o.value, course_code: o.course.course_code, section: o.section });
          router.refresh();
          window.location.reload();
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-ink-900">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  if (!user) return null;
  const groups = NAV[user.portal];

  return (
    <div className="flex h-full flex-col bg-ink-950 text-ink-300">
      <div className="px-5 pb-6 pt-6">
        <Link href={HOME_FOR[user.portal]} onClick={onNavigate}>
          <Logo light />
        </Link>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-2" aria-label="Main">
        {groups.map((group) => (
          <div key={group.title}>
            <div className="mb-1.5 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">{group.title}</div>
            {group.title === "Insights" && <FocusPicker />}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === pathname || (item.href !== HOME_FOR[user.portal] && pathname.startsWith(item.href + "/"));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                        active ? "bg-white/10 text-white" : "text-ink-300 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon className={clsx("h-[18px] w-[18px]", active ? "text-gold-500" : "text-ink-400 group-hover:text-ink-200")} aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="m-3 rounded-2xl bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{initials(user.full_name)}</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">{user.full_name}</div>
            <div className="truncate text-xs text-ink-400">
              {user.portal === "student" ? `${user.institution_id} · Sec ${user.section ?? "-"}` : user.portal === "admin" ? "IQAC" : user.department ?? "Faculty"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            logout();
            router.replace("/login");
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-1.5 text-xs font-medium text-ink-300 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { user, ready } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isPublic = PUBLIC.includes(pathname);

  useEffect(() => {
    resetSources();
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    void api.ping();
    const timer = window.setInterval(() => void api.ping(), KEEP_AWAKE_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user && !isPublic) router.replace("/login");
    if (user && (isPublic || pathname === "/")) router.replace(HOME_FOR[user.portal]);
  }, [ready, user, isPublic, pathname, router]);

  if (isPublic) return <>{children}</>;
  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Logo />
          <div className="h-1 w-40 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full w-1/3 animate-[shimmer_1.2s_linear_infinite] rounded-full bg-brand-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-100 bg-canvas/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button type="button" className="btn-ghost px-2" aria-label="Open menu" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink-950/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-lift">
            <Sidebar onNavigate={() => setOpen(false)} />
            <button type="button" aria-label="Close menu" className="absolute right-3 top-6 text-ink-300" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}

export { Logo };
