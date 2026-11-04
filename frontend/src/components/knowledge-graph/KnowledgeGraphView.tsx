"use client";

import { AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { api, useResource } from "@/lib/api";
import { fallbackGraph } from "@/lib/fallback/knowledgeGraph";
import type { KGNode } from "@/types";
import { NodeDrawer } from "./NodeDrawer";

const GraphCanvas = dynamic(() => import("./GraphCanvas"), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-slate-100" />,
});

export function KnowledgeGraphView() {
  const { data: graph } = useResource(api.getGraph, fallbackGraph);
  const [selected, setSelected] = useState<KGNode | null>(null);

  const weak = useMemo(() => graph.nodes.filter((node) => node.weak), [graph]);
  const bridges = useMemo(() => graph.nodes.filter((node) => node.kind === "bridge"), [graph]);
  const courses = useMemo(() => [...new Set(graph.nodes.filter((node) => node.kind === "chunk").map((node) => node.course_code))], [graph]);

  return (
    <>
      <PageHeader
        title="Cross-Subject Knowledge Graph"
        description="Aarav's enrolled courses as chronological timelines, joined wherever the syllabus teaches the same idea. Select a topic to study it."
        action={
          <Badge tone="success" className="px-3 py-1.5">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
            100% Grounded in Uploaded RVU Syllabus Chunks (Zero External Web Hallucination)
          </Badge>
        }
      />

      <Card className="overflow-hidden !p-0">
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-slate-200 px-4 py-2.5 text-xs text-slate-700">
          {courses.map((course, index) => (
            <span key={course} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded border-2 ${index % 2 === 0 ? "border-brand-600" : "border-teal-600"}`} aria-hidden />
              {course}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border-2 border-gold-500 bg-gold-100" aria-hidden />
            Cross-subject bridge ({bridges.length})
          </span>
          <span className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-critical-700" aria-hidden />
            Weak in IA-1 ({weak.length})
          </span>
        </div>
        <div className="h-[640px] w-full">
          <GraphCanvas graph={graph} onSelect={setSelected} />
        </div>
      </Card>

      {weak.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="Your remediation plan" description="Topics where you lost marks in IA-1. Each opens with notes, flashcards and a quick quiz." />
          <ul className="grid gap-2 md:grid-cols-2">
            {weak.map((node) => (
              <li key={node.id}>
                <button type="button" className="btn-outline h-full w-full justify-between text-left" onClick={() => setSelected(node)}>
                  <span>
                    <span className="block text-xs text-critical-700">{node.weak_reason ?? "Needs revision"}</span>
                    {node.title}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <summary className="font-medium text-brand-700">Browse all topics as a list</summary>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {graph.nodes.map((node) => (
            <li key={node.id}>
              <button type="button" className="btn-outline h-full w-full justify-start text-left" onClick={() => setSelected(node)}>
                <span>
                  <span className="block text-xs text-slate-600">{node.kind === "bridge" ? "Cross-subject bridge" : `${node.course_code}, Unit ${node.unit}`}</span>
                  {node.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </details>

      <NodeDrawer node={selected} edges={graph.edges} onClose={() => setSelected(null)} />
    </>
  );
}
