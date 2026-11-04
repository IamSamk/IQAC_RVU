import type {
  ActivityResponse,
  AttentionModel,
  AuditEntry,
  CheckpointResult,
  CheckpointTopic,
  CoAttainment,
  ComplianceData,
  CopilotTask,
  Flashcard,
  KGEdge,
  KGNode,
  KnowledgeGraph,
  LiveSession,
  LtpType,
  MemoryLog,
  Milestone,
  OcrCell,
  OcrEvaluation,
  PacingPlan,
  PyqQuestion,
  PyqResult,
  QuizQuestion,
  RecalibrationSummary,
  SessionPlan,
  StrataCurve,
  TranscriptionResult,
  UploadResult,
} from "@/types";

/**
 * Maps FastAPI responses onto the UI types. These throw on a missing required
 * field; api.ts treats that as "use the demo data" rather than crashing a view.
 */

const COURSE_LEAD_ID = "20000000-0000-0000-0000-000000000004";
const IA_LOOKAHEAD_SESSIONS = 6;

const SPECIAL_TERMS: Record<string, string> = { iso: "ISO", sift: "SIFT", hdr: "HDR", dslr: "DSLR", raw: "RAW", ransac: "RANSAC", opencv: "OpenCV", cnn: "CNN" };

/** Syllabus keywords arrive in lower or naive title case, which mangles acronyms. */
const titleCase = (text: string) =>
  text.replace(/\b\w+/g, (word) => SPECIAL_TERMS[word.toLowerCase()] ?? word.charAt(0).toUpperCase() + word.slice(1));

const uniqueByFront = (cards: Flashcard[]) => [...new Map(cards.map((card) => [card.front, card])).values()];

function need<T>(value: T | null | undefined, name: string): T {
  if (value === null || value === undefined) throw new Error(`Missing ${name}`);
  return value;
}

/* ---------- Pacing ---------- */

function milestoneKind(name: string): Milestone["kind"] {
  if (/last working/i.test(name)) return "LWD";
  if (/see|semester end/i.test(name)) return "SEE";
  return "IA";
}

function ltpTypeOf(raw: any): LtpType {
  const topic = raw.planned_topics?.[0]?.topic_title ?? "";
  if (/^lab\b/i.test(topic) || raw.session_duration_mins > 90) return "P";
  return "L";
}

function adaptSession(raw: any): SessionPlan {
  return {
    session_id: need(raw.session_id, "session_id"),
    session_number: need(raw.session_number, "session_number"),
    scheduled_date: need(raw.scheduled_date, "scheduled_date"),
    session_type: raw.session_type ?? "REGULAR_CLASS",
    session_duration_mins: raw.session_duration_mins ?? 60,
    topic_title: raw.planned_topics?.[0]?.topic_title ?? "Unassigned",
    ltp_type: ltpTypeOf(raw),
    lecture_minutes_split: raw.lecture_minutes_split ?? 0,
    activity_minutes_split: raw.activity_minutes_split ?? 0,
    predicted_dip_minute: raw.predicted_dip_minute ?? null,
    pacing_delta_mins: raw.pacing_delta_mins ?? 0,
    status: raw.status ?? "SCHEDULED",
  };
}

export function adaptPacing(raw: any): PacingPlan {
  const all: SessionPlan[] = need(raw.sessions, "sessions").map(adaptSession);
  const completed = all.filter((session) => session.status === "COMPLETED");
  const behind =
    [...completed].reverse().find((session) => session.pacing_delta_mins < 0) ?? completed[completed.length - 1] ?? all[0];
  const sessions = all.filter(
    (session) =>
      session.session_type === "REGULAR_CLASS" &&
      session.session_number >= behind.session_number &&
      session.session_number <= behind.session_number + IA_LOOKAHEAD_SESSIONS,
  );

  return {
    offering_id: need(raw.offering?.offering_id, "offering_id"),
    course_code: need(raw.course?.course_code, "course_code"),
    course_title: need(raw.course?.course_title, "course_title"),
    l_ratio: raw.course.l_ratio,
    t_ratio: raw.course.t_ratio,
    p_ratio: raw.course.p_ratio,
    last_working_day: need(raw.course.last_working_day, "last_working_day"),
    pedagogical_system_prompt: raw.faculty?.pedagogical_system_prompt ?? "",
    milestones: (raw.milestones ?? []).map((item: any) => ({ label: item.name, date: item.date, kind: milestoneKind(item.name) })),
    behind_session: behind.session_number,
    behind_mins: Math.abs(Math.min(0, behind.pacing_delta_mins)),
    sessions,
  };
}

