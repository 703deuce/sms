"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MEETING_STATUS_LABELS } from "@/lib/meeting-assistant/types";
import { meetingPlatformLabel } from "@/lib/meeting-assistant/platform";
import type { MeetingPlatform } from "@/lib/meeting-assistant/types";
import { NewMeetingMenu } from "@/components/meetings/new-meeting-menu";
import { ExternalLink, Sparkles, Video } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type MeetingRow = {
  id: string;
  title: string | null;
  status: string;
  meetingPlatform: string;
  meetingSource?: string | null;
  scheduledStartAt: string | null;
  appointmentId?: string | null;
  videoMeetingId?: string | null;
  meetingUrl?: string;
  recordingStatus?: string;
  summaryStatus?: string;
};

const UPCOMING_STATUSES = new Set([
  "pending",
  "scheduled",
  "joining",
  "awaiting_admission",
  "active",
  "recording",
  "waiting",
]);

function sourceLabel(row: MeetingRow) {
  return row.meetingSource === "transovo_video" ? "Transovo Video" : "AI Notetaker";
}

function primaryAction(row: MeetingRow) {
  const upcoming = UPCOMING_STATUSES.has(row.status);
  if (row.meetingSource === "transovo_video" && upcoming && row.videoMeetingId) {
    return { label: "Join as host", href: `/video/rooms/${row.videoMeetingId}/host` };
  }
  if (row.meetingSource === "transovo_video" && upcoming && row.appointmentId) {
    return { label: "Join as host", href: `/appointments/${row.appointmentId}/video/host` };
  }
  if (row.meetingSource !== "transovo_video" && upcoming && row.meetingUrl) {
    return { label: "Open meeting", href: row.meetingUrl, external: true };
  }
  if (row.status === "completed" || row.summaryStatus === "ready") {
    return { label: "View recap", href: `/meetings/${row.id}` };
  }
  if (row.status === "processing") {
    return { label: "Processing", href: `/meetings/${row.id}` };
  }
  if (row.status === "failed" || row.summaryStatus === "failed") {
    return { label: "Retry", href: `/meetings/${row.id}` };
  }
  return { label: "View", href: `/meetings/${row.id}` };
}

export function MeetingsListClient() {
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("all");
  const [source, setSource] = useState<"all" | "transovo_video" | "external">("all");
  const [sessions, setSessions] = useState<MeetingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meetings?filter=${filter}&source=${source}`)
      .then((r) => r.json())
      .then((json) => setSessions(json.data?.sessions || []))
      .finally(() => setLoading(false));
  }, [filter, source]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Meetings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Meeting history, recordings, transcripts, recaps, and action items.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewMeetingMenu />
          <Link href="/settings/transovo-video">
            <Button variant="outline" size="sm">Video settings</Button>
          </Link>
          <Link href="/settings/ai-notetaker">
            <Button variant="outline" size="sm">Notetaker settings</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["upcoming", "past", "all"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "upcoming" ? "Upcoming" : f === "past" ? "Past" : "All"}
          </Button>
        ))}
        {(["all", "transovo_video", "external"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={source === s ? "default" : "outline"}
            onClick={() => setSource(s)}
          >
            {s === "all" ? "All" : s === "transovo_video" ? "Transovo Video" : "AI Notetaker"}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading meetings…</p>
      ) : sessions.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          No meetings yet.{" "}
          <Link href="/video" className="text-primary underline">Start a video meeting</Link>
          {" "}or add AI Notetaker to an external link.
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const action = primaryAction(s);
            return (
              <Card key={s.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {s.meetingSource === "transovo_video" ? (
                        <Video className="h-4 w-4 text-violet-600" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-indigo-600" />
                      )}
                      <p className="font-medium">{s.title || "Meeting"}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {sourceLabel(s)}
                      {s.scheduledStartAt
                        ? ` · ${new Date(s.scheduledStartAt).toLocaleString()}`
                        : ""}
                      {s.meetingSource !== "transovo_video"
                        ? ` · ${meetingPlatformLabel(s.meetingPlatform as MeetingPlatform)}`
                        : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>
                        Status: {MEETING_STATUS_LABELS[s.status as keyof typeof MEETING_STATUS_LABELS] || s.status}
                      </span>
                      {s.recordingStatus ? <span>Recording: {s.recordingStatus}</span> : null}
                      {s.summaryStatus ? <span>Recap: {s.summaryStatus}</span> : null}
                      {s.appointmentId ? (
                        <Link href={`/appointments/${s.appointmentId}`} className="underline">
                          View appointment
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {action.external ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={action.href} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          {action.label}
                        </a>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant={action.label === "View recap" ? "default" : "outline"}>
                        <Link href={action.href}>{action.label}</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
