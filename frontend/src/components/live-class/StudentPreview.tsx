"use client";

import clsx from "clsx";
import { Check, Smartphone, X } from "lucide-react";
import { useState } from "react";
import type { ActivityResponse } from "@/types";

const AARAV_SEAT_SET = 4;
const SPLIT_CHOICES = [15, 20, 25];

export function StudentPreview({
  activity,
  pollMinute,
  onVoteSplit,
}: {
  activity: ActivityResponse | null;
  pollMinute: number;
  onVoteSplit: (minute: number) => void;
}) {
  const [focus, setFocus] = useState<number | null>(null);
  const [split, setSplit] = useState<number | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);

  const set =
    activity?.question_sets_json.find((item) => item.set_number === AARAV_SEAT_SET) ?? activity?.question_sets_json[0];

  return (
    <aside aria-label="Student phone preview" className="mx-auto w-full max-w-sm rounded-[1.75rem] border-[6px] border-slate-900 bg-white">
      <div className="flex items-center gap-1.5 rounded-t-[1.25rem] bg-brand-950 px-4 py-2.5 text-xs text-white">
        <Smartphone className="h-3.5 w-3.5" aria-hidden />
        Aarav&apos;s phone · CS304 Session 12
      </div>
      <div className="space-y-4 p-4">
        <fieldset>
          <legend className="text-sm font-medium">How focused are you right now?</legend>
          <p className="text-xs text-slate-600">1 is lost, 9 is fully focused. Anonymous.</p>
          <div className="mt-2 grid grid-cols-9 gap-0.5">
            {Array.from({ length: 9 }, (_, index) => index + 1).map((score) => (
              <button
                key={score}
                type="button"
                aria-pressed={focus === score}
                aria-label={`Focus score ${score}`}
                onClick={() => setFocus(score)}
                className={clsx(
                  "min-h-[40px] rounded border text-sm transition-colors duration-150",
                  focus === score ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 hover:bg-slate-100",
                )}
              >
                {score}
              </button>
            ))}
          </div>
          {focus !== null && <p className="mt-1 text-xs text-success-700">Thanks. Your score was recorded on this preview.</p>}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">When should the activity start?</legend>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {SPLIT_CHOICES.map((minute) => (
              <button
                key={minute}
                type="button"
                aria-pressed={split === minute}
                disabled={split !== null}
                onClick={() => {
                  setSplit(minute);
                  onVoteSplit(minute);
                }}
                className={clsx(
                  "btn border",
                  split === minute ? "border-brand-600 bg-brand-50 text-brand-700 disabled:opacity-100" : "border-slate-300 hover:bg-slate-100",
                )}
              >
                Min {minute}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-600">Class poll average: minute {pollMinute}</p>
        </fieldset>

        <div className="rounded-lg bg-slate-50 p-3">
          {set ? (
            <>
              <div className="text-xs font-semibold text-brand-700">Your activity: Set {set.set_number}</div>
              <p className="mt-1 text-sm">{set.question}</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {set.options.map((option, index) => {
                  const picked = answer === index;
                  const correct = index === set.answer_index;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={answer !== null}
                      onClick={() => setAnswer(index)}
                      className={clsx(
                        "btn border bg-white disabled:opacity-100",
                        answer === null && "border-slate-300 hover:bg-slate-100",
                        answer !== null && correct && "border-emerald-400 bg-success-100 text-success-700",
                        picked && !correct && "border-red-300 bg-critical-100 text-critical-700",
                        answer !== null && !correct && !picked && "border-slate-200 text-slate-500",
                      )}
                    >
                      {answer !== null && correct && <Check className="h-4 w-4" aria-label="Correct" />}
                      {picked && !correct && <X className="h-4 w-4" aria-label="Incorrect" />}
                      {option}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">Your activity appears here when the teacher launches it.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
