"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import clsx from "clsx";
import { AlertCircle, CheckCircle2, Link2 } from "lucide-react";
import { useMemo, useRef } from "react";
import type { KGNode, KnowledgeGraph } from "@/types";

/* Course columns, topics stacked by unit, cross-course bridges in the gutters between columns. */
const COL_W = 224;
const GUTTER = 214;
const TOPIC_H = 74;
const UNIT_GAP = 34;
const HEADER_H = 96;
const BRIDGE_W = 184;

export const COURSE_COLORS = [
  { bar: "#5640E0", soft: "#F3F1FF", text: "#4430C4" },
  { bar: "#0D9488", soft: "#E6FAF7", text: "#0F766E" },
  { bar: "#DB2777", soft: "#FDF0F6", text: "#BE185D" },
  { bar: "#2563EB", soft: "#EEF4FF", text: "#1D4ED8" },
];

interface TopicData extends Record<string, unknown> {
  node: KGNode;
  color: (typeof COURSE_COLORS)[number];
}
interface HeaderData extends Record<string, unknown> {
  code: string;
  title: string;
  topics: number;
  color: (typeof COURSE_COLORS)[number];
}
interface UnitData extends Record<string, unknown> {
  label: string;
}
interface BridgeData extends Record<string, unknown> {
  node: KGNode;
  similarity?: number;
}

const hidden = "!h-1 !min-h-0 !w-1 !min-w-0 !border-0 !bg-transparent";
function Handles() {
  return (
    <>
      <Handle
        id="l-in"
        type="target"
        position={Position.Left}
        className={hidden}
        isConnectable={false}
      />
      <Handle
        id="l-out"
        type="source"
        position={Position.Left}
        className={hidden}
        isConnectable={false}
      />
      <Handle
        id="r-in"
        type="target"
        position={Position.Right}
        className={hidden}
        isConnectable={false}
      />
      <Handle
        id="r-out"
        type="source"
        position={Position.Right}
        className={hidden}
        isConnectable={false}
      />
      <Handle
        id="t-in"
        type="target"
        position={Position.Top}
        className={hidden}
        isConnectable={false}
      />
      <Handle
        id="b-out"
        type="source"
        position={Position.Bottom}
        className={hidden}
        isConnectable={false}
      />
    </>
  );
}

function TopicNode({ data }: NodeProps<Node<TopicData>>) {
  const { node, color } = data;
  return (
    <div
      style={{ width: COL_W, borderLeftColor: color.bar }}
      className={clsx(
        "group cursor-pointer rounded-xl border border-l-[5px] border-ink-100 bg-white px-3 py-2.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift",
        node.weak && "animate-halo-pulse",
      )}
    >
      <Handles />
      <div className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink-950">
        {node.title}
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-500">
        <span>
          U{node.unit}·{node.chunk}
        </span>
        {node.when && (
          <span className="inline-flex items-center gap-0.5 text-success-700">
            <CheckCircle2 className="h-3 w-3" /> taught
          </span>
        )}
        {node.weak && (
          <span className="inline-flex items-center gap-0.5 font-medium text-critical-700">
            <AlertCircle className="h-3 w-3" /> revise
          </span>
        )}
      </div>
    </div>
  );
}

function HeaderNode({ data }: NodeProps<Node<HeaderData>>) {
  return (
    <div
      style={{ width: COL_W, background: data.color.soft }}
      className="rounded-2xl px-4 py-3"
    >
      <div
        className="font-mono text-xs font-bold"
        style={{ color: data.color.text }}
      >
        {data.code}
      </div>
      <div className="mt-0.5 line-clamp-2 font-display text-[17px] font-semibold leading-tight text-ink-950">
        {data.title}
      </div>
      <div className="mt-1 text-[11px] text-ink-500">{data.topics} topics</div>
    </div>
  );
}

function UnitNode({ data }: NodeProps<Node<UnitData>>) {
  return (
    <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
      {data.label}
    </div>
  );
}

function BridgeNode({ data }: NodeProps<Node<BridgeData>>) {
  return (
    <div
      style={{ width: BRIDGE_W }}
      className="animate-bridge-glow cursor-pointer rounded-2xl border-2 border-gold-500 bg-gold-50 px-3 py-2.5 text-center transition hover:bg-gold-100"
    >
      <Handles />
      <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gold-700">
        <Link2 className="h-3 w-3" /> Connects
      </div>
      <div className="mt-0.5 line-clamp-2 text-[12.5px] font-semibold leading-snug text-ink-950">
        {data.node.title}
      </div>
      {data.similarity !== undefined && (
        <div className="mt-0.5 text-[10px] text-gold-700">
          match {Math.round(data.similarity * 100)}%
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  topic: TopicNode,
  header: HeaderNode,
  unit: UnitNode,
  bridge: BridgeNode,
};

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [
      item,
      ...rest,
    ]),
  );
}

