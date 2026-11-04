import type { PacingPlan, SessionPlan } from "@/types";

const session = (
  session_number: number,
  scheduled_date: string,
  ltp_type: SessionPlan["ltp_type"],
  topic_title: string,
): SessionPlan => ({
  session_id: `s${session_number}`,
  session_number,
  scheduled_date,
  topic_title,
  ltp_type,
  lecture_minutes_split: ltp_type === "P" ? 15 : 42,
  activity_minutes_split: ltp_type === "P" ? 45 : 18,
  pacing_delta_mins: 0,
  status: "SCHEDULED",
});

/** Sessions 12-18 replay the run-up to IA-1 (see the marks shown under OCR). */
export const fallbackPacing: PacingPlan = {
  offering_id: "demo-offering-cs304",
  course_code: "CS304",
  course_title: "Foundations of Computer Vision",
  l_ratio: 3,
  t_ratio: 0,
  p_ratio: 1,
  last_working_day: "2026-12-18",
  pedagogical_system_prompt:
    "Balanced conceptual explanation with real-world engineering examples and interactive problem solving.",
  milestones: [
    { label: "Internal Assessment 1", date: "2026-10-05", kind: "IA" },
    { label: "Internal Assessment 2", date: "2026-11-16", kind: "IA" },
    { label: "Last working day", date: "2026-12-18", kind: "LWD" },
    { label: "Semester End Exam starts", date: "2027-01-04", kind: "SEE" },
  ],
  sessions: [
    session(12, "2026-09-21", "L", "Depth from defocus and the thin-lens model"),
    session(13, "2026-09-22", "L", "Stereo geometry and the epipolar constraint"),
    session(14, "2026-09-24", "L", "Disparity and depth from rectified stereo"),
    session(15, "2026-09-25", "P", "Lab: calibrate a stereo pair and build a depth map"),
    session(16, "2026-09-28", "L", "Feature detection: Harris corners and SIFT"),
    session(17, "2026-09-29", "L", "Feature matching and RANSAC"),
    session(18, "2026-10-01", "L", "Homographies and image stitching"),
  ],
};
