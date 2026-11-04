"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/primitives";
import { api, useResource } from "@/lib/api";
import { fallbackAttentionModel } from "@/lib/attention";
import { buildActivity } from "@/lib/fallback/activity";
import { useRole } from "@/lib/rbac";
import type { ActivityResponse } from "@/types";
import { ActivityLauncher } from "./ActivityLauncher";
import { AttentionCharts } from "./AttentionCharts";
import { StudentPreview } from "./StudentPreview";
import { TranscriptPanel } from "./TranscriptPanel";

const FALLBACK_MODEL = fallbackAttentionModel();
const SEEDED_SPLIT_VOTES = [22, 24, 20, 23, 21];

export function LiveClassView() {
  const { role } = useRole();
  const { data: model } = useResource(api.getAttention, FALLBACK_MODEL);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [pollOverride, setPollOverride] = useState(false);
  const [votes, setVotes] = useState(SEEDED_SPLIT_VOTES);

  const pollMinute = Math.round(votes.reduce((sum, vote) => sum + vote, 0) / votes.length);
  const preview = (
    <StudentPreview
      activity={activity ?? (role.id === "student" ? buildActivity("IN_APP_10_SETS") : null)}
      pollMinute={pollMinute}
      onVoteSplit={(minute) => setVotes((current) => [...current, minute])}
    />
  );

  if (role.id === "student") {
    return (
      <>
        <PageHeader title="Live Classroom" description="Follow the lecture, report your focus, and answer your own activity set." />
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <TranscriptPanel canControl={false} />
          {preview}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Live Classroom Companion"
        description="Transcript-based pacing, attention modelling and anti-copying activities for the session in progress."
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-4">
          <TranscriptPanel canControl={role.canApprove} />
          <AttentionCharts model={model} pollOverride={pollOverride} pollMinute={pollMinute} onTogglePoll={setPollOverride} />
          <ActivityLauncher activity={activity} onLaunched={setActivity} />
        </div>
        <div className="lg:sticky lg:top-14">{preview}</div>
      </div>
    </>
  );
}
