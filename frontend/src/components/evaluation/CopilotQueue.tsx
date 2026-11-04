"use client";

import { Bot, BrainCircuit, CheckCircle2, Eye, History, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Card, CardHeader, Dialog } from "@/components/ui/primitives";
import { api, useResource } from "@/lib/api";
import { fallbackMemory, fallbackTasks } from "@/lib/fallback/copilot";
import { formatDateTime } from "@/lib/format";
import type { CopilotTask } from "@/types";

interface SessionAction {
  id: string;
  title: string;
  tool: string;
  note?: string;
  at: string;
}

export function CopilotQueue({ actor }: { actor: string }) {
  const { data: tasks } = useResource(api.getTasks, fallbackTasks);
  const { data: memoryLog } = useResource(api.getMemory, fallbackMemory);
  const [approved, setApproved] = useState<Record<string, "live" | "demo">>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<CopilotTask | null>(null);
  const [actions, setActions] = useState<SessionAction[]>([]);
  const [scope, setScope] = useState("ALL");

  const scopes = useMemo(() => ["ALL", ...new Set(memoryLog.map((memory) => memory.memory_scope))], [memoryLog]);
  const memories = memoryLog.filter((memory) => scope === "ALL" || memory.memory_scope === scope);

  const approve = async (task: CopilotTask) => {
    setBusy(task.task_id);
    const response = await api.approveTask(task.task_id);
    setApproved((current) => ({ ...current, [task.task_id]: response.source }));
    setActions((current) => [
      {
        id: `${task.task_id}-${current.length}`,
        title: task.task_title,
        tool: task.tool_call_name,
        note: response.source === "demo" ? `Not saved, because ${response.note}.` : undefined,
        at: new Date().toISOString(),
      },
      ...current,
    ]);
    setBusy(null);
    setPreview(null);
  };

  const isDone = (task: CopilotTask) => task.status !== "AWAITING_HITL_APPROVAL" || approved[task.task_id] !== undefined;
  const awaiting = tasks.filter((task) => !isDone(task)).length;

  const approveButton = (task: CopilotTask) => (
    <button type="button" className="btn-primary" disabled={busy !== null} onClick={() => approve(task)}>
      <Zap className="h-4 w-4" aria-hidden />
      {busy === task.task_id ? "Executing" : "1-Click Approve & Execute"}
    </button>
  );

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card>
        <CardHeader
          title="Faculty Co-Pilot queue"
          description="The agent has already prepared each draft. Nothing runs until a person approves it."
          action={
            <Badge tone={awaiting > 0 ? "warning" : "success"}>
              <Bot className="h-3 w-3" aria-hidden />
              {awaiting} awaiting approval
            </Badge>
          }
        />
        <ul className="space-y-2">
          {tasks.map((task) => {
            const done = isDone(task);
            return (
              <li key={task.task_id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 basis-60">
                    <h3 className="text-sm font-semibold">{task.task_title}</h3>
                    <p className="mt-0.5 text-sm text-slate-600">{task.summary}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Due {formatDateTime(task.due_timestamp)} · <code className="font-mono">{task.tool_call_name}</code>
                    </p>
                  </div>
                  {done && (
                    <Badge tone="success">
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                      {approved[task.task_id] === "demo" ? "Approved (not saved)" : "Executed"}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn-outline" onClick={() => setPreview(task)}>
                    <Eye className="h-4 w-4" aria-hidden />
                    Preview Draft
                  </button>
                  {!done && approveButton(task)}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Episodic memory log" description="What the agent remembers, and why it acted." action={<BrainCircuit className="h-5 w-5 text-brand-600" aria-hidden />} />
          <label className="text-xs font-medium text-slate-700">
            Scope
            <select className="field mt-1 py-1.5" value={scope} onChange={(event) => setScope(event.target.value)}>
              {scopes.map((item) => (
                <option key={item} value={item}>
                  {item === "ALL" ? "All scopes" : item}
                </option>
              ))}
            </select>
          </label>
          <ul className="mt-3 space-y-2">
            {memories.map((memory) => (
              <li key={memory.memory_id} className="rounded-lg bg-slate-50 p-2.5 text-sm">
                <p className="text-slate-800">{memory.memory_summary}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {memory.memory_scope} · {formatDateTime(memory.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Your approvals" description="Saved approvals are also written to the audit log, which IQAC can review." action={<History className="h-5 w-5 text-brand-600" aria-hidden />} />
          {actions.length === 0 ? (
            <p className="text-sm text-slate-600">Tasks you approve in this session appear here.</p>
          ) : (
            <ul className="space-y-2" aria-live="polite">
              {actions.map((action) => (
                <li key={action.id} className="border-l-2 border-brand-600 pl-3 text-sm">
                  <p className="font-medium">{action.title}</p>
                  <p className="text-slate-700">
                    <code className="font-mono text-xs">{action.tool}</code>
                    {action.note && ` ${action.note}`}
                  </p>
                  <p className="text-xs text-slate-600">
                    {actor} · {formatDateTime(action.at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Dialog open={preview !== null} onClose={() => setPreview(null)} variant="side" title={preview?.task_title ?? "Draft preview"}>
        {preview && (
          <>
            <p className="text-sm text-slate-700">{preview.summary}</p>
            <h3 className="mt-4 text-sm font-semibold">Pre-executed tool call</h3>
            <code className="mt-1 block font-mono text-sm text-brand-700">{preview.tool_call_name}</code>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">{JSON.stringify(preview.pre_executed_draft_payload, null, 2)}</pre>
            {!isDone(preview) && <div className="mt-4">{approveButton(preview)}</div>}
          </>
        )}
      </Dialog>
    </div>
  );
}
