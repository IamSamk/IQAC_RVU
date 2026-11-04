/**
 * Response shapes expected from the FastAPI backend. Field names follow the
 * Supabase schema. A response that does not match falls back to demo data
 * (see the validators in lib/api.ts).
 */

export type RoleId = "faculty" | "student" | "junior" | "iqac";
export type DataSource = "live" | "demo";
export type LtpType = "L" | "T" | "P";

export interface Milestone {
  label: string;
  date: string;
  kind: "IA" | "SEE" | "LWD";
}

export interface SessionPlan {
  session_id: string;
  session_number: number;
  scheduled_date: string;
  topic_title: string;
  ltp_type: LtpType;
  lecture_minutes_split: number;
  activity_minutes_split: number;
  pacing_delta_mins: number;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "RECALIBRATED";
}

export interface PacingPlan {
  offering_id: string;
  course_code: string;
  course_title: string;
  l_ratio: number;
  t_ratio: number;
  p_ratio: number;
  last_working_day: string;
  pedagogical_system_prompt: string;
  milestones: Milestone[];
  sessions: SessionPlan[];
}

export interface StrataCurve {
  key: string;
  label: string;
  curve: number[];
  dip_minute: number;
}

export interface AttentionModel {
  t: number[];
  passive_curve: number[];
  active_intervened_curve: number[];
  strata_curves: StrataCurve[];
  dip_trigger_minute: number;
}

export interface QuestionSet {
  set_number: number;
  question: string;
  options: string[];
  answer_index: number;
}

export interface ActivityResponse {
  learning_goal: string;
  delivery_platform: string;
  question_sets_json: QuestionSet[];
  webhook_payload: Record<string, unknown>;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer_index: number;
}

export interface KGNode {
  id: string;
  kind: "chunk" | "bridge";
  course_code: string;
  unit: number;
  chunk: number;
  day: number;
  title: string;
  weak: boolean;
  weak_reason?: string;
  notes_md: string;
  applied_example: string;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
}

export interface KGEdge {
  id: string;
  source: string;
  target: string;
  edge_type: "INTRA_COURSE_FLOW" | "CROSS_SUBJECT_BRIDGE";
  similarity_score?: number;
  shared_concepts?: string[];
}

export interface KnowledgeGraph {
  student_id: string;
  nodes: KGNode[];
  edges: KGEdge[];
}

export interface PyqQuestion {
  pyq_id: string;
  exam_year: number;
  exam_type: string;
  question_text: string;
  marks: number;
  similarity: number;
  origin_course_code: string;
  mapped_unit?: string;
  co_code?: string;
  status: "VALID" | "FILTERED_OUT_DEPRECATED";
  deprecated_reason?: string;
}

export interface PyqResult {
  course_code: string;
  predecessor_code: string;
  overlap_percent: number;
  approved_by: string;
  retained_topics: string[];
  added_topics: string[];
  deprecated_topics: string[];
  questions: PyqQuestion[];
}

export interface OcrCell {
  question: string;
  marks: number;
  max: number;
  conf: number;
  co: string;
}

export interface OcrEvaluation {
  eval_id: string;
  usn: string;
  student_name: string;
  exam_name: string;
  written_total: number;
  cells: OcrCell[];
}

export interface CopilotTask {
  task_id: string;
  task_title: string;
  due_timestamp: string;
  tool_call_name: string;
  summary: string;
  pre_executed_draft_payload: Record<string, unknown>;
  status: "AWAITING_HITL_APPROVAL" | "APPROVED_EXECUTED" | "EDITED_BY_FACULTY";
}

export interface MemoryLog {
  memory_id: string;
  memory_scope: string;
  memory_summary: string;
  created_at: string;
}

export interface AuditEntry {
  log_id: string;
  actor: string;
  action_type: string;
  detail: string;
  created_at: string;
}
