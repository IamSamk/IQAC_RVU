import type { CopilotTask, MemoryLog } from "@/types";

export const fallbackTasks: CopilotTask[] = [
  {
    task_id: "demo-task-quiz",
    task_title: "Biweekly Quiz #4 Drafted from Sessions 8-11",
    due_timestamp: "2026-11-06T09:00:00+05:30",
    tool_call_name: "compile_biweekly_quiz",
    summary: "10 questions covering CO1 and CO2, weighted towards the Apply level.",
    pre_executed_draft_payload: {
      questions: 10,
      source_sessions: [8, 9, 10, 11],
      blooms_split: { understand: 3, apply: 4, analyze: 2, create: 1 },
      duration_mins: 20,
    },
    status: "AWAITING_HITL_APPROVAL",
  },
  {
    task_id: "demo-task-flashcards",
    task_title: "Remedial Flashcards Queued for 6 Students",
    due_timestamp: "2026-11-06T17:00:00+05:30",
    tool_call_name: "push_remedial_flashcards",
    summary: "Targets the lowest IA-1 scorers on radiometry and edge detection.",
    pre_executed_draft_payload: {
      students: 6,
      channel: "whatsapp+in_app",
      deck_size: 12,
    },
    status: "AWAITING_HITL_APPROVAL",
  },
  {
    task_id: "demo-task-pacing",
    task_title: "Recalibrate Pacing: Session 12 ran 15 min behind",
    due_timestamp: "2026-11-05T08:00:00+05:30",
    tool_call_name: "recalibrate_pacing_calendar",
    summary: "Absorbs the 15-minute shortfall from Session 12 before IA-1.",
    pre_executed_draft_payload: {
      behind_by_mins: 15,
      shifted_sessions: [13, 14, 15, 16, 17, 18],
      ia1_buffer_preserved: true,
    },
    status: "AWAITING_HITL_APPROVAL",
  },
];

export const fallbackMemory: MemoryLog[] = [
  {
    memory_id: "m1",
    memory_scope: "TEACHER_PACING_HABIT",
    memory_summary: "Runs 10-15 minutes over on derivation-heavy chunks; finishes labs early.",
    created_at: "2026-10-28T10:30:00+05:30",
  },
  {
    memory_id: "m2",
    memory_scope: "TOOL_PREFERENCE",
    memory_summary: "Prefers Mentimeter for activities in the morning slot.",
    created_at: "2026-10-21T09:15:00+05:30",
  },
];
