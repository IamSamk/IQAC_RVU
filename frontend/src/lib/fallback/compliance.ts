import type { ComplianceData } from "@/types";

export const fallbackCompliance: ComplianceData = {
  offerings: [
    {
      offering_id: "demo-cs304",
      course_code: "CS304",
      course_title: "Foundations of Computer Vision",
      faculty: "Prof. S. Darshan",
      ltp: "3:0:1",
      sessions_completed: 12,
      sessions_total: 37,
      chunks_covered: 6,
      chunks_total: 16,
      net_pacing_delta_mins: -15,
      approved_sheets: 6,
      total_sheets: 7,
    },
    {
      offering_id: "demo-des201",
      course_code: "DES201",
      course_title: "Digital Photography & Optics",
      faculty: "Prof. Veena K.",
      ltp: "2:0:2",
      sessions_completed: 10,
      sessions_total: 37,
      chunks_covered: 3,
      chunks_total: 10,
      net_pacing_delta_mins: 0,
      approved_sheets: 0,
      total_sheets: 0,
    },
  ],
  rubric: {
    cie_weight: 50,
    see_weight: 50,
    outcomes: ["CO1", "CO2", "CO3", "CO4"],
    blooms_distribution: { understand: 25, apply: 40, analyze: 25, create: 10 },
  },
  roles: [
    { role_code: "IQAC_ADMIN", hierarchy_rank: 100, permissions: ["all"] },
    { role_code: "DEAN", hierarchy_rank: 90, permissions: ["view department", "approve curriculum"] },
    { role_code: "HOD", hierarchy_rank: 80, permissions: ["approve pacing", "view department"] },
    { role_code: "COURSE_LEAD", hierarchy_rank: 70, permissions: ["teach", "edit syllabus", "approve pyq mapping"] },
    { role_code: "FACULTY", hierarchy_rank: 60, permissions: ["teach", "approve ocr", "edit pacing"] },
    { role_code: "TA", hierarchy_rank: 40, permissions: ["grade draft", "view course"] },
    { role_code: "ADMIN_STAFF", hierarchy_rank: 30, permissions: ["view reports"] },
    { role_code: "STUDENT", hierarchy_rank: 10, permissions: ["view own", "vote attention"] },
  ],
  audit: [
    {
      log_id: "a1",
      actor: "Prof. Rao",
      action_type: "APPROVE_PYQ_MAPPING",
      detail: "Approved the CS204-2024 to CS304 syllabus mapping.",
      created_at: "2026-10-30T11:05:00+05:30",
    },
  ],
};
