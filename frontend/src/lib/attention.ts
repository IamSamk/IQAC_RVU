import type { ActivitySplitRange, AttentionModel, StrataCurve } from "@/types";

/**
 * Offline copy of the attention decay model. When the backend is reachable its
 * curves are used instead, and only this file's labels and cohort types apply.
 *
 *   A(t) = floor + (peak - floor) * exp(-lambda0 * alpha * beta * gamma * delta * max(0, t - tPeak)^1.4)
 *
 * alpha, beta, gamma (morning and post-lunch), tPeak, theta and the exponent come
 * from the project plan. The plan leaves lambda0, delta, A_base and the midday
 * gamma open, so the values below are calibrated to hit its chart targets
 * (88% peak, 55% crossing near minute 19, 16% by minute 60). The floor is what
 * keeps the curve at 16% at minute 60: a pure exponential reaches about 0%.
 * These are modelled curves, not measurements.
 */
export const THETA = 55;
export const T_PEAK = 11;
const EXPONENT = 1.4;
const FLOOR = 16;
const LAMBDA_0 = 0.0324;
/** How much slower attention decays after an activity reset (calibrated). */
const POST_ACTIVITY_DECAY = 0.45;
const RESET_LEVEL = 84;
const RESET_HOLD_MINS = 2;
const DURATION = 60;

export type Stratum = "HEAVY_THEORY" | "APPLIED_CORE" | "STUDIO_ELECTIVE";
export type Cohort = "UG1" | "UG2_3" | "UG4_PG";
export type Slot = "MORNING_09AM" | "MIDDAY_11AM" | "POST_LUNCH_02PM";

export interface CohortParams {
  stratum: Stratum;
  cohort: Cohort;
  slot: Slot;
  speech?: number;
}

export const STRATUM_LABEL: Record<Stratum, string> = {
  HEAVY_THEORY: "Heavy Theory (3:1:0)",
  APPLIED_CORE: "Applied Core (3:0:1)",
  STUDIO_ELECTIVE: "Studio Elective (2:0:2)",
};
export const COHORT_LABEL: Record<Cohort, string> = {
  UG1: "1st-year UG",
  UG2_3: "2nd/3rd-year UG",
  UG4_PG: "4th-year / PG",
};
/** The backend derives the cohort multiplier from the semester. */
export const COHORT_SEMESTER: Record<Cohort, number> = { UG1: 1, UG2_3: 5, UG4_PG: 8 };
export const SLOT_LABEL: Record<Slot, string> = {
  MORNING_09AM: "Morning, 9 AM",
  MIDDAY_11AM: "Midday, 11 AM",
  POST_LUNCH_02PM: "Post-lunch, 2 PM",
};

const ALPHA: Record<Stratum, number> = { HEAVY_THEORY: 1.3, APPLIED_CORE: 1, STUDIO_ELECTIVE: 0.75 };
const BETA: Record<Cohort, number> = { UG1: 1.25, UG2_3: 1, UG4_PG: 0.82 };
const GAMMA: Record<Slot, number> = { MORNING_09AM: 0.9, MIDDAY_11AM: 1, POST_LUNCH_02PM: 1.35 };
const PEAK: Record<Stratum, number> = { HEAVY_THEORY: 72, APPLIED_CORE: 88, STUDIO_ELECTIVE: 92 };

export interface StrataPreset {
  key: Stratum;
  label: string;
  params: CohortParams;
  band: [number, number];
}

export const STRATA_PRESETS: StrataPreset[] = [
  {
    key: "HEAVY_THEORY",
    label: "Heavy Theory, post-lunch 1st-year",
    params: { stratum: "HEAVY_THEORY", cohort: "UG1", slot: "POST_LUNCH_02PM" },
    band: [11.5, 14.8],
  },
  {
    key: "APPLIED_CORE",
    label: "Applied Core, morning 2nd/3rd-year",
    params: { stratum: "APPLIED_CORE", cohort: "UG2_3", slot: "MORNING_09AM" },
    band: [19.5, 20.2],
  },
  {
    key: "STUDIO_ELECTIVE",
    label: "Studio Elective, morning PG",
    params: { stratum: "STUDIO_ELECTIVE", cohort: "UG4_PG", slot: "MORNING_09AM" },
    band: [23.5, 29.7],
  },
];

