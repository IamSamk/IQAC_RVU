import type { LtpType, SessionPlan } from "@/types";
import type { Stratum } from "./attention";

/** Activity time is protected down to this floor when absorbing a shortfall. */
export const MIN_ACTIVITY_MINS = 8;
const TUTORIAL_LECTURE_SHARE = 0.5;

export interface Ltp {
  l: number;
  t: number;
  p: number;
}

export function stratumFor({ t, p }: Ltp): Stratum {
  if (t >= 1) return "HEAVY_THEORY";
  if (p >= 2) return "STUDIO_ELECTIVE";
  return "APPLIED_CORE";
}

export function persona(prompt: string): { activityMins: number; label: string } {
  const text = prompt.toLowerCase();
  if (/socratic|case[- ]stud|discussion|debate|activity/.test(text)) {
    return { activityMins: 22, label: "Discussion-led: more activity time" };
  }
  if (/math|derivation|proof|theorem|theory/.test(text)) {
    return { activityMins: 12, label: "Derivation-led: more lecture time" };
  }
  return { activityMins: 18, label: "Balanced split" };
}

const weeklyPattern = ({ l, t, p }: Ltp): LtpType[] => [
  ...Array<LtpType>(l).fill("L"),
  ...Array<LtpType>(t).fill("T"),
  ...Array<LtpType>(p).fill("P"),
];

export interface RecalibrationInput {
  sessions: SessionPlan[];
  behindSession: number;
  shortfallMins: number;
  /** Null keeps each session's current type, for example an existing lab. */
  ltp: Ltp | null;
  prompt: string;
}

export interface RecalibrationResult {
  sessions: SessionPlan[];
  absorbedMins: number;
  overflowMins: number;
}

/**
 * Applies the persona split (and the L:T:P pattern, if given), then spreads the
 * shortfall one minute at a time over later non-practical sessions, trading
 * activity minutes for lecture minutes until the activity floor is reached.
 */
export function recalibrate(input: RecalibrationInput): RecalibrationResult {
  const { sessions, behindSession, shortfallMins, ltp, prompt } = input;
  const pattern = ltp ? weeklyPattern(ltp) : null;
  const { activityMins } = persona(prompt);

  const planned = sessions.map((session) => {
    const index = session.session_number - behindSession;
    const type = pattern ? pattern[((index % pattern.length) + pattern.length) % pattern.length] : session.ltp_type;
    const duration = session.session_duration_mins;
    let activity = Math.min(activityMins, duration);
    if (type === "P") activity = duration;
    if (type === "T") activity = Math.round(duration * TUTORIAL_LECTURE_SHARE);
    return {
      ...session,
      ltp_type: type,
      lecture_minutes_split: duration - activity,
      activity_minutes_split: activity,
      pacing_delta_mins: 0,
      status: "SCHEDULED" as SessionPlan["status"],
    };
  });

  const absorbers = planned.filter((session) => session.session_number > behindSession && session.ltp_type !== "P");
  let remaining = shortfallMins;
  let progressed = true;
  while (remaining > 0 && progressed) {
    progressed = false;
    for (const session of absorbers) {
      if (remaining === 0) break;
      if (session.activity_minutes_split > MIN_ACTIVITY_MINS) {
        session.activity_minutes_split -= 1;
        session.lecture_minutes_split += 1;
        session.pacing_delta_mins += 1;
        session.status = "RECALIBRATED";
        remaining -= 1;
        progressed = true;
      }
    }
  }

  for (const session of planned) {
    if (session.session_number === behindSession) {
      session.pacing_delta_mins = -shortfallMins;
      session.status = "COMPLETED";
    }
  }

  return { sessions: planned, absorbedMins: shortfallMins - remaining, overflowMins: remaining };
}
