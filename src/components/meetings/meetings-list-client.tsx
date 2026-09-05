"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parseJsonResponse } from "@/lib/api/parse-json-response";
import { MEETING_STATUS_LABELS } from "@/lib/meeting-assistant/types";
import { meetingPlatformLabel } from "@/lib/meeting-assistant/platform";
import type { MeetingPlatform } from "@/lib/meeting-assistant/types";
import { NewMeetingMenu } from "@/components/meetings/new-meeting-menu";
import { ExternalLink, Sparkles } from "lucide-react";
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

function primaryAction(row: MeetingRow) {
  const upcoming = UPCOMING_STATUSES.has(row.status);
  if (upcoming && row.meetingUrl) {
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
  const [sessions, setSessions] = useState<MeetingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meetings?filter=${filter}&source=external`)
      .then((r) => parseJsonResponse<{ data?: { sessions?: MeetingRow[] } }>(r))
      .then((json) => setSessions(json.data?.sessions || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Meetings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI Notetaker history — recordings, transcripts, recaps, and action items.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewMeetingMenu />
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
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading meetings…</p>
      ) : sessions.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          No meetings yet.{" "}
          <Link href="/video" className="text-primary underline">Add AI Notetaker</Link>
          {" "}to a Zoom, Meet, Teams, or Webex link.
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
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      <p className="font-medium">{s.title || "Meeting"}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {meetingPlatformLabel(s.meetingPlatform as MeetingPlatform)}
                      {s.scheduledStartAt
                        ? ` · ${new Date(s.scheduledStartAt).toLocaleString()}`
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
                  <div className="flex flex-wrap items-center gap-2">
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
