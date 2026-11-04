import type { ActivityResponse, QuestionSet } from "@/types";

const LEARNING_GOAL = "Compute the f-number of a lens from its focal length and aperture diameter (N = f / D).";

/** Same skill, different numbers, so neighbours cannot copy an answer. */
const LENSES: [focal: number, diameter: number][] = [
  [50, 25],
  [50, 12.5],
  [35, 10],
  [85, 34],
  [28, 10],
  [56, 10],
  [80, 10],
  [110, 10],
  [45, 25],
  [70, 10],
];

export function buildQuestionSets(): QuestionSet[] {
  return LENSES.map(([focal, diameter], index) => {
    const answer = focal / diameter;
    const options = [answer, answer + 1, answer * 2, answer * 3].map((value) => `f/${Number(value.toFixed(1))}`);
    const shift = index % options.length;
    return {
      set_number: index + 1,
      questions: [
        {
          question: `A lens has a focal length of ${focal} mm and an aperture diameter of ${diameter} mm. What is its f-number?`,
          options: [...options.slice(shift), ...options.slice(0, shift)],
          answer: options[0],
          explanation: "N = f / D.",
        },
      ],
    };
  });
}

export function buildActivity(platform: string): ActivityResponse {
  return {
    learning_goal: LEARNING_GOAL,
    delivery_platform: platform,
    question_sets: buildQuestionSets(),
    platform_sync: {
      status: platform === "IN_APP_10_SETS" ? "LIVE" : "QUEUED_MOCK",
      assignment: "student i receives set ((seat_index) mod 10) + 1",
      trigger_minute: 20,
    },
  };
}
