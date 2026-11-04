import type { PyqQuestion, PyqResult } from "@/types";

const valid = (
  id: string,
  exam_year: number,
  exam_type: string,
  question_text: string,
  marks: number,
  similarity: number,
  mapped_unit: string,
  co_code: string,
): PyqQuestion => ({
  pyq_id: id,
  exam_year,
  exam_type,
  question_text,
  marks,
  similarity,
  mapped_unit,
  co_code,
  origin_course_code: "CS204",
  status: "VALID",
});

const blocked = (
  id: string,
  exam_year: number,
  exam_type: string,
  question_text: string,
  marks: number,
  similarity: number,
  deprecated_reason: string,
): PyqQuestion => ({
  pyq_id: id,
  exam_year,
  exam_type,
  question_text,
  marks,
  similarity,
  deprecated_reason,
  origin_course_code: "CS204",
  status: "FILTERED_OUT_DEPRECATED",
});

export const fallbackPyq: PyqResult = {
  course_code: "CS304",
  predecessor_code: "CS204",
  overlap_percent: 78,
  approved_by: "Course Lead, Prof. S. Darshan",
  retained_topics: ["Pinhole camera model", "Thin lens and aperture", "Spatial filtering", "Edge detection", "Camera calibration"],
  added_topics: ["Radiometric calibration", "Depth from defocus", "Stereo depth", "Feature matching and RANSAC"],
  deprecated_topics: ["CRT display gamma", "Analog film grain", "Analog video signal sampling"],
  questions: [
    valid("p1", 2024, "SEE", "Derive the perspective projection equations of a pinhole camera and state the role of focal length.", 10, 0.96, "2026 Unit 1", "CO1"),
    valid("p2", 2024, "IA1", "Define f-number. Explain how changing it affects the circle of confusion and depth of field.", 5, 0.93, "2026 Unit 1", "CO1"),
    valid("p3", 2023, "SEE", "Compare Gaussian and median filters for removing noise from an image, with one use case for each.", 10, 0.91, "2026 Unit 2", "CO3"),
    valid("p4", 2023, "IA2", "List the stages of the Canny edge detector and justify non-maximum suppression.", 10, 0.94, "2026 Unit 2", "CO3"),
    valid("p5", 2024, "SEE", "Write the intrinsic matrix of a camera and describe a checkerboard calibration procedure.", 10, 0.92, "2026 Unit 2", "CO2"),
    valid("p6", 2022, "SEE", "Explain why image irradiance depends on the f-number of the lens.", 5, 0.87, "2026 Unit 1", "CO2"),
    valid("p7", 2023, "IA1", "Explain how sensor gain affects image noise and the usable signal.", 5, 0.86, "2026 Unit 1", "CO2"),
    valid("p8", 2022, "IA2", "Explain the effect of the Sobel operator on an image and compute its gradient magnitude.", 5, 0.89, "2026 Unit 2", "CO3"),
    blocked("d1", 2022, "SEE", "Derive the gamma correction needed for a CRT display and sketch its response curve.", 10, 0.41, "CRT display gamma was removed from the 2026 syllabus."),
    blocked("d2", 2023, "IA1", "Describe how film grain size affects the resolution of an analog photograph.", 5, 0.37, "Analog film was removed from the 2026 syllabus."),
    blocked("d3", 2022, "IA2", "Explain interlaced scanning in analog video and its effect on sampling.", 5, 0.52, "Analog video signals were removed from the 2026 syllabus."),
  ],
};
