"use client";

import clsx from "clsx";
import { CheckCircle2, Mic, MicOff, Presentation, WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge, Card, CardHeader, Dialog, Notice } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { fallbackPacing } from "@/lib/fallback/pacing";
import { recalibrate } from "@/lib/pacing";

const TRANSCRIPT = [
  { slide: 1, conf: 0.94, text: "Last session ended on the circle of confusion. Today we use that blur to estimate depth." },
  { slide: 2, conf: 0.92, text: "Start with the thin-lens equation: one over f equals one over u plus one over v." },
  { slide: 3, conf: 0.9, text: "Fix the sensor plane and only one scene depth is in perfect focus." },
  { slide: 4, conf: 0.93, text: "Every other depth spreads into a disc on the sensor. That disc is our measurement." },
  { slide: 5, conf: 0.88, text: "So how large is the disc? It depends on aperture diameter and on how far out of focus the point is." },
  { slide: 6, conf: 0.91, text: "Open the aperture and blur grows. Stop it down and the depth cue gets weaker." },
  { slide: 7, conf: 0.89, text: "This is exactly the f-number relation from Unit 1: N equals f over D." },
  { slide: 8, conf: 0.93, text: "Now take two images of the same scene with different focus settings." },
  { slide: 9, conf: 0.9, text: "Compare local sharpness patch by patch to see which image each point favours." },
  { slide: 10, conf: 0.87, text: "That ratio of blur gives a depth estimate without any second camera." },
  { slide: 11, conf: 0.92, text: "It fails on textureless regions because there is no sharpness to compare." },
  { slide: 12, conf: 0.91, text: "Before we move on, try the short activity on your screens." },
];

const TOTAL_SLIDES = 15;
const LECTURE_MINS = 42;
const TOPICS = [
  { label: "Thin-lens equation", slide: 3 },
  { label: "Blur disc and aperture", slide: 7 },
  { label: "Comparing two focus settings", slide: 10 },
  { label: "Limits and practice problems", slide: 15 },
];

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-12 items-center gap-1 overflow-hidden rounded-lg bg-brand-950 px-3" aria-hidden>
      {Array.from({ length: 48 }, (_, index) => (
        <span
          key={index}
          className={clsx("h-8 w-1 shrink-0 origin-center rounded-full", active ? "animate-wave bg-gold-500" : "scale-y-[.08] bg-slate-500")}
          style={active ? { animationDelay: `${(index * 73) % 900}ms`, animationDuration: `${900 + ((index * 131) % 500)}ms` } : undefined}
        />
      ))}
    </div>
  );
}

interface Checkpoint {
  slide: number;
  behindMins: number;
  absorbed: number;
  overflow: number;
  saved: "live" | "demo";
}

