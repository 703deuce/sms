"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MEETING_STATUS_LABELS } from "@/lib/meeting-assistant/types";
import { meetingPlatformLabel } from "@/lib/meeting-assistant/platform";
import type { MeetingPlatform } from "@/lib/meeting-assistant/types";
import { Sparkles } from "lucide-react";
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
};

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
            Transovo Video and AI Notetaker recaps, transcripts, and action items.
          </p>
        </div>
        <div className="flex gap-2">
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
            {f === "upcoming" ? "Upcoming" : f === "past" ? "Recaps" : "All"}
          </Button>
        ))}
        {(["all", "transovo_video", "external"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={source === s ? "default" : "outline"}
            onClick={() => setSource(s)}
          >
            {s === "all" ? "All sources" : s === "transovo_video" ? "Transovo Video" : "Zoom, Meet & Teams"}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading meetings…</p>
      ) : sessions.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          No meetings yet. Book an appointment with Transovo Video or enable AI Notetaker on an external meeting link.
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Link key={s.id} href={`/meetings/${s.id}`}>
              <Card className="p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{s.title || "Meeting"}</p>
                    <p className="text-sm text-muted-foreground">
                      {meetingPlatformLabel(s.meetingPlatform as MeetingPlatform)}
                      {s.scheduledStartAt
                        ? ` · ${new Date(s.scheduledStartAt).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    {MEETING_STATUS_LABELS[s.status as keyof typeof MEETING_STATUS_LABELS] || s.status}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
