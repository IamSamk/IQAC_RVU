/**
 * The shapes the UI renders. Backend responses are mapped onto these in
 * lib/adapters.ts, so a backend change only needs an adapter change.
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
  session_type: string;
  session_duration_mins: number;
  topic_title: string;
  ltp_type: LtpType;
  lecture_minutes_split: number;
  activity_minutes_split: number;
  predicted_dip_minute: number | null;
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
  /** The session the timeline starts from, and how far behind it finished. */
  behind_session: number;
  behind_mins: number;
  sessions: SessionPlan[];
}

export interface RecalibrationSummary {
  plan: PacingPlan;
  carried_drift_mins: number;
  syllabus_finishes_on: string | null;
  finishes_before_lwd: boolean;
}

export interface StrataCurve {
  key: string;
  stratum: string;
  label: string;
  curve: number[];
  dip_minute: number;
}

export interface ActivitySplitRange {
  start: number;
  end: number;
}

export interface AttentionModel {
  t: number[];
  passive_curve: number[];
  active_intervened_curve: number[];
  strata_curves: StrataCurve[];
  dip_trigger_minute: number;
  activity_splits: ActivitySplitRange[];
  threshold: number;
  student_poll: { votes: number; avg_preferred_split_min: number | null };
  citations: string[];
}

export interface TranscriptLine {
  label: string;
  text: string;
}

export interface CheckpointTopic {
  label: string;
  slide: number | null;
}

export interface LiveSession {
  session_id: string;
  session_number: number;
  topic_title: string;
  chunk_id: string | null;
  slide_start: number | null;
  slide_end: number | null;
  lecture_minutes: number;
  transcript: TranscriptLine[];
  topics: CheckpointTopic[];
}

export interface LiveClassData {
  session: LiveSession;
  model: AttentionModel;
}

export interface CheckpointResult {
  checkpoint: string;
  minutes_behind: number;
  shifted_sessions: number[];
  syllabus_finishes_on: string | null;
}

export interface ActivityQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface QuestionSet {
  set_number: number;
  questions: ActivityQuestion[];
}

export interface TranscriptionResult {
  accepted: boolean;
  fallback_required: boolean;
  text: string | null;
  reason: string | null;
}

export interface UploadResult {
  evaluation: OcrEvaluation;
  engine: string;
  sampleOnly: boolean;
  usnWarning: string | null;
}

export interface ActivityResponse {
  learning_goal: string;
  delivery_platform: string;
  generator?: string;
  question_sets: QuestionSet[];
  platform_sync: Record<string, unknown>;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface QuizQuestion {
  question: string;
  /** Empty for numeric questions, which reveal their answer instead. */
  options: string[];
  answer: string;
  explanation?: string;
}

export interface KGNode {
  id: string;
  kind: "chunk" | "bridge";
  course_code: string;
  unit: number;
  chunk: number;
  /** When it was taught, such as "Session 4". */
  when?: string;
  title: string;
  weak: boolean;
  weak_reason?: string;
  notes_md: string;
  applied_example: string | null;
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
  courses?: { course_code: string; course_title: string }[];
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
  course_title: string;
  predecessor_code: string;
  predecessor_title: string;
  overlap_percent: number;
  threshold: number;
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
  approved: boolean;
  feedback?: string;
  cells: OcrCell[];
}

export interface CoOutcome {
  co: string;
  avg_pct: number;
  attainment_level?: number;
  n: number;
}

export interface CoAttainment {
  target_pct: number;
  approved_sheets: number;
  total_sheets: number;
  outcomes: CoOutcome[];
}

export interface EvaluationData {
  evaluation: OcrEvaluation;
  attainment: CoAttainment;
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

export interface OfferingCompliance {
  offering_id: string;
  course_code: string;
  course_title: string;
  faculty: string;
  ltp: string;
  sessions_completed: number;
  sessions_total: number;
  chunks_covered: number;
  chunks_total: number;
  net_pacing_delta_mins: number;
  approved_sheets: number;
  total_sheets: number;
}

export interface RubricConfig {
  cie_weight: number;
  see_weight: number;
  outcomes: string[];
  blooms_distribution: Record<string, number>;
}

export interface RbacRole {
  role_code: string;
  hierarchy_rank: number;
  permissions: string[];
}

export interface ComplianceData {
  offerings: OfferingCompliance[];
  rubric: RubricConfig;
  roles: RbacRole[];
  audit: AuditEntry[];
}

/* ---------- CO-PO mapping, quiz compiler, diagnostics ---------- */

export interface CoPoRow {
  co: string;
  outcome: string;
  pos_label: string;
  correlations: Record<string, number>;
  attainment_level: number | null;
}

export interface CoPoMapping {
  course_code: string;
  program_outcomes: { po: string; name: string }[];
  rows: CoPoRow[];
  po_attainment: { po: string; name: string; attainment: number | null }[];
}

export interface CompiledQuestion {
  question: string;
  answer?: string;
  options?: string[];
  marks: number;
  co: string;
  bloom: string;
  topic: string;
}

export interface QuizDraft {
  course_code: string;
  timeline: string;
  session_range: [number, number] | null;
  total_marks: number;
  co_split: Record<string, number>;
  blooms_split: Record<string, number>;
  questions: CompiledQuestion[];
}

export interface PracticePyq {
  question_text: string;
  exam_year: number;
}

export interface Diagnostics {
  /** Valid past-exam questions keyed by the weak chunk they practise. */
  pyqs_by_chunk: Record<string, PracticePyq[]>;
}
