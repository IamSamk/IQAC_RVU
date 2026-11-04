"use client";

import clsx from "clsx";
import { AlertCircle, Check, RotateCw, X } from "lucide-react";
import { useState } from "react";
import { Badge, Dialog } from "@/components/ui/primitives";
import type { Flashcard, KGEdge, KGNode, QuizQuestion } from "@/types";

function FlipCard({ card }: { card: Flashcard }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      data-flipped={flipped}
      aria-label={flipped ? `Answer: ${card.back}. Show question.` : `Question: ${card.front}. Show answer.`}
      onClick={() => setFlipped((value) => !value)}
      className="flip-card block h-32 w-full rounded-lg text-left"
    >
      <span className="flip-card-inner relative block h-full w-full">
        <span className="flip-face absolute inset-0 flex flex-col justify-between rounded-lg border border-slate-300 bg-white p-3">
          <span className="text-sm font-medium">{card.front}</span>
          <span className="flex items-center gap-1 text-xs text-slate-600">
            <RotateCw className="h-3 w-3" aria-hidden />
            Flip
          </span>
        </span>
        <span className="flip-face flip-back absolute inset-0 flex flex-col justify-between rounded-lg border border-brand-600 bg-brand-50 p-3">
          <span className="text-sm text-slate-900">{card.back}</span>
          <span className="flex items-center gap-1 text-xs text-slate-600">
            <RotateCw className="h-3 w-3" aria-hidden />
            Flip back
          </span>
        </span>
      </span>
    </button>
  );
}

function QuizItem({ item, index, picked, onPick }: { item: QuizQuestion; index: number; picked: number | undefined; onPick: (option: number) => void }) {
  const answered = picked !== undefined;
  return (
    <fieldset>
      <legend className="text-sm font-medium">
        {index + 1}. {item.question}
      </legend>
      <div className="mt-2 grid gap-1.5">
        {item.options.map((option, optionIndex) => {
          const correct = optionIndex === item.answer_index;
          const chosen = picked === optionIndex;
          return (
            <button
              key={option}
              type="button"
              disabled={answered}
              onClick={() => onPick(optionIndex)}
              className={clsx(
                "btn justify-start border text-left disabled:opacity-100",
                !answered && "border-slate-300 hover:bg-slate-100",
                answered && correct && "border-emerald-400 bg-success-100 text-success-700",
                answered && chosen && !correct && "border-red-300 bg-critical-100 text-critical-700",
                answered && !correct && !chosen && "border-slate-200 text-slate-500",
              )}
            >
              {answered && correct && <Check className="h-4 w-4 shrink-0" aria-label="Correct" />}
              {answered && chosen && !correct && <X className="h-4 w-4 shrink-0" aria-label="Incorrect" />}
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Quiz({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const answered = Object.keys(answers).length;
  const score = questions.filter((question, index) => answers[index] === question.answer_index).length;
  return (
    <div className="space-y-4">
      {questions.map((question, index) => (
        <QuizItem key={question.question} item={question} index={index} picked={answers[index]} onPick={(option) => setAnswers((current) => ({ ...current, [index]: option }))} />
      ))}
      {answered === questions.length && (
        <p role="status" className="text-sm font-medium">
          You scored {score} of {questions.length}.
        </p>
      )}
    </div>
  );
}

const SECTION = "mt-5 text-sm font-semibold text-slate-900";

export function NodeDrawer({ node, edges, onClose }: { node: KGNode | null; edges: KGEdge[]; onClose: () => void }) {
  const bridgeEdge = node?.kind === "bridge" ? edges.find((edge) => edge.source === node.id || edge.target === node.id) : undefined;
  return (
    <Dialog open={node !== null} onClose={onClose} variant="side" title={node?.title ?? "Topic"}>
      {node && (
        <div key={node.id}>
          <div className="flex flex-wrap gap-2">
            {node.kind === "chunk" ? (
              <Badge tone="brand">
                {node.course_code} · Unit {node.unit}, Chunk {node.chunk}
              </Badge>
            ) : (
              <Badge tone="warning">Similarity {bridgeEdge?.similarity_score?.toFixed(2) ?? "n/a"}</Badge>
            )}
            {node.weak && (
              <Badge tone="critical">
                <AlertCircle className="h-3 w-3" aria-hidden />
                {node.weak_reason ?? "Needs revision"}
              </Badge>
            )}
          </div>
          {bridgeEdge?.shared_concepts && <p className="mt-2 text-xs text-slate-600">Shared concepts: {bridgeEdge.shared_concepts.join(", ")}</p>}

          <h3 className={SECTION}>Auto-compiled class notes</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{node.notes_md}</p>

          <h3 className={SECTION}>Applied cross-course example</h3>
          <p className="mt-1 rounded-lg bg-gold-50 p-3 text-sm leading-relaxed text-slate-800">{node.applied_example}</p>

          <h3 className={SECTION}>Spaced-repetition flashcards</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {node.flashcards.map((card) => (
              <FlipCard key={card.front} card={card} />
            ))}
          </div>

          <h3 className={SECTION}>3-question quick quiz</h3>
          <div className="mt-2">
            <Quiz questions={node.quiz} />
          </div>
        </div>
      )}
    </Dialog>
  );
}
