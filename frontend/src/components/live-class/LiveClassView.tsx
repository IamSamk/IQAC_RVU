"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/primitives";
import { api, useResource } from "@/lib/api";
import { fallbackAttentionModel } from "@/lib/attention";
import { buildActivity } from "@/lib/fallback/activity";
import { fallbackLiveSession } from "@/lib/fallback/liveSession";
import { useRole } from "@/lib/rbac";
import type { ActivityResponse, LiveClassData } from "@/types";
import { ActivityLauncher } from "./ActivityLauncher";
import { AttentionCharts } from "./AttentionCharts";
import { StudentPreview } from "./StudentPreview";
import { TranscriptPanel } from "./TranscriptPanel";

const FALLBACK: LiveClassData = { session: fallbackLiveSession, model: fallbackAttentionModel() };
const COURSE_CODE = "CS304";

export function LiveClassView() {
  const { role } = useRole();
  const { data, source } = useResource(api.getLiveClass, FALLBACK);
  const { session, model } = data;
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [poll, setPoll] = useState(model.student_poll);

  useEffect(() => {
    setPoll(model.student_poll);
    setActivity(null);
  }, [model]);

  const pollAverage = poll.avg_preferred_split_min === null ? null : Math.round(poll.avg_preferred_split_min);
  const studentActivity = useMemo(() => buildActivity("IN_APP_10_SETS"), []);

  const onVoted = (minute: number) =>
    setPoll((current) => {
      const votes = current.votes + 1;
      const previous = current.avg_preferred_split_min ?? minute;
      return { votes, avg_preferred_split_min: (previous * current.votes + minute) / votes };
    });

  const preview = (
    <StudentPreview
      key={session.session_id}
      sessionId={session.session_id}
      sessionNumber={session.session_number}
      courseCode={COURSE_CODE}
      activity={activity ?? (role.id === "student" && source === "demo" ? studentActivity : null)}
      pollAverage={pollAverage}
      onVoted={onVoted}
    />
  );

  if (role.id === "student") {
    return (
      <>
        <PageHeader title="Live Classroom" description="Follow the lecture, report your focus, and answer your own activity set." />
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <TranscriptPanel key={session.session_id} session={session} canControl={false} />
          {preview}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Live Classroom Companion" description="Transcript-based pacing, attention modelling and anti-copying activities for the session in progress." />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-4">
          <TranscriptPanel key={session.session_id} session={session} canControl />
          <AttentionCharts model={model} sessionId={session.session_id} isLive={source === "live"} />
          <ActivityLauncher sessionId={session.session_id} activity={activity} onLaunched={setActivity} />
        </div>
        <div className="lg:sticky lg:top-14">{preview}</div>
      </div>
    </>
  );
}
