import type { RoleId } from "@/types";
import { ROUTES } from "./rbac";

export interface DemoStep {
  title: string;
  minutes: number;
  role: RoleId;
  href: string;
  action: string;
}

/** The judge walkthrough. Minutes add up to 10. */
export const DEMO_STEPS: DemoStep[] = [
  {
    title: "Teacher persona and L:T:P plan",
    minutes: 1.5,
    role: "faculty",
    href: ROUTES.pacing.href,
    action: "Pick a teaching style, keep the 15-minute shortfall, and press Recalibrate Semester Plan.",
  },
  {
    title: "Live class and audio failure",
    minutes: 1.5,
    role: "faculty",
    href: ROUTES.live.href,
    action: "Press Simulate Mic/Wi-Fi Drop, then tap the slide reached. Pacing still recalibrates.",
  },
  {
    title: "Attention decay graphs",
    minutes: 1,
    role: "faculty",
    href: ROUTES.live.href,
    action: "Compare the passive curve with the activity resets, then change the cohort filter.",
  },
  {
    title: "10-set activity",
    minutes: 1,
    role: "faculty",
    href: ROUTES.live.href,
    action: "Launch the In-App 10-Set mode and compare Set 1 with Set 2.",
  },
  {
    title: "Cross-subject knowledge graph",
    minutes: 2,
    role: "student",
    href: ROUTES.graph.href,
    action: "Open a gold bridge node, then a red weak node, and flip a flashcard.",
  },
  {
    title: "Syllabus-diffed PYQs",
    minutes: 1,
    role: "junior",
    href: ROUTES.pyq.href,
    action: "Show the 78% overlap, then open the blocked outdated questions tray.",
  },
  {
    title: "OCR verification",
    minutes: 1,
    role: "faculty",
    href: ROUTES.evaluation.href,
    action: "Review the amber Q2b cell and press Verify & Sync to Google Sheets.",
  },
  {
    title: "Faculty Co-Pilot",
    minutes: 0.5,
    role: "faculty",
    href: ROUTES.evaluation.href,
    action: "Preview a pre-executed draft, approve it, and show the audit trail.",
  },
];
