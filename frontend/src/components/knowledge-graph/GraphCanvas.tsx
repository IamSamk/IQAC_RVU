"use client";

import "@xyflow/react/dist/style.css";
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import { AlertCircle, Link2 } from "lucide-react";
import { useMemo } from "react";
import { CHART } from "@/lib/chart";
import type { KGNode, KnowledgeGraph } from "@/types";

const COLUMN = 215;
const ROW_GAP = 370;
const CHUNK_WIDTH = 180;
const BRIDGE_WIDTH = 210;

interface FlowData extends Record<string, unknown> {
  node: KGNode;
  courseIndex: number;
}
type FlowNode = Node<FlowData, "chunk" | "bridge">;

const hiddenHandle = "!h-1 !min-h-0 !w-1 !min-w-0 !border-0 !bg-transparent";

function Handles() {
  return (
    <>
      <Handle id="left" type="target" position={Position.Left} className={hiddenHandle} isConnectable={false} />
      <Handle id="right" type="source" position={Position.Right} className={hiddenHandle} isConnectable={false} />
      <Handle id="top-in" type="target" position={Position.Top} className={hiddenHandle} isConnectable={false} />
      <Handle id="top-out" type="source" position={Position.Top} className={hiddenHandle} isConnectable={false} />
      <Handle id="bottom-in" type="target" position={Position.Bottom} className={hiddenHandle} isConnectable={false} />
      <Handle id="bottom-out" type="source" position={Position.Bottom} className={hiddenHandle} isConnectable={false} />
    </>
  );
}

function ChunkNode({ data }: NodeProps<FlowNode>) {
  const { node, courseIndex } = data;
  const teal = courseIndex % 2 === 1;
  return (
    <div
      style={{ width: CHUNK_WIDTH }}
      className={clsx(
        "cursor-pointer rounded-lg border-2 bg-white p-2.5 text-left transition-colors duration-150",
        teal ? "border-teal-600 hover:bg-teal-100" : "border-brand-600 hover:bg-brand-50",
        node.weak && "animate-halo-pulse",
      )}
    >
      <Handles />
      <div className={clsx("text-[11px] font-semibold", teal ? "text-teal-700" : "text-brand-700")}>
        {node.course_code} · Day {node.day}
      </div>
      <div className="mt-0.5 text-xs font-medium leading-snug text-slate-900">{node.title}</div>
      <div className="mt-1 text-[11px] text-slate-600">
        Unit {node.unit}, Chunk {node.chunk}
      </div>
      {node.weak && (
        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-critical-700">
          <AlertCircle className="h-3 w-3" aria-hidden />
          {node.weak_reason ?? "Needs revision"}
        </div>
      )}
    </div>
  );
}

function BridgeNode({ data }: NodeProps<FlowNode>) {
  return (
    <div style={{ width: BRIDGE_WIDTH }} className="animate-bridge-glow cursor-pointer rounded-xl border-2 border-gold-500 bg-gold-100 p-3 text-center transition-colors duration-150 hover:bg-amber-200">
      <Handles />
      <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-gold-700">
        <Link2 className="h-3 w-3" aria-hidden />
        Cross-subject bridge
      </div>
      <div className="mt-0.5 text-xs font-semibold leading-snug text-slate-900">{data.node.title}</div>
    </div>
  );
}

const nodeTypes = { chunk: ChunkNode, bridge: BridgeNode };

/** Courses become chronological rows, with bridge nodes between the chunks they join. */
function layout(graph: KnowledgeGraph): { nodes: FlowNode[]; edges: Edge[] } {
  const chunks = graph.nodes.filter((node) => node.kind === "chunk");
  const courses = [...new Set(chunks.map((node) => node.course_code))];
  const positions = new Map<string, { x: number; y: number }>();
  const nodes: FlowNode[] = [];

  courses.forEach((course, courseIndex) => {
    chunks
      .filter((node) => node.course_code === course)
      .sort((a, b) => a.day - b.day)
      .forEach((node, index) => {
        const position = { x: index * COLUMN, y: courseIndex * ROW_GAP };
        positions.set(node.id, position);
        nodes.push({ id: node.id, type: "chunk", position, data: { node, courseIndex }, ariaLabel: `${node.course_code}: ${node.title}` });
      });
  });

  const bridges = graph.nodes.filter((node) => node.kind === "bridge");
  bridges.forEach((node, index) => {
    const linked = graph.edges
      .filter((edge) => edge.source === node.id || edge.target === node.id)
      .map((edge) => positions.get(edge.source === node.id ? edge.target : edge.source))
      .filter((position): position is { x: number; y: number } => Boolean(position));
    const x = linked.length ? linked.reduce((sum, position) => sum + position.x, 0) / linked.length : index * COLUMN;
    const y = ROW_GAP / 2 - 30 + (index % 2 === 0 ? 0 : 0);
    positions.set(node.id, { x, y });
    nodes.push({ id: node.id, type: "bridge", position: { x, y }, data: { node, courseIndex: -1 }, ariaLabel: `Bridge: ${node.title}` });
  });

  // Bridge nodes sit on one row, so push them apart if their midpoints overlap.
  const bridgeNodes = nodes.filter((node) => node.type === "bridge").sort((a, b) => a.position.x - b.position.x);
  for (let index = 1; index < bridgeNodes.length; index += 1) {
    const minimum = bridgeNodes[index - 1].position.x + BRIDGE_WIDTH + 40;
    if (bridgeNodes[index].position.x < minimum) bridgeNodes[index].position.x = minimum;
  }

  const rowOf = (id: string) => {
    const found = nodes.find((node) => node.id === id);
    return found?.position.y ?? 0;
  };

  const edges: Edge[] = graph.edges.map((edge) => {
    const isBridge = edge.edge_type === "CROSS_SUBJECT_BRIDGE";
    const downward = rowOf(edge.source) < rowOf(edge.target);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: isBridge ? (downward ? "bottom-out" : "top-out") : "right",
      targetHandle: isBridge ? (downward ? "top-in" : "bottom-in") : "left",
      type: isBridge ? "default" : "straight",
      animated: isBridge,
      label: isBridge && edge.similarity_score !== undefined && downward ? `sim ${edge.similarity_score.toFixed(2)}` : undefined,
      labelStyle: { fontSize: 11, fontWeight: 600, fill: "#92400E" },
      labelBgStyle: { fill: "#FFFBEB" },
      style: { stroke: isBridge ? CHART.amber : "#94A3B8", strokeWidth: isBridge ? 2 : 1.5 },
      markerEnd: isBridge ? undefined : { type: MarkerType.ArrowClosed, color: "#94A3B8" },
    };
  });

  return { nodes, edges };
}

export default function GraphCanvas({ graph, onSelect }: { graph: KnowledgeGraph; onSelect: (node: KGNode) => void }) {
  const { nodes, edges } = useMemo(() => layout(graph), [graph]);
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelect((node as FlowNode).data.node)}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      fitView
      fitViewOptions={{ padding: 0.08 }}
      minZoom={0.3}
      maxZoom={1.6}
      proOptions={{ hideAttribution: false }}
    >
      <Background color="#E2E8F0" gap={24} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
