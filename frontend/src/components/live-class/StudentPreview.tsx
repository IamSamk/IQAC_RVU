"use client";

import clsx from "clsx";
import { Check, Send, Smartphone, X } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import type { ActivityQuestion, ActivityResponse } from "@/types";

const AARAV_SEAT_SET = 4;
const SPLIT_CHOICES = [15, 20, 25];
const VOTE_MINUTE = 20;

function QuestionBlock({ question }: { question: ActivityQuestion }) {
  const [answer, setAnswer] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  if (question.options.length === 0) {
    return (
      <div>
        <p className="break-words text-sm">{question.question}</p>
        {revealed ? (
          <p className="mt-2 rounded border border-emerald-400 bg-success-100 px-2 py-1 text-sm font-medium text-success-700">{question.answer}</p>
        ) : (
          <button type="button" className="btn-outline mt-2 w-full" onClick={() => setRevealed(true)}>
            Show answer
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="break-words text-sm">{question.question}</p>
      <div className="mt-2 grid grid-cols-1 gap-1.5">
        {question.options.map((option, index) => {
          const picked = answer === index;
          const correct = option === question.answer;
          return (
            <button
              key={index}
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
    </div>
  );
}

export function StudentPreview({
  sessionId,
  sessionNumber,
  courseCode,
  activity,
  pollAverage,
  disabled,
  onVoted,
}: {
  sessionId: string;
  sessionNumber: number;
  courseCode: string;
  activity: ActivityResponse | null;
  pollAverage: number | null;
  disabled: boolean;
  onVoted: (minute: number) => void;
}) {
  const [focus, setFocus] = useState<number | null>(null);
  const [split, setSplit] = useState<number | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const set = activity?.question_sets.find((item) => item.set_number === AARAV_SEAT_SET) ?? activity?.question_sets[0];

  const sendVote = async () => {
    if (focus === null || split === null) return;
    setSending(true);
    const response = await api.sendVote(sessionId, { minute_of_class: VOTE_MINUTE, reported_focus_score: focus, preferred_split_min: split });
    onVoted(split);
    setSent(response.source === "live" ? "Sent to the class poll." : `Counted on this preview only, because ${response.note}.`);
    setSending(false);
  };

  return (
    <aside aria-label="Student phone preview" className="mx-auto w-full max-w-sm rounded-[1.75rem] border-[6px] border-slate-900 bg-white">
      <div className="flex items-center gap-1.5 rounded-t-[1.25rem] bg-brand-950 px-4 py-2.5 text-xs text-white">
        <Smartphone className="h-3.5 w-3.5" aria-hidden />
        Aarav&apos;s phone · {courseCode} Session {sessionNumber}
      </div>
      <div className="space-y-4 p-4">
        <fieldset disabled={sent !== null}>
          <legend className="text-sm font-medium">How focused are you right now?</legend>
          <p className="text-xs text-slate-600">1 is lost, 9 is fully focused.</p>
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
        </fieldset>

        <fieldset disabled={sent !== null}>
          <legend className="text-sm font-medium">When should the activity start?</legend>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {SPLIT_CHOICES.map((minute) => (
              <button
                key={minute}
                type="button"
                aria-pressed={split === minute}
                onClick={() => setSplit(minute)}
                className={clsx("btn border", split === minute ? "border-brand-600 bg-brand-50 text-brand-700 disabled:opacity-100" : "border-slate-300 hover:bg-slate-100")}
              >
                Min {minute}
              </button>
            ))}
          </div>
          {pollAverage !== null && <p className="mt-1 text-xs text-slate-600">Class poll average: minute {pollAverage}</p>}
        </fieldset>

        {sent ? (
          <p role="status" className="text-xs font-medium text-success-700">
            {sent}
          </p>
        ) : (
          <button type="button" className="btn-primary w-full" disabled={focus === null || split === null || sending || disabled} onClick={sendVote}>
            <Send className="h-4 w-4" aria-hidden />
            {sending ? "Sending" : "Send to class poll"}
          </button>
        )}

        <div className="rounded-lg bg-slate-50 p-3">
          {set ? (
            <>
              <div className="text-xs font-semibold text-brand-700">Your activity: Set {set.set_number}</div>
              <div className="mt-1 space-y-3">
                {set.questions.map((question, index) => (
                  <QuestionBlock key={`${set.set_number}-${index}`} question={question} />
                ))}
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