export function adaptRecalibration(raw: any): RecalibrationSummary {
  return {
    plan: adaptPacing(need(raw.plan, "plan")),
    carried_drift_mins: raw.summary?.carried_drift_mins ?? 0,
    syllabus_finishes_on: raw.summary?.syllabus_finishes_on ?? null,
    finishes_before_lwd: Boolean(raw.summary?.finishes_before_lwd),
  };
}

/** Flags sessions whose topic, date or split changed, so the timeline can highlight them. */
export function markShifted(before: SessionPlan[], after: SessionPlan[]): SessionPlan[] {
  const previous = new Map(before.map((session) => [session.session_number, session]));
  return after.map((session) => {
    const old = previous.get(session.session_number);
    const changed =
      old !== undefined &&
      session.status !== "COMPLETED" &&
      (old.topic_title !== session.topic_title ||
        old.scheduled_date !== session.scheduled_date ||
        old.lecture_minutes_split !== session.lecture_minutes_split);
    return changed ? { ...session, status: "RECALIBRATED" as const } : session;
  });
}

/* ---------- Live class ---------- */

function slideBounds(range: unknown): [number, number] | null {
  const match = typeof range === "string" ? range.match(/(\d+)\s*-\s*(\d+)/) : null;
  return match ? [Number(match[1]), Number(match[2])] : null;
}

/**
 * The classroom feed is simulated, so its lines come from the session's approved
 * syllabus text. That keeps it on topic whichever session is current.
 */
export function adaptLiveSession(current: any, chunks: any[]): LiveSession {
  const topic = current.planned_topics?.[0];
  const chunk = chunks.find((item) => item.chunk_id === topic?.chunk_id);
  const bounds = slideBounds(topic?.slide_range);
  const title: string = topic?.topic_title ?? "Current session";
  const sentences: string[] = (chunk?.syllabus_content ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence: string) => sentence.trim())
    .filter(Boolean);
  const keywords: string[] = chunk?.canonical_keywords ?? [];

  const lines = [
    `Today we are working on ${title}.`,
    ...sentences,
    ...keywords.map((keyword) => `Note ${titleCase(keyword)}: it comes up in today's activity.`),
  ];
  const position = (index: number, count: number) =>
    bounds ? Math.round(bounds[0] + (index / Math.max(1, count - 1)) * (bounds[1] - bounds[0])) : null;

  const topics: CheckpointTopic[] = (keywords.length ? keywords : [title]).map((keyword, index, list) => ({
    label: titleCase(keyword),
    slide: position(index, list.length),
  }));

  return {
    session_id: need(current.session_id, "session_id"),
    session_number: need(current.session_number, "session_number"),
    topic_title: title,
    chunk_id: topic?.chunk_id ?? null,
    slide_start: bounds?.[0] ?? null,
    slide_end: bounds?.[1] ?? null,
    lecture_minutes: current.lecture_minutes_split ?? 45,
    transcript: lines.map((text, index) => {
      const slide = position(index, lines.length);
      return { label: slide === null ? "Lab" : `S${slide}`, text };
    }),
    topics,
  };
}

function adaptStrata(raw: any): StrataCurve {
  return {
    key: need(raw.key, "strata key"),
    stratum: raw.stratum ?? raw.key,
    label: raw.label ?? raw.key,
    curve: need(raw.curve, "strata curve"),
    dip_minute: need(raw.dip_minute, "dip_minute"),
  };
}

export function adaptAttention(raw: any): AttentionModel {
  return {
    t: need(raw.t, "t"),
    passive_curve: need(raw.passive_curve, "passive_curve"),
    active_intervened_curve: need(raw.active_intervened_curve, "active_intervened_curve"),
    strata_curves: (raw.strata_curves ?? []).map(adaptStrata),
    dip_trigger_minute: need(raw.dip_trigger_minute, "dip_trigger_minute"),
    activity_splits: raw.activity_splits ?? [],
    threshold: raw.threshold ?? 55,
    student_poll: {
      votes: raw.student_poll?.votes ?? 0,
      avg_preferred_split_min: raw.student_poll?.avg_preferred_split_min ?? null,
    },
    citations: raw.citations ?? [],
  };
}

