"use client";

import clsx from "clsx";
import { Check, Play, Rocket } from "lucide-react";
import { useState } from "react";
import { Card, CardHeader, Notice } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import type { ActivityResponse, QuestionSet } from "@/types";

const PLATFORMS = [
  { id: "IN_APP_10_SETS", label: "In-App 10-Set", detail: "Anti-cheating mode" },
  { id: "MENTIMETER", label: "Mentimeter", detail: "Mock payload" },
  { id: "KAHOOT", label: "Kahoot", detail: "Mock payload" },
  { id: "GOOGLE_CLASSROOM", label: "Google Classroom", detail: "Mock payload" },
];

function SetCard({ set, slot }: { set: QuestionSet; slot: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 p-3">
      <div className="text-xs font-semibold text-brand-700">
        {slot}: Set {set.set_number}
      </div>
      <ol className="mt-1 space-y-3">
        {set.questions.map((question, questionIndex) => (
          <li key={questionIndex}>
            <p className="break-words text-sm">{question.question}</p>
            {question.options.length > 0 ? (
              <ul className="mt-2 grid grid-cols-2 gap-1.5 text-sm">
                {question.options.map((option, index) => {
                  const correct = option === question.answer;
                  return (
                    <li key={index} className={clsx("flex items-center gap-1.5 rounded border px-2 py-1", correct ? "border-emerald-300 bg-success-100 font-medium text-success-700" : "border-slate-200")}>
                      {correct && <Check className="h-3.5 w-3.5 shrink-0" aria-label="Correct answer" />}
                      {option}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 flex items-center gap-1.5 rounded border border-emerald-300 bg-success-100 px-2 py-1 text-sm font-medium text-success-700">
                <Check className="h-3.5 w-3.5 shrink-0" aria-label="Correct answer" />
                {question.answer}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ActivityLauncher({
  sessionId,
  activity,
  disabled,
  onLaunched,
}: {
  sessionId: string;
  activity: ActivityResponse | null;
  disabled: boolean;
  onLaunched: (activity: ActivityResponse) => void;
}) {
  const [platform, setPlatform] = useState(PLATFORMS[0].id);
  const [launching, setLaunching] = useState(false);
  const [note, setNote] = useState<string | undefined>();
  const [pair, setPair] = useState<[number, number]>([1, 2]);

  const launch = async () => {
    setLaunching(true);
    const response = await api.triggerActivity(sessionId, platform);
    setNote(response.source === "demo" ? response.note : undefined);
    onLaunched(response.data);
    const numbers = response.data.question_sets.map((set) => set.set_number);
    setPair([numbers[0], numbers[1] ?? numbers[0]]);
    setLaunching(false);
  };

  const sets = activity?.question_sets ?? [];
  const findSet = (number: number) => sets.find((set) => set.set_number === number) ?? sets[0];
  const launchedPlatform = PLATFORMS.find((item) => item.id === activity?.delivery_platform);
  const isInApp = activity?.delivery_platform === "IN_APP_10_SETS";

  return (
    <Card>
      <CardHeader title="Polymorphic 10-set activity" description="Each student gets a different question set that tests the same learning goal, so copying a neighbour's answer does not help." />
      <div role="radiogroup" aria-label="Delivery platform" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {PLATFORMS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={platform === item.id}
            onClick={() => setPlatform(item.id)}
            className={clsx("min-h-[56px] rounded-lg border p-2.5 text-left transition-colors duration-150", platform === item.id ? "border-brand-600 bg-brand-50" : "border-slate-300 hover:bg-slate-100")}
          >
            <span className="block text-sm font-medium">{item.label}</span>
            <span className="block text-xs text-slate-600">{item.detail}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn-gold mt-3" disabled={launching || disabled} onClick={launch}>
        {activity ? <Rocket className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
        {launching ? "Launching" : activity ? "Launch again" : "Launch activity"}
      </button>

      {activity && (
        <div className="mt-4 space-y-3">
          <Notice tone="success">
            {isInApp
              ? `${sets.length} question sets are ready in the app.`
              : `${launchedPlatform?.label ?? activity.delivery_platform} payload prepared. This is a mock integration, so nothing was sent to that service.`}
            {note && ` Generated in this browser because ${note}.`}
            <span className="mt-0.5 block text-xs">Learning goal: {activity.learning_goal}</span>
            {activity.generator && <span className="block text-xs">Questions generated by {activity.generator === "TEMPLATE_GENERATOR" ? "the syllabus template engine" : activity.generator}</span>}
          </Notice>

          <div className="flex flex-wrap items-end gap-3">
            {(["A", "B"] as const).map((slot, index) => (
              <label key={slot} className="text-xs font-medium text-slate-700">
                Student {slot}
                <select
                  className="field mt-1 w-28 py-1.5"
                  value={pair[index]}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setPair((current) => (index === 0 ? [value, current[1]] : [current[0], value]));
                  }}
                >
                  {sets.map((set) => (
                    <option key={set.set_number} value={set.set_number}>
                      Set {set.set_number}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <SetCard slot="Student A" set={findSet(pair[0])} />
            <SetCard slot="Student B" set={findSet(pair[1])} />
          </div>

          <details className="text-sm">
            <summary className="font-medium text-brand-700">View integration payload</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">{JSON.stringify(activity.platform_sync, null, 2)}</pre>
          </details>
        </div>
      )}
    </Card>
  );
}