function layout(graph: KnowledgeGraph) {
  const chunks = graph.nodes.filter((n) => n.kind === "chunk");
  const bridges = graph.nodes.filter((n) => n.kind === "bridge");
  const courseOf = new Map(chunks.map((n) => [n.id, n.course_code]));
  const ends = (bridgeId: string) =>
    graph.edges
      .filter((e) => e.source === bridgeId || e.target === bridgeId)
      .map((e) => (e.source === bridgeId ? e.target : e.source));

  // Put the most-connected courses next to each other.
  let courses = [...new Set(chunks.map((n) => n.course_code))];
  const pairCount = (a: string, b: string) =>
    bridges.filter((br) => {
      const cs = ends(br.id).map((id) => courseOf.get(id));
      return cs.includes(a) && cs.includes(b);
    }).length;
  if (courses.length <= 6) {
    courses = permutations(courses).reduce(
      (best, order) => {
        const score = order
          .slice(1)
          .reduce((s, c, i) => s + pairCount(order[i], c), 0);
        return score > best.score ? { order, score } : best;
      },
      { order: courses, score: -1 },
    ).order;
  }

  const titles = new Map(
    (graph.courses ?? []).map((c) => [c.course_code, c.course_title]),
  );
  const colX = (i: number) => i * (COL_W + GUTTER);
  const pos = new Map<string, { x: number; y: number; col: number }>();
  const nodes: Node[] = [];

  courses.forEach((code, col) => {
    const color = COURSE_COLORS[col % COURSE_COLORS.length];
    const mine = chunks
      .filter((n) => n.course_code === code)
      .sort((a, b) => a.unit - b.unit || a.chunk - b.chunk);
    nodes.push({
      id: `h-${code}`,
      type: "header",
      position: { x: colX(col), y: 0 },
      data: {
        code,
        title: titles.get(code) ?? code,
        topics: mine.length,
        color,
      },
      selectable: false,
      draggable: false,
    });
    let y = HEADER_H + 10;
    let unit = -1;
    mine.forEach((n) => {
      if (n.unit !== unit) {
        if (unit !== -1) y += UNIT_GAP - 16;
        unit = n.unit;
        nodes.push({
          id: `u-${code}-${unit}`,
          type: "unit",
          position: { x: colX(col), y },
          data: { label: `Unit ${unit}` },
          selectable: false,
          draggable: false,
        });
        y += 20;
      }
      pos.set(n.id, { x: colX(col), y, col });
      nodes.push({
        id: n.id,
        type: "topic",
        position: { x: colX(col), y },
        data: { node: n, color },
        ariaLabel: `${code}: ${n.title}`,
      });
      y += TOPIC_H;
    });
  });

  // Bridges sit in the gutter on the side facing the other course, stacked so they never overlap.
  const placed: { x: number; y: number }[] = [];
  const edges: Edge[] = [];
  const bridgeNodes = bridges
    .map((br) => {
      const [a, b] = ends(br.id).map((id) => pos.get(id));
      if (!a || !b) return null;
      const [left, right] = a.col <= b.col ? [a, b] : [b, a];
      const gutterCol = right.col - 1 >= left.col ? right.col - 1 : left.col;
      return {
        br,
        x: colX(gutterCol) + COL_W + (GUTTER - BRIDGE_W) / 2,
        y: (a.y + b.y) / 2,
        left,
        right,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort((p, q) => p.y - q.y);

  for (const b of bridgeNodes) {
    let y = b.y;
    while (placed.some((p) => p.x === b.x && Math.abs(p.y - y) < 86)) y += 90;
    placed.push({ x: b.x, y });
    const sim = graph.edges.find(
      (e) => e.source === b.br.id || e.target === b.br.id,
    )?.similarity_score;
    nodes.push({
      id: b.br.id,
      type: "bridge",
      position: { x: b.x, y },
      data: { node: b.br, similarity: sim },
      ariaLabel: `Connection: ${b.br.title}`,
    });
  }

  for (const e of graph.edges) {
    if (e.edge_type === "CROSS_SUBJECT_BRIDGE") {
      const bridgeId = e.source.startsWith("bridge-") ? e.source : e.target;
      const topicId = bridgeId === e.source ? e.target : e.source;
      const t = pos.get(topicId);
      const bn = nodes.find((n) => n.id === bridgeId);
      if (!t || !bn) continue;
      const topicLeftOfBridge = t.x < bn.position.x;
      edges.push({
        id: e.id,
        source: topicId,
        target: bridgeId,
        sourceHandle: topicLeftOfBridge ? "r-out" : "l-out",
        targetHandle: topicLeftOfBridge ? "l-in" : "r-in",
        type: "default",
        animated: true,
        style: { stroke: "#F2A922", strokeWidth: 2.5 },
      });
    }
  }
  return { nodes, edges };
}

export default function GraphCanvas({
  graph,
  onSelect,
}: {
  graph: KnowledgeGraph;
  onSelect: (node: KGNode) => void;
}) {
  const { nodes, edges } = useMemo(() => layout(graph), [graph]);
  const box = useRef<HTMLDivElement>(null);
  const width = useMemo(
    () =>
      Math.max(
        COL_W,
        ...nodes.map(
          (n) => n.position.x + (n.type === "bridge" ? BRIDGE_W : COL_W),
        ),
      ),
    [nodes],
  );
  return (
    <div ref={box} className="h-full w-full">
      <ReactFlow
        key={graph.nodes.length}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => {
          const data = node.data as { node?: KGNode };
          if (data.node) onSelect(data.node);
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        onInit={(flow) => {
          // Fit the columns to the width and start at the top, so topic titles are readable straight away.
          const w = box.current?.clientWidth ?? 900;
          const zoom = Math.min(1.1, Math.max(0.35, (w - 48) / width));
          flow.setViewport({ x: (w - width * zoom) / 2, y: 20, zoom });
        }}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#DCD9E6" gap={22} size={1.2} />
        <Controls showInteractive={false} orientation="horizontal" />
      </ReactFlow>
    </div>
  );
}
