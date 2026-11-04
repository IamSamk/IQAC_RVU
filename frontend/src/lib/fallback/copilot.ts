import type { AuditEntry, CopilotTask, MemoryLog } from "@/types";

export const fallbackTasks: CopilotTask[] = [
  {
    task_id: "task-quiz-4",
    task_title: "Biweekly Quiz #4 Drafted from Sessions 8-11",
    due_timestamp: "2026-11-06T09:00:00+05:30",
    tool_call_name: "compile_biweekly_quiz",
    summary: "10 questions covering CO1 to CO3, weighted towards the Apply level.",
    pre_executed_draft_payload: {
      questions: 10,
      sessions_covered: [8, 9, 10, 11],
      blooms: { understand: 3, apply: 4, analyze: 2, create: 1 },
      duration_mins: 20,
      publish_to: "Google Classroom",
    },
    status: "AWAITING_HITL_APPROVAL",
  },
  {
    task_id: "task-flashcards",
    task_title: "Remedial Flashcards Queued for 6 Students",
    due_timestamp: "2026-11-06T17:00:00+05:30",
    tool_call_name: "push_remedial_flashcards",
    summary: "Targets the bottom 15% of IA-1 scorers on radiometric calibration.",
    pre_executed_draft_payload: {
      students: 6,
      cohort: "bottom 15% of IA-1",
      weak_chunk: "CS304 Unit 1 Chunk 3",
      flashcards: 12,
    },
    status: "AWAITING_HITL_APPROVAL",
  },
  {
    task_id: "task-pacing",
    task_title: "Pacing Shift Calculated for Sessions 13-18",
    due_timestamp: "2026-11-05T08:00:00+05:30",
    tool_call_name: "recalibrate_pacing_calendar",
    summary: "Absorbs a 15-minute shortfall from Session 12 before the next assessment.",
    pre_executed_draft_payload: {
      shortfall_mins: 15,
      sessions_adjusted: [13, 14, 16, 17, 18],
      minutes_per_session: 3,
      practical_sessions_untouched: [15],
    },
    status: "AWAITING_HITL_APPROVAL",
  },
];

export const fallbackMemory: MemoryLog[] = [
  {
    memory_id: "m1",
    memory_scope: "TEACHER_PACING_HABIT",
    memory_summary: "Usually runs 10-15 minutes over on derivation-heavy lectures.",
    created_at: "2026-10-28T10:30:00+05:30",
  },
  {
    memory_id: "m2",
    memory_scope: "TOOL_PREFERENCE",
    memory_summary: "Prefers Mentimeter for activities in the morning slot.",
    created_at: "2026-10-21T09:15:00+05:30",
  },
  {
    memory_id: "m3",
    memory_scope: "STUDENT_WEAKNESS",
    memory_summary: "Section A lost the most IA-1 marks on Q2b, radiometric calibration.",
    created_at: "2026-10-12T16:40:00+05:30",
  },
];

export const fallbackAudit: AuditEntry[] = [
  {
    log_id: "a1",
    actor: "Prof. S. Darshan",
    action_type: "APPROVE_PYQ_MAPPING",
    detail: "Approved the CS204 to CS304 syllabus mapping at 78% overlap.",
    created_at: "2026-10-30T11:05:00+05:30",
  },
  {
    log_id: "a2",
    actor: "Dr. Veena A.",
    action_type: "UPDATE_RUBRIC",
    detail: "Confirmed the CIE 50 / SEE 50 rubric for CS304.",
    created_at: "2026-10-26T15:20:00+05:30",
  },
];
