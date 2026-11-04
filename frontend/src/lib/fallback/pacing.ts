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
  session_type: "REGULAR_CLASS",
  session_duration_mins: ltp_type === "P" ? 120 : 60,
  topic_title,
  ltp_type,
  lecture_minutes_split: ltp_type === "P" ? 0 : 42,
  activity_minutes_split: ltp_type === "P" ? 120 : 18,
  predicted_dip_minute: ltp_type === "P" ? null : 20,
  pacing_delta_mins: 0,
  status: "SCHEDULED",
});

/** Mirrors the backend seed's calendar around IA-1. */
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
    { label: "IA-1", date: "2026-11-18", kind: "IA" },
    { label: "IA-2", date: "2026-12-09", kind: "IA" },
    { label: "Last Working Day", date: "2026-12-18", kind: "LWD" },
    { label: "SEE (approx.)", date: "2026-12-28", kind: "SEE" },
  ],
  behind_session: 12,
  behind_mins: 15,
  sessions: [
    session(12, "2026-11-04", "L", "Feature Detection: Harris Corners & SIFT"),
    session(13, "2026-11-05", "P", "Lab: Edge & Feature Pipelines in OpenCV"),
    session(14, "2026-11-09", "L", "Camera Calibration & Homography"),
    session(15, "2026-11-10", "L", "Camera Calibration & Homography"),
    session(16, "2026-11-11", "L", "Stereo Vision & Epipolar Geometry"),
    session(17, "2026-11-12", "P", "Lab: Stereo Depth & Panorama Stitching"),
    session(18, "2026-11-16", "L", "Stereo Vision & Epipolar Geometry"),
  ],
};
