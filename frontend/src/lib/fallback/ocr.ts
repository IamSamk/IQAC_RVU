import type { OcrEvaluation } from "@/types";

export const fallbackEvaluation: OcrEvaluation = {
  eval_id: "demo-eval-ia1",
  usn: "1RVU23CSE042",
  student_name: "Aarav Sharma",
  exam_name: "IA-1 Examination",
  written_total: 29,
  cells: [
    { question: "Q1a", marks: 4, max: 5, conf: 0.98, co: "CO1" },
    { question: "Q1b", marks: 5, max: 5, conf: 0.99, co: "CO1" },
    { question: "Q2a", marks: 4, max: 5, conf: 0.97, co: "CO2" },
    { question: "Q2b", marks: 3, max: 5, conf: 0.82, co: "CO2" },
    { question: "Q3a", marks: 7, max: 10, conf: 0.96, co: "CO3" },
    { question: "Q3b", marks: 6, max: 10, conf: 0.97, co: "CO4" },
  ],
};

/** Marks from the three sheets already synced for this offering. */
export const SYNCED_COHORT: Record<string, { earned: number; max: number }> = {
  CO1: { earned: 24, max: 30 },
  CO2: { earned: 20, max: 30 },
  CO3: { earned: 18, max: 30 },
  CO4: { earned: 14, max: 30 },
};

export const ATTAINMENT_TARGET = 60;

export const CO_PO_MAP: { co: string; outcome: string; pos: string }[] = [
  { co: "CO1", outcome: "Model image formation in a camera", pos: "PO1, PO2" },
  { co: "CO2", outcome: "Apply radiometry and calibration", pos: "PO1, PO3" },
  { co: "CO3", outcome: "Analyse filtering and depth methods", pos: "PO2, PO4" },
  { co: "CO4", outcome: "Build a small vision pipeline", pos: "PO3, PO5" },
];