export function adaptCheckpoint(raw: any): CheckpointResult {
  return {
    checkpoint: raw.checkpoint ?? "Checkpoint saved",
    minutes_behind: raw.minutes_behind ?? 0,
    shifted_sessions: raw.recalibration?.shifted_sessions ?? [],
    syllabus_finishes_on: raw.recalibration?.plan?.syllabus_finishes_on ?? null,
  };
}

/** Generated answers may be the text, a letter ("B"), or vary in case. Returns the matching option. */
function matchOption(answer: string, options: string[]): string | undefined {
  const target = answer.trim().toLowerCase();
  const letter = target.match(/^([a-d])(?:[).:\s]|$)/)?.[1];
  return (
    options.find((option) => option.trim().toLowerCase() === target) ??
    (letter ? options[letter.charCodeAt(0) - 97] : undefined) ??
    options.find((option) => target.startsWith(option.trim().toLowerCase()) || option.trim().toLowerCase().startsWith(target))
  );
}

function adaptQuestion(raw: any): QuizQuestion {
  const options: string[] = (raw.options ?? []).map(String);
  const answer = String(need(raw.answer, "answer"));
  const matched = matchOption(answer, options);
  return {
    question: need(raw.question, "question"),
    // With no identifiable correct option, reveal the answer rather than mark every choice wrong.
    options: matched ? options : [],
    answer: matched ?? answer,
    explanation: raw.explanation,
  };
}

export function adaptActivity(raw: any): ActivityResponse {
  const platform: string = raw.delivery_platform ?? "IN_APP_10_SETS";
  const sets = need(raw.question_sets, "question_sets");
  if (sets.length === 0) throw new Error("No question sets");
  return {
    learning_goal: raw.learning_goal ?? "",
    delivery_platform: platform,
    generator: raw.generator,
    question_sets: sets.map((set: any, index: number) => ({ set_number: set.set_number ?? index + 1, questions: set.questions.map(adaptQuestion) })),
    platform_sync: raw.platform_sync?.[platform] ?? {},
  };
}

export function adaptTranscription(raw: any): TranscriptionResult {
  return {
    accepted: Boolean(raw.accepted),
    fallback_required: Boolean(raw.fallback_required),
    text: raw.text ?? null,
    reason: raw.reason ?? null,
  };
}

/* ---------- Knowledge graph ---------- */

function notesFor(raw: any): string {
  const drawer = raw.drawer ?? {};
  const compiled = (drawer.class_notes ?? []).find((note: any) => note.notes_md)?.notes_md;
  return compiled ?? drawer.syllabus_content ?? "";
}

function adaptNode(raw: any): KGNode {
  const taught: number[] = (raw.drawer?.class_notes ?? []).map((note: any) => note.session_number);
  const session = taught.length ? Math.min(...taught) : null;
  return {
    id: need(raw.id, "node id"),
    kind: "chunk",
    course_code: raw.course_code,
    unit: raw.unit,
    chunk: raw.sequence,
    when: session ? `Session ${session}` : undefined,
    title: need(raw.label, "node label"),
    weak: Boolean(raw.is_weak),
    weak_reason: raw.is_weak ? "Lost marks in IA-1" : undefined,
    notes_md: notesFor(raw),
    applied_example: raw.drawer?.applied_cross_course_example ?? null,
    flashcards: (raw.drawer?.flashcards ?? []).map((card: any) => ({ front: titleCase(card.front), back: card.back })),
    quiz: (raw.drawer?.quick_quiz ?? []).map(adaptQuestion),
  };
}

/**
 * The API links bridged chunks directly. The UI draws a gold node between them,
 * so each bridge becomes a node with an edge to each side.
 */
