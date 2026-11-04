"use client";

import { TriangleAlert } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
      <TriangleAlert className="mx-auto h-6 w-6 text-gold-700" aria-hidden />
      <h1 className="mt-2 text-lg font-semibold">This view hit a problem</h1>
      <p className="mt-1 text-sm text-slate-600">The other views still work. Try loading this one again.</p>
      <button type="button" className="btn-primary mt-4" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
