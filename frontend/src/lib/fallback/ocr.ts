import type { CoAttainment, OcrEvaluation } from "@/types";

/** Mirrors the backend seed, so online and offline demos tell the same story. */
export const fallbackEvaluation: OcrEvaluation = {
  eval_id: "demo-eval-ia1",
  usn: "1RVU23CSE042",
  student_name: "Aarav Sharma",
  exam_name: "IA-1 Examination",
  written_total: 20,
  approved: false,
  feedback: "Strong on image formation and lens optics (8/10). Lost marks on radiometry and edge detection.",
  cells: [
    { question: "Q1a", marks: 4, max: 5, conf: 0.98, co: "CO1" },
    { question: "Q1b", marks: 4, max: 5, conf: 0.97, co: "CO1" },
    { question: "Q2a", marks: 3, max: 5, conf: 0.96, co: "CO1" },
    { question: "Q2b", marks: 3, max: 5, conf: 0.82, co: "CO1" },
    { question: "Q3a", marks: 2, max: 5, conf: 0.96, co: "CO2" },
    { question: "Q3b", marks: 4, max: 5, conf: 0.99, co: "CO2" },
  ],
};

export const fallbackAttainment: CoAttainment = {
  target_pct: 60,
  approved_sheets: 6,
  total_sheets: 7,
  outcomes: [
    { co: "CO1", avg_pct: 69.3, attainment_level: 3, n: 7 },
    { co: "CO2", avg_pct: 70, attainment_level: 3, n: 7 },
  ],
};

/** Illustrative only: the API does not return a CO-PO mapping yet. */
export const CO_PO_MAP: { co: string; outcome: string; pos: string }[] = [
  { co: "CO1", outcome: "Model image formation in a camera", pos: "PO1, PO2" },
  { co: "CO2", outcome: "Apply filtering and feature detection", pos: "PO1, PO3" },
  { co: "CO3", outcome: "Analyse calibration and stereo geometry", pos: "PO2, PO4" },
  { co: "CO4", outcome: "Build a small vision pipeline", pos: "PO3, PO5" },
];
