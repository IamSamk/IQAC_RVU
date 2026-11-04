import type { LiveSession } from "@/types";

const LINES: [slide: number, text: string][] = [
  [1, "Last session ended on the circle of confusion. Today we use that blur to estimate depth."],
  [2, "Start with the thin-lens equation: one over f equals one over u plus one over v."],
  [3, "Fix the sensor plane and only one scene depth is in perfect focus."],
  [4, "Every other depth spreads into a disc on the sensor. That disc is our measurement."],
  [5, "So how large is the disc? It depends on aperture diameter and on how far out of focus the point is."],
  [6, "Open the aperture and blur grows. Stop it down and the depth cue gets weaker."],
  [7, "This is exactly the f-number relation from Unit 1: N equals f over D."],
  [8, "Now take two images of the same scene with different focus settings."],
  [9, "Compare local sharpness patch by patch to see which image each point favours."],
  [10, "That ratio of blur gives a depth estimate without any second camera."],
  [11, "It fails on textureless regions because there is no sharpness to compare."],
  [12, "Before we move on, try the short activity on your screens."],
];

export const fallbackLiveSession: LiveSession = {
  session_id: "demo-session",
  session_number: 12,
  topic_title: "Depth from defocus and the thin-lens model",
  chunk_id: null,
  slide_start: 1,
  slide_end: 15,
  lecture_minutes: 42,
  transcript: LINES.map(([slide, text]) => ({ label: `S${slide}`, text })),
  topics: [
    { label: "Thin-lens equation", slide: 3 },
    { label: "Blur disc and aperture", slide: 7 },
    { label: "Comparing two focus settings", slide: 10 },
    { label: "Limits and practice problems", slide: 15 },
  ],
};
