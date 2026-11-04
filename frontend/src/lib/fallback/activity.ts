import type { ActivityResponse, QuestionSet } from "@/types";

export const LEARNING_GOAL = "Compute the f-number of a lens from its focal length and aperture diameter (N = f / D).";

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
      question: `A lens has a focal length of ${focal} mm and an aperture diameter of ${diameter} mm. What is its f-number?`,
      options: [...options.slice(shift), ...options.slice(0, shift)],
      answer_index: (options.length - shift) % options.length,
    };
  });
}

export function buildActivity(platform: string): ActivityResponse {
  return {
    learning_goal: LEARNING_GOAL,
    delivery_platform: platform,
    question_sets_json: buildQuestionSets(),
    webhook_payload: {
      platform,
      session_number: 12,
      chunk: "CS304 Unit 2 Chunk 3",
      trigger_minute: 20,
      duration_mins: 7,
      question_sets: 10,
      assignment: "seat_number mod 10",
    },
  };
}