const rate = (p: CohortParams) =>
  LAMBDA_0 * ALPHA[p.stratum] * BETA[p.cohort] * GAMMA[p.slot] * (p.speech ?? 1);

const round = (value: number) => Math.round(value * 10) / 10;

export function passiveAt(t: number, p: CohortParams): number {
  const peak = PEAK[p.stratum];
  if (t <= T_PEAK) {
    const start = peak - 22;
    return start + (peak - start) * Math.sin(((t / T_PEAK) * Math.PI) / 2);
  }
  return FLOOR + (peak - FLOOR) * Math.exp(-rate(p) * Math.pow(t - T_PEAK, EXPONENT));
}

/** Minute the passive curve first drops below theta, after the concentration peak. */
export function dipMinute(p: CohortParams): number {
  for (let t = T_PEAK; t <= DURATION; t += 0.05) {
    if (passiveAt(t, p) < THETA) return round(t);
  }
  return DURATION;
}

export const DEFAULT_SPLITS: ActivitySplitRange[] = [
  { start: 20, end: 27 },
  { start: 43, end: 50 },
];

export function activeAt(t: number, p: CohortParams, splits: ActivitySplitRange[]): number {
  let decayFrom: ActivitySplitRange | null = null;
  const valueBefore = (minute: number) =>
    decayFrom === null
      ? passiveAt(minute, p)
      : FLOOR +
        (RESET_LEVEL - FLOOR) *
          Math.exp(
            -rate(p) * POST_ACTIVITY_DECAY * Math.pow(Math.max(0, minute - decayFrom.end - RESET_HOLD_MINS), EXPONENT),
          );

  for (const split of splits) {
    if (t < split.start) break;
    if (t <= split.end) {
      const from = valueBefore(split.start);
      const progress = (t - split.start) / (split.end - split.start);
      return from + (RESET_LEVEL - from) * Math.sin((progress * Math.PI) / 2);
    }
    decayFrom = split;
  }
  return valueBefore(t);
}

const minutes = Array.from({ length: DURATION + 1 }, (_, t) => t);

export const curveFor = (p: CohortParams) => minutes.map((t) => round(passiveAt(t, p)));
const activeCurveFor = (p: CohortParams, splits: ActivitySplitRange[]) => minutes.map((t) => round(activeAt(t, p, splits)));

const LIVE_CLASS_PARAMS: CohortParams = STRATA_PRESETS[1].params;
const SEEDED_POLL = { votes: 5, avg_preferred_split_min: 22 };

/** Pass a poll minute to move the first activity to where students asked for it. */
export function fallbackAttentionModel(pollMinute?: number): AttentionModel {
  const strata_curves: StrataCurve[] = STRATA_PRESETS.map((preset) => ({
    key: preset.key,
    stratum: preset.key,
    label: preset.label,
    curve: curveFor(preset.params),
    dip_minute: dipMinute(preset.params),
  }));
  const splits = pollMinute === undefined ? DEFAULT_SPLITS : [{ start: pollMinute, end: pollMinute + 7 }, DEFAULT_SPLITS[1]];
  return {
    t: minutes,
    passive_curve: curveFor(LIVE_CLASS_PARAMS),
    active_intervened_curve: activeCurveFor(LIVE_CLASS_PARAMS, splits),
    strata_curves,
    dip_trigger_minute: pollMinute ?? dipMinute(LIVE_CLASS_PARAMS),
    activity_splits: splits,
    threshold: THETA,
    student_poll: SEEDED_POLL,
    citations: [
      "Stuart & Rutherford (1978) Medical student concentration during lectures, The Lancet",
      "Bunce, Flens & Neiles (2010) How long can students pay attention in class?, J. Chem. Educ.",
      "IUCEE faculty-development guidance on active-learning breaks",
    ],
  };
}
