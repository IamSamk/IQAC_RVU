"use client";

import { ArrowRight, BookOpenCheck, GraduationCap, Loader2, Network, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/shell/AppShell";
import { HOME_FOR, useSession } from "@/lib/session";

/** Seeded test accounts (supabase/migrations/004_auth_attendance_uploads.sql). */
const DEMO_ACCOUNTS = [
  { label: "Teacher", who: "Prof. Test Teacher", hint: "Upload a syllabus, run a class", email: "teacher@campusai.test", password: "Teacher@123", icon: BookOpenCheck },
  { label: "Student", who: "Test Student · Sec A", hint: "Check in, notes, knowledge graph", email: "student@campusai.test", password: "Student@123", icon: GraduationCap },
  { label: "Faculty (CS304)", who: "Prof. S. Darshan", hint: "A course mid-semester", email: "darshan.s@rvu.edu.in", password: "Teacher@123", icon: UserRound },
  { label: "IQAC admin", who: "Dr. Veena A.", hint: "Compliance and CO-PO", email: "iqac.admin@rvu.edu.in", password: "Admin@123", icon: ShieldCheck },
];

function GraphArt() {
  const nodes = [
    [70, 80, "#7260F0"], [170, 60, "#7260F0"], [270, 95, "#7260F0"], [370, 70, "#7260F0"],
    [100, 230, "#14B8A6"], [215, 250, "#14B8A6"], [330, 225, "#14B8A6"],
  ] as const;
  return (
    <svg viewBox="0 0 440 300" className="w-full max-w-md" aria-hidden>
      <path d="M70 80 L170 60 L270 95 L370 70" stroke="#7260F0" strokeWidth="2" fill="none" opacity=".5" />
      <path d="M100 230 L215 250 L330 225" stroke="#14B8A6" strokeWidth="2" fill="none" opacity=".5" />
      <path d="M170 60 C170 160, 215 160, 215 250" stroke="#F2A922" strokeWidth="3" fill="none" strokeDasharray="6 6">
        <animate attributeName="stroke-dashoffset" from="24" to="0" dur="1.2s" repeatCount="indefinite" />
      </path>
      <path d="M270 95 C270 170, 330 160, 330 225" stroke="#F2A922" strokeWidth="3" fill="none" strokeDasharray="6 6">
        <animate attributeName="stroke-dashoffset" from="24" to="0" dur="1.2s" repeatCount="indefinite" />
      </path>
      {nodes.map(([x, y, c], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="16" fill={c} opacity=".18" />
          <circle cx={x} cy={y} r="8" fill={c} />
        </g>
      ))}
      <circle cx="170" cy="60" r="9" fill="#F2A922" />
      <circle cx="215" cy="250" r="9" fill="#F2A922" />
    </svg>
  );
}

export default function LoginPage() {
  const { login } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (e?: string, p?: string) => {
    const em = e ?? email;
    const pw = p ?? password;
    setBusy(em);
    setError(null);
    try {
      const user = await login(em, pw);
      router.replace(HOME_FOR[user.portal]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
      setBusy(null);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void signIn();
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-700/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 right-0 h-[420px] w-[420px] rounded-full bg-gold-500/10 blur-3xl" aria-hidden />
        <Logo light />
        <div className="relative mt-auto max-w-lg">
          <p className="eyebrow !text-gold-500">RV University · Analytica 4.0</p>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-white">
            Teach your syllabus.
            <br />
            <span className="text-ink-300">Let the AI plan the rest.</span>
          </h1>
          <ul className="mt-8 space-y-3.5 text-[15px] text-ink-300">
            <li className="flex gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" aria-hidden />
              Upload a syllabus and get a day-by-day plan for every section.
            </li>
            <li className="flex gap-3">
              <BookOpenCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" aria-hidden />
              Run class with attendance codes, timed polls and auto-written notes.
            </li>
            <li className="flex gap-3">
              <Network className="mt-0.5 h-5 w-5 shrink-0 text-gold-500" aria-hidden />
              Students see how their subjects connect, grounded only in the syllabus.
            </li>
          </ul>
        </div>
        <div className="relative mt-10">
          <GraphArt />
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md animate-fade-up">
          <div className="lg:hidden">
            <Logo />
          </div>
          <h2 className="mt-8 font-display text-4xl font-semibold tracking-tight lg:mt-0">Welcome back</h2>
          <p className="mt-2 text-ink-500">Sign in with your university account.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input id="email" type="email" autoComplete="username" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@rvu.edu.in" required />
            </div>
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input id="password" type="password" autoComplete="current-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="rounded-xl bg-critical-100 px-3.5 py-2.5 text-sm text-critical-700">{error}</p>}
            <button type="submit" className="btn-primary btn-lg w-full" disabled={busy !== null}>
              {busy === email && busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign in
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-10">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-ink-200" />
              <span className="eyebrow">Or try a demo account</span>
              <span className="h-px flex-1 bg-ink-200" />
            </div>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.email}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      setEmail(a.email);
                      setPassword(a.password);
                      void signIn(a.email, a.password);
                    }}
                    className="group flex items-start gap-3 rounded-2xl border border-ink-200 bg-white p-3.5 text-left transition hover:border-brand-500 hover:shadow-glow disabled:opacity-60"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 group-hover:bg-brand-600 group-hover:text-white">
                      {busy === a.email ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink-950">{a.label}</span>
                      <span className="block truncate text-xs text-ink-500">{a.who}</span>
                      <span className="mt-0.5 block text-xs text-ink-400">{a.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-center text-xs text-ink-400">The first sign-in can take up to a minute while the server wakes up.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
