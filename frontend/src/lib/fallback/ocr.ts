import type { CoAttainment, CoPoMapping, OcrEvaluation } from "@/types";

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

/** Offline copy of the backend's CO-PO mapping for CS304. */
export const CO_PO_MAP: { co: string; outcome: string; pos: string }[] = [
  { co: "CO1", outcome: "Analyse Image Formation & the Pinhole Camera Model, Lens Optics, Radiometry", pos: "PO1, PO2, PO5" },
  { co: "CO2", outcome: "Apply Image Filtering & Convolution, Edge Detection, Feature Detection", pos: "PO2, PO5" },
  { co: "CO3", outcome: "Analyse Camera Calibration & Homography, Stereo Vision, Optical Flow", pos: "PO2, PO5" },
  { co: "CO4", outcome: "Apply CNNs for Image Classification, Object Detection with YOLO, Semantic Segmentation", pos: "PO1, PO2, PO3, PO4, PO5" },
];

const PO_NAMES: Record<string, string> = {
  PO1: "Engineering knowledge",
  PO2: "Problem analysis",
  PO3: "Design of solutions",
  PO4: "Investigation of complex problems",
  PO5: "Modern tool usage",
};
const CORRELATIONS: Record<string, Record<string, number>> = {
  CO1: { PO1: 2, PO2: 2, PO3: 1, PO4: 1, PO5: 2 },
  CO2: { PO1: 1, PO2: 2, PO3: 1, PO4: 1, PO5: 2 },
  CO3: { PO1: 1, PO2: 2, PO3: 1, PO4: 1, PO5: 2 },
  CO4: { PO1: 1, PO2: 1, PO3: 1, PO4: 1, PO5: 1 },
};

export const fallbackCoPo: CoPoMapping = {
  course_code: "CS304",
  program_outcomes: Object.entries(PO_NAMES).map(([po, name]) => ({ po, name })),
  rows: CO_PO_MAP.map((row) => ({
    co: row.co,
    outcome: row.outcome,
    pos_label: row.pos,
    correlations: CORRELATIONS[row.co],
    attainment_level: row.co === "CO1" || row.co === "CO2" ? 3 : null,
  })),
  po_attainment: Object.entries(PO_NAMES).map(([po, name]) => ({ po, name, attainment: 3 })),
};