export function adaptGraph(raw: any): KnowledgeGraph {
  const nodes: KGNode[] = need(raw.nodes, "nodes").map(adaptNode);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges: KGEdge[] = need(raw.edges, "edges")
    .filter((edge: any) => edge.type === "INTRA_COURSE_FLOW")
    .map((edge: any) => ({ id: edge.id, source: edge.source, target: edge.target, edge_type: "INTRA_COURSE_FLOW" as const }));

  for (const bridge of raw.bridges ?? []) {
    const id = `bridge-${bridge.edge_id}`;
    const source = byId.get(bridge.source?.chunk_id);
    const target = byId.get(bridge.target?.chunk_id);
    if (!source || !target) continue;
    nodes.push({
      id,
      kind: "bridge",
      course_code: "BRIDGE",
      unit: 0,
      chunk: 0,
      title: bridge.label,
      weak: false,
      notes_md: `${source.course_code} Unit ${source.unit}, Chunk ${source.chunk}: ${source.title}\n\n${target.course_code} Unit ${target.unit}, Chunk ${target.chunk}: ${target.title}`,
      applied_example: bridge.grounded_application_example ?? null,
      flashcards: uniqueByFront([...source.flashcards, ...target.flashcards]).slice(0, 4),
      quiz: [...source.quiz.slice(0, 2), ...target.quiz.slice(0, 1)],
    });
    const shared = { edge_type: "CROSS_SUBJECT_BRIDGE" as const, similarity_score: bridge.similarity_score, shared_concepts: bridge.shared_concepts };
    edges.push({ id: `${id}-a`, source: source.id, target: id, ...shared }, { id: `${id}-b`, source: id, target: target.id, ...shared });
  }

  return { student_id: raw.student_id, nodes, edges };
}

/* ---------- PYQ ---------- */

const unique = (values: (string | null | undefined)[]) => [...new Set(values.filter((value): value is string => Boolean(value)))];

export function adaptPyq(raw: any): PyqResult {
  const predecessor = raw.predecessors?.[0];
  const valid = need(raw.valid, "valid");
  const filtered = need(raw.filtered_out, "filtered_out");
  const originCode: string = predecessor?.course_code ?? "";

  const toQuestion = (question: any, status: PyqQuestion["status"]): PyqQuestion => ({
    pyq_id: question.pyq_id,
    exam_year: question.exam_year,
    exam_type: question.exam_type,
    question_text: question.question_text,
    marks: question.marks,
    similarity: question.similarity,
    origin_course_code: originCode,
    mapped_unit: status === "VALID" ? question.current_unit_tag ?? undefined : undefined,
    co_code: question.co_code ?? undefined,
    status,
    deprecated_reason:
      status === "VALID"
        ? undefined
        : question.original_topic
          ? `${question.original_topic} is no longer in the 2026 syllabus.`
          : "Below the similarity threshold for the 2026 syllabus.",
  });

  return {
    course_code: need(raw.course?.course_code, "course_code"),
    course_title: raw.course.course_title,
    predecessor_code: originCode,
    predecessor_title: predecessor?.course_title ?? "",
    overlap_percent: Math.round((raw.syllabus_overlap ?? 0) * 100),
    threshold: raw.threshold ?? 0.85,
    approved_by: raw.verified_by === COURSE_LEAD_ID ? "Course Lead, Prof. Rao" : "the Course Lead",
    retained_topics: unique(valid.map((question: any) => question.original_topic)),
    added_topics: [],
    deprecated_topics: unique(filtered.map((question: any) => question.original_topic)),
    questions: [...valid.map((question: any) => toQuestion(question, "VALID")), ...filtered.map((question: any) => toQuestion(question, "FILTERED_OUT_DEPRECATED"))],
  };
}

/* ---------- OCR ---------- */

function adaptEvaluationRecord(record: any, usn: string, name: string): OcrEvaluation {
  const marks = need(record.question_marks_json, "question_marks_json");
  const cells: OcrCell[] = Object.entries<any>(marks)
    .filter(([question]) => question !== "TOTAL")
    .map(([question, cell]) => ({ question, marks: cell.marks, max: cell.max, conf: cell.conf, co: cell.co ?? "CO1" }));
  return {
    eval_id: need(record.eval_id, "eval_id"),
    usn,
    student_name: name,
    exam_name: record.exam_name,
    written_total: marks.TOTAL?.written_total ?? marks.TOTAL?.marks ?? cells.reduce((sum, cell) => sum + cell.marks, 0),
    approved: Boolean(record.faculty_approved),
    feedback: record.ai_diagnostic_feedback ?? undefined,
    cells,
  };
}

/** Prefers the sheet still awaiting review, so the verification step can be shown. */
export function adaptEvaluationList(raw: any[], preferredUsn: string): OcrEvaluation {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("No evaluations");
  const record =
    raw.find((item) => item.users?.institution_id === preferredUsn && !item.faculty_approved) ??
    raw.find((item) => !item.faculty_approved) ??
    raw.find((item) => item.users?.institution_id === preferredUsn) ??
    raw[0];
  return adaptEvaluationRecord(record, record.users?.institution_id ?? "", record.users?.full_name ?? "");
}

