"use client";

import clsx from "clsx";
import { CheckCircle2, Mic, MicOff, Presentation, Square, WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge, Card, CardHeader, Dialog, Notice } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { LiveSession, TranscriptLine } from "@/types";

const FEED_INTERVAL_MS = 3500;
const INITIAL_LINES = 3;
const MAX_RECORDING_MS = 60_000;

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-12 items-center justify-between gap-1 overflow-hidden rounded-lg bg-brand-950 px-3" aria-hidden>
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

function checkpointMessage(checkpoint: { label: string; behind: number; shifted: number[]; finishesOn: string | null; note?: string }) {
  const where = `Checkpoint saved: ${checkpoint.label}${checkpoint.note ? ` (in this browser, because ${checkpoint.note})` : ""}.`;
  const pace = checkpoint.behind > 0 ? `About ${checkpoint.behind} min behind.` : "No minutes lost.";
  const shifted = checkpoint.shifted.length ? `Sessions ${checkpoint.shifted.join(", ")} were re-balanced.` : "";
  const finish = checkpoint.finishesOn ? `The syllabus finishes on ${formatDate(checkpoint.finishesOn)}.` : "";
  return [where, pace, shifted, finish].filter(Boolean).join(" ");
}

export function TranscriptPanel({ session, canControl, disabled }: { session: LiveSession; canControl: boolean; disabled: boolean }) {
  const [visible, setVisible] = useState(INITIAL_LINES);
  const [dropped, setDropped] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dropReason, setDropReason] = useState<string | null>(null);
  const [micState, setMicState] = useState<"idle" | "recording" | "sending">("idle");
  const [micLines, setMicLines] = useState<TranscriptLine[]>([]);
  const [micError, setMicError] = useState<string | null>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopMicRef = useRef<(() => void) | null>(null);

  // Release the microphone if the view closes mid-recording, without sending the clip.
  useEffect(() => () => stopMicRef.current?.(), []);

  const slides =
    session.slide_start !== null && session.slide_end !== null
      ? Array.from({ length: session.slide_end - session.slide_start + 1 }, (_, index) => (session.slide_start as number) + index)
      : [];

  const usingMic = micLines.length > 0 || micState !== "idle";

  useEffect(() => {
    if (dropped || usingMic) return;
    const timer = window.setInterval(() => {
      setVisible((count) => Math.min(count + 1, session.transcript.length));
    }, FEED_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [dropped, usingMic, session.transcript.length]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [visible, micLines]);

  const lines = [...session.transcript.slice(0, visible), ...micLines];
  const simulatedPosition = session.transcript[Math.min(visible, session.transcript.length) - 1]?.label ?? "";
  const position = lines[lines.length - 1]?.label ?? "";

  const drop = (reason: string | null = null) => {
    setDropped(true);
    setDropReason(reason);
    setMessage(null);
    setModalOpen(true);
  };

  const restore = () => {
    setDropped(false);
    setDropReason(null);
    setModalOpen(false);
  };

  const sendClip = async (clip: File) => {
    setMicState("sending");
    const response = await api.transcribeAudio(session.session_id, clip);
    setMicState("idle");
    if (!response.data) {
      setMicError(`The clip was not transcribed because ${response.note}.`);
    } else if (response.data.fallback_required || !response.data.text) {
      drop(response.data.reason);
    } else {
      setMicLines((current) => [...current, { label: "Mic", text: response.data?.text ?? "" }]);
    }
  };

  const recordFromMic = async () => {
    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicError("This browser cannot record audio. Use the simulated feed or the slide checkpoint.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError("Microphone access was blocked. Allow it in the browser, or use the slide checkpoint.");
      return;
    }
    const recorder = new MediaRecorder(stream);
    const parts: Blob[] = [];
    const timer = window.setTimeout(() => recorder.stop(), MAX_RECORDING_MS);
    const release = () => {
      window.clearTimeout(timer);
      stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      stopMicRef.current = null;
    };
    recorder.ondataavailable = (event) => parts.push(event.data);
    recorder.onstop = () => {
      release();
      // Send the base type: some speech services reject a codecs parameter.
      void sendClip(new File(parts, "classroom-clip.webm", { type: "audio/webm" }));
    };
    recorderRef.current = recorder;
    stopMicRef.current = () => {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      release();
    };
    recorder.start();
    setMicState("recording");
  };

  const submit = async (slide: number | null, topic?: string) => {
    setSaving(true);
    const response = await api.fallbackCheckpoint(session.session_id, {
      slide_number: slide ?? undefined,
      chunk_id: session.chunk_id ?? undefined,
      topic,
    });
    const label = topic ?? (slide !== null ? `Slide ${slide}` : session.topic_title);
    if (response.data) {
      setMessage(
        checkpointMessage({
          label: response.data.checkpoint || label,
          behind: response.data.minutes_behind,
          shifted: response.data.shifted_sessions,
          finishesOn: response.data.syllabus_finishes_on,
        }),
      );
    } else {
      const remaining = slide !== null && session.slide_end !== null ? session.slide_end - slide : 0;
      const total = slides.length || 1;
      setMessage(
        checkpointMessage({
          label,
          behind: Math.round((remaining / total) * session.lecture_minutes),
          shifted: [],
          finishesOn: null,
          note: response.note ?? "the backend is offline",
        }),
      );
    }
    setSaving(false);
    setModalOpen(false);
  };

  return (
    <Card>
      <CardHeader
        title={`Session ${session.session_number} live transcript`}
        description={`${session.topic_title}. ${micLines.length > 0 ? "Transcribed from the microphone." : "Simulated classroom feed until you record from the microphone."}`}
        action={
          dropped ? (
            <Badge tone="critical">
              <MicOff className="h-3 w-3" aria-hidden />
              Transcription offline
            </Badge>
          ) : (
            <Badge tone="success">
              <Mic className="h-3 w-3" aria-hidden />
              Listening · {position}
            </Badge>
          )
        }
      />
      <Waveform active={!dropped} />

      <ol ref={logRef} aria-label="Lecture transcript" className="mt-3 h-44 space-y-2 overflow-y-auto pr-1 text-sm">
        {lines.map((line, index) => (
          <li key={index} className="grid grid-cols-[3.25rem_1fr] gap-2">
            <span className="inline-flex h-fit items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
              <Presentation className="h-3 w-3" aria-hidden />
              {line.label}
            </span>
            <span className="text-slate-800">{line.text}</span>
          </li>
        ))}
      </ol>

      {message && (
        <div className="mt-3">
          <Notice tone="success" icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}>
            {message}{" "}
            {canControl && (
              <Link href="/pacing" className="font-medium underline">
                Open pacing
              </Link>
            )}
          </Notice>
        </div>
      )}

      {micError && (
        <p role="alert" className="mt-3 text-sm text-critical-700">
          {micError}
        </p>
      )}

      {canControl && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!dropped &&
            (micState === "recording" ? (
              <button type="button" className="btn-primary" onClick={() => recorderRef.current?.stop()}>
                <Square className="h-4 w-4" aria-hidden />
                Stop and transcribe
              </button>
            ) : (
              <button type="button" className="btn-outline" disabled={micState === "sending" || disabled} onClick={recordFromMic}>
                <Mic className="h-4 w-4" aria-hidden />
                {micState === "sending" ? "Transcribing" : "Record from mic"}
              </button>
            ))}
          {dropped ? (
            <>
              <button type="button" className="btn-outline" onClick={() => setModalOpen(true)}>
                Update checkpoint
              </button>
              <button type="button" className="btn-primary" onClick={restore}>
                <Mic className="h-4 w-4" aria-hidden />
                Restore audio feed
              </button>
            </>
          ) : (
            <button type="button" className="btn-danger" disabled={micState !== "idle" || disabled} onClick={() => drop()}>
              <WifiOff className="h-4 w-4" aria-hidden />
              Simulate Mic/Wi-Fi Drop (Trigger Fallback)
            </button>
          )}
        </div>
      )}

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} title="Where did you reach?">
        <p className="text-sm text-slate-600">
          {dropReason ? `Transcription needs a manual checkpoint: ${dropReason}.` : `Transcription dropped at ${simulatedPosition}.`} Tap what you reached so pacing can recalibrate without losing data. This completes the session and updates the plan.
        </p>
        {slides.length > 0 && (
          <>
            <h3 className="mt-4 text-sm font-medium">Slide</h3>
            <div className="mt-2 grid max-h-52 grid-cols-5 gap-2 overflow-y-auto">
              {slides.map((slide) => (
                <button
                  key={slide}
                  type="button"
                  disabled={saving}
                  onClick={() => submit(slide)}
                  className={clsx("btn min-h-[44px] border", `S${slide}` === simulatedPosition ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 hover:bg-slate-100")}
                >
                  {slide}
                </button>
              ))}
            </div>
          </>
        )}
        <h3 className="mt-4 text-sm font-medium">{slides.length > 0 ? "Or topic" : "Topic"}</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {session.topics.map((topic) => (
            <button key={topic.label} type="button" disabled={saving} onClick={() => submit(topic.slide, topic.label)} className="btn-outline justify-start text-left">
              {topic.label}
              {topic.slide !== null && <span className="ml-auto text-xs text-slate-500">to slide {topic.slide}</span>}
            </button>
          ))}
        </div>
      </Dialog>
    </Card>
  );
}