export function TranscriptPanel({ canControl }: { canControl: boolean }) {
  const [visible, setVisible] = useState(3);
  const [dropped, setDropped] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const logRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (dropped) return;
    const timer = window.setInterval(() => {
      setVisible((count) => Math.min(count + 1, TRANSCRIPT.length));
    }, 3500);
    return () => window.clearInterval(timer);
  }, [dropped]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [visible]);

  const lines = TRANSCRIPT.slice(0, visible);
  const currentSlide = lines[lines.length - 1].slide;

  const drop = () => {
    setDropped(true);
    setCheckpoint(null);
    setModalOpen(true);
  };

  const restore = () => {
    setDropped(false);
    setModalOpen(false);
  };

  const submit = async (slide: number, topic?: string) => {
    setSaving(true);
    const response = await api.fallbackCheckpoint({ slide, topic });
    const behindMins = Math.round(((TOTAL_SLIDES - slide) / TOTAL_SLIDES) * LECTURE_MINS);
    const plan = recalibrate({
      sessions: fallbackPacing.sessions,
      behindSession: 12,
      shortfallMins: behindMins,
      ltp: { l: 3, t: 0, p: 1 },
      prompt: fallbackPacing.pedagogical_system_prompt,
    });
    setCheckpoint({ slide, behindMins, absorbed: plan.absorbedMins, overflow: plan.overflowMins, saved: response.source });
    setSaving(false);
    setModalOpen(false);
  };

  return (
    <Card>
      <CardHeader
        title="Session 12 live transcript"
        description="Depth from defocus and the thin-lens model. Simulated classroom feed."
        action={
          dropped ? (
            <Badge tone="critical">
              <MicOff className="h-3 w-3" aria-hidden />
              Transcription offline
            </Badge>
          ) : (
            <Badge tone="success">
              <Mic className="h-3 w-3" aria-hidden />
              Listening · Slide {currentSlide}/{TOTAL_SLIDES}
            </Badge>
          )
        }
      />
      <Waveform active={!dropped} />

      <ol ref={logRef} aria-label="Lecture transcript" className="mt-3 h-44 space-y-2 overflow-y-auto pr-1 text-sm">
        {lines.map((line) => (
          <li key={line.slide} className="grid grid-cols-[3.25rem_1fr] gap-2">
            <span className="inline-flex h-fit items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
              <Presentation className="h-3 w-3" aria-hidden />
              {line.slide}
            </span>
            <span className="text-slate-800">{line.text}</span>
          </li>
        ))}
      </ol>

      {checkpoint && (
        <div className="mt-3">
          <Notice tone={checkpoint.overflow > 0 ? "warning" : "success"} icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}>
            Checkpoint saved at slide {checkpoint.slide}
            {checkpoint.saved === "demo" ? " in this browser (backend offline)" : ""}. {TOTAL_SLIDES - checkpoint.slide} slides remain, about{" "}
            {checkpoint.behindMins} min behind.{" "}
            {checkpoint.overflow > 0
              ? `${checkpoint.absorbed} min fit in later sessions; ${checkpoint.overflow} min need a buffer session.`
              : `Sessions 13–18 can absorb all ${checkpoint.absorbed} min.`}{" "}
            <Link href="/pacing" className="font-medium underline">
              Open pacing
            </Link>
          </Notice>
        </div>
      )}

      {canControl && (
        <div className="mt-3 flex flex-wrap gap-2">
          {dropped ? (
            <>
              <button type="button" className="btn-outline" onClick={() => setModalOpen(true)}>
                Update slide checkpoint
              </button>
              <button type="button" className="btn-primary" onClick={restore}>
                <Mic className="h-4 w-4" aria-hidden />
                Restore audio feed
              </button>
            </>
          ) : (
            <button type="button" className="btn-danger" onClick={drop}>
              <WifiOff className="h-4 w-4" aria-hidden />
              Simulate Mic/Wi-Fi Drop (Trigger Fallback)
            </button>
          )}
        </div>
      )}

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} title="Where did you reach?">
        <p className="text-sm text-slate-600">
          Transcription dropped at slide {currentSlide}. Tap the slide or topic you reached so pacing can recalibrate without losing data.
        </p>
        <h3 className="mt-4 text-sm font-medium">Slide</h3>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {Array.from({ length: TOTAL_SLIDES }, (_, index) => index + 1).map((slide) => (
            <button
              key={slide}
              type="button"
              disabled={saving}
              onClick={() => submit(slide)}
              className={clsx("btn min-h-[44px] border", slide === currentSlide ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 hover:bg-slate-100")}
            >
              {slide}
            </button>
          ))}
        </div>
        <h3 className="mt-4 text-sm font-medium">Or topic</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {TOPICS.map((topic) => (
            <button key={topic.label} type="button" disabled={saving} onClick={() => submit(topic.slide, topic.label)} className="btn-outline justify-start text-left">
              {topic.label}
              <span className="ml-auto text-xs text-slate-500">to slide {topic.slide}</span>
            </button>
          ))}
        </div>
      </Dialog>
    </Card>
  );
}
