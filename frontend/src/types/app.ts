/* Types for the account-based teacher and student app. */

export type Portal = "teacher" | "student" | "admin";

export interface SessionUser {
  user_id: string;
  full_name: string;
  email: string;
  institution_id: string;
  semester: number | null;
  section: string | null;
  role_code: string;
  rank: number;
  department: string | null;
  portal: Portal;
}

export interface TopicRef {
  chunk_id: string;
  title: string;
  unit: number;
}

export interface ClassCard {
  session_id: string;
  session_number: number;
  date: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "RECALIBRATED";
  session_type: string;
  ltp: "L" | "P";
  offering_id: string;
  section: string;
  time: string;
  course_id: string;
  course_code: string;
  course_title: string;
  topics: TopicRef[];
  has_notes: boolean;
  attendance_code?: string | null;
  teacher?: string;
  attended?: boolean;
}

export interface SectionSummary {
  offering_id: string;
  section: string;
  time: string;
  students: number;
  sessions_done: number;
  sessions_total: number;
  next_session: ClassCard | null;
}

export interface TeacherCourse {
  course_id: string;
  course_code: string;
  course_title: string;
  ltp: string;
  semester: number;
  uploaded: boolean;
  sections: SectionSummary[];
}

export interface TeacherHome {
  today: string;
  todays_classes: ClassCard[];
  upcoming: ClassCard[];
  courses: TeacherCourse[];
}

export interface UploadResult {
  course: { course_id: string; course_code: string; course_title: string; ltp: string; semester: number };
  parse_engine: string;
  units: { unit_number: number; title: string; topics: number }[];
  topics: number;
  course_outcomes: { co: string; statement: string }[];
  sections: { offering_id: string; section: string; time_slot: string; students: number; sessions: number; finishes_on: string | null }[];
  bridges: { from: string; to: string; similarity: number; shared: string[] }[];
}

export interface ChunkRow {
  chunk_id: string;
  unit_number: number;
  sequence_order: number;
  topic_title: string;
  syllabus_content: string;
  ltp_type: string;
  estimated_minutes: number;
  co_mapping: string;
  bloom_level: string;
  canonical_keywords: string[];
  slide_range: string;
}

export interface PlanSession {
  session_id: string;
  session_number: number;
  date: string;
  status: ClassCard["status"];
  session_type: string;
  duration: number;
  lecture_minutes: number;
  activity_minutes: number;
  pacing_delta_mins: number;
  topics: string[];
}

export interface CourseDetail {
  course: {
    course_id: string;
    course_code: string;
    course_title: string;
    semester: number;
    credits: number;
    l_ratio: number;
    t_ratio: number;
    p_ratio: number;
    last_working_day: string;
    course_outcomes: { co: string; statement: string }[] | null;
  };
  units: { unit_number: number; topics: ChunkRow[] }[];
  sections: {
    offering_id: string;
    section: string;
    time: string;
    dip_minute: number;
    activity_splits: { start: number; end: number }[];
    progress: { sessions_completed: number; sessions_total: number; chunks_covered: number; chunks_total: number; net_pacing_delta_mins: number };
    sessions: PlanSession[];
  }[];
  upload: { file_name: string; parse_engine: string; created_at: string } | null;
}

export interface RosterRow {
  student_id: string;
  name: string;
  usn: string;
  present: boolean;
  checked_in_at: string | null;
}

export interface LiveClass {
  session: {
    session_id: string;
    session_number: number;
    scheduled_date: string;
    status: ClassCard["status"];
    session_type: string;
    session_duration_mins: number;
    lecture_minutes_split: number;
    activity_minutes_split: number;
    attendance_code: string | null;
    started_at: string | null;
    ended_at: string | null;
    lesson_plan_md: string | null;
    generated_class_notes_md: string | null;
    live_transcript_text: string | null;
    pacing_delta_mins: number;
  };
  course: { course_id: string; course_code: string; course_title: string };
  offering: { offering_id: string; section: string; time: string };
  topics: { chunk_id: string; title: string; content: string; unit: number; slide_range: string | null; keywords: string[] }[];
  attention: { dip_minute: number; activity_splits: { start: number; end: number }[]; t: number[]; passive: number[]; active: number[] };
  roster: RosterRow[];
  present_count: number;
  enrolled_count: number;
  activity: { activity_id: string; delivery_platform: string; trigger_minute: number; learning_goal: string } | null;
}

export interface ActivityQuestion {
  type?: string;
  question: string;
  options?: string[];
  answer?: string;
  explanation?: string;
}

export interface ActivityLaunch {
  activity_id: string;
  trigger_minute: number;
  learning_goal: string;
  generator: string;
  question_sets: { set_number: number; questions: ActivityQuestion[] }[];
}

export interface MyActivity {
  activity_id?: string;
  learning_goal?: string;
  set_number?: number;
  total_sets?: number;
  questions?: ActivityQuestion[];
}

export interface StudentCourse {
  course_id: string;
  course_code: string;
  course_title: string;
  section: string;
  teacher: string | null;
  category: string;
  sessions_done: number;
  sessions_total: number;
  attended: number;
}

export interface NoteSummary {
  session_id: string;
  course_code: string;
  session_number: number;
  date: string;
  topics: string[];
  attended: boolean;
}

export interface StudentHome {
  today: string;
  todays_classes: ClassCard[];
  courses: StudentCourse[];
  recent_notes: NoteSummary[];
}

export interface SessionNotes {
  session_id: string;
  session_number: number;
  scheduled_date: string;
  status: string;
  generated_class_notes_md: string | null;
  course_code: string;
  course_title: string;
  section: string;
  topics: string[];
}

export interface EndClassResult {
  generated_class_notes_md: string;
  recalibration: { minutes_behind: number; shifted_sessions: number[]; uncovered_carried_over: string[]; plan: { syllabus_finishes_on: string; finishes_before_lwd: boolean } };
}