/** If the vision engine is unavailable, the backend falls back to a sample sheet and says so in `mode`. */
export function adaptUpload(raw: any): UploadResult {
  const mode: string = raw.ocr_engine?.mode ?? "SAMPLE_CASE";
  return {
    evaluation: adaptEvaluationRecord(need(raw.evaluation, "evaluation"), raw.student?.institution_id ?? "", raw.student?.full_name ?? ""),
    engine: mode,
    sampleOnly: mode === "SAMPLE_CASE",
    usnWarning: (raw.hitl_flags ?? []).find((flag: any) => flag.q === "USN")?.reason ?? null,
  };
}

export function adaptAttainment(raw: any): CoAttainment {
  return {
    target_pct: raw.target_pct ?? 60,
    approved_sheets: raw.approved_sheets ?? 0,
    total_sheets: raw.total_sheets ?? 0,
    outcomes: need(raw.outcomes, "outcomes").map((outcome: any) => ({
      co: outcome.co,
      avg_pct: outcome.avg_pct,
      attainment_level: outcome.attainment_level,
      n: outcome.n ?? 0,
    })),
  };
}

/* ---------- Co-Pilot and compliance ---------- */

const humanize = (text: string) => text.replace(/_/g, " ");

export function adaptTasks(raw: any[]): CopilotTask[] {
  if (!Array.isArray(raw)) throw new Error("Expected a task list");
  return raw.map((task) => {
    const payload = task.pre_executed_draft_payload ?? {};
    const course = task.course_offerings?.courses?.course_code;
    return {
      task_id: need(task.task_id, "task_id"),
      task_title: task.task_title,
      due_timestamp: task.due_timestamp,
      tool_call_name: task.tool_call_name,
      summary: typeof payload.summary === "string" ? payload.summary : `${course ? `${course}: ` : ""}draft ready for your review.`,
      pre_executed_draft_payload: payload,
      status: task.status,
    };
  });
}

export function adaptMemory(raw: any[]): MemoryLog[] {
  if (!Array.isArray(raw)) throw new Error("Expected a memory list");
  return raw.map((memory) => ({
    memory_id: memory.memory_id,
    memory_scope: memory.memory_scope,
    memory_summary: memory.memory_summary,
    created_at: memory.created_at,
  }));
}

function auditDetail(entry: any): string {
  const diff = entry.payload_diff ?? {};
  const pairs = Object.entries(diff).map(([key, value]) => `${humanize(key)}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
  return pairs.join(", ") || entry.target_table || "";
}

export function adaptAudit(raw: any[]): AuditEntry[] {
  if (!Array.isArray(raw)) throw new Error("Expected an audit list");
  return raw.map((entry) => ({
    log_id: entry.log_id,
    actor: entry.users?.full_name ?? "System",
    action_type: entry.action_type,
    detail: auditDetail(entry),
    created_at: entry.created_at,
  }));
}

export function adaptCompliance(raw: any, audit: AuditEntry[]): ComplianceData {
  const offerings = need(raw.offerings, "offerings");
  if (offerings.length === 0) throw new Error("No offerings");
  return {
    offerings: offerings.map((offering: any) => ({
      offering_id: offering.offering_id,
      course_code: offering.course_code,
      course_title: offering.course_title,
      faculty: offering.faculty ?? "Unassigned",
      ltp: offering.ltp,
      sessions_completed: offering.progress?.sessions_completed ?? 0,
      sessions_total: offering.progress?.sessions_total ?? 0,
      chunks_covered: offering.progress?.chunks_covered ?? 0,
      chunks_total: offering.progress?.chunks_total ?? 0,
      net_pacing_delta_mins: offering.progress?.net_pacing_delta_mins ?? 0,
      approved_sheets: offering.co_attainment?.approved_sheets ?? 0,
      total_sheets: offering.co_attainment?.total_sheets ?? 0,
    })),
    rubric: need(offerings[0].rubric, "rubric"),
    roles: (raw.rbac_matrix ?? []).map((role: any) => ({
      role_code: role.role_code,
      hierarchy_rank: role.hierarchy_rank,
      permissions: Object.entries(role.permissions ?? {})
        .filter(([, allowed]) => allowed)
        .map(([permission]) => humanize(permission)),
    })),
    audit,
  };
}
