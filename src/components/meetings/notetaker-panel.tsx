"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { MEETING_STATUS_LABELS } from "@/lib/meeting-assistant/types";
import { meetingPlatformLabel } from "@/lib/meeting-assistant/platform";
import type { MeetingPlatform } from "@/lib/meeting-assistant/types";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type MeetingSessionRow = {
  id: string;
  title: string | null;
  status: string;
  meetingPlatform: string;
  meetingUrl: string;
  scheduledStartAt: string | null;
  summaryText?: string | null;
  transcriptStatus?: string;
  recordingStatus?: string;
  summaryStatus?: string;
};

const ACTIVE_STATUSES = new Set([
  "scheduled",
  "joining",
  "awaiting_admission",
  "active",
  "recording",
  "processing",
]);

export function NotetakerPanel({ appointmentId }: { appointmentId: string }) {
  const [session, setSession] = useState<MeetingSessionRow | null>(null);
  const [resolvedMeetingUrl, setResolvedMeetingUrl] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/meetings`);
      const json = await res.json();
      const external = json.data?.externalSession as MeetingSessionRow | null;
      setSession(external);
      const resolved = String(json.data?.resolvedMeetingUrl || "");
      setResolvedMeetingUrl(resolved);
      if (external?.meetingUrl) setMeetingUrl(external.meetingUrl);
      else if (resolved) setMeetingUrl(resolved);
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!session || !ACTIVE_STATUSES.has(session.status)) return;
    const id = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(id);
  }, [session, load]);

  async function enable() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/meetings/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, meetingUrl: meetingUrl.trim() || resolvedMeetingUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not enable Notetaker");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/meetings/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable" }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Could not disable");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <Card className="p-4 text-sm text-muted-foreground">Loading AI Notetaker…</Card>;
  }

  const statusLabel =
    MEETING_STATUS_LABELS[session?.status as keyof typeof MEETING_STATUS_LABELS] ||
    session?.status ||
    "Off";

  const joinUrl = session?.meetingUrl || resolvedMeetingUrl || meetingUrl;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="font-display text-base font-semibold">AI Notetaker</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Transovo joins your Zoom, Meet, Teams, or Webex meeting, captures transcript and recording, and generates a recap.
      </p>

      {session?.status === "completed" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="font-medium text-emerald-900">Meeting recap ready</p>
          <Link href={`/meetings/${session.id}`} className="text-emerald-800 underline">
            View recap
          </Link>
        </div>
      ) : session && session.status !== "disabled" ? (
        <div className="space-y-3 text-sm">
          <p>
            <span className="text-muted-foreground">Platform:</span>{" "}
            {meetingPlatformLabel(session.meetingPlatform as MeetingPlatform)}
          </p>
          <p>
            <span className="text-muted-foreground">Status:</span> {statusLabel}
          </p>
          {session.status === "awaiting_admission" ? (
            <p className="text-amber-700">Awaiting host admission in the meeting waiting room.</p>
          ) : null}
          {joinUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={joinUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open meeting
              </a>
            </Button>
          ) : null}
          {session.status === "processing" ? (
            <p className="text-muted-foreground">Processing transcript, recording, and recap…</p>
          ) : null}
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void disable()}>
            Disable Notetaker
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label>Meeting link</Label>
            <Input
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://zoom.us/j/... or meet.google.com/..."
              className="mt-1.5"
            />
            {resolvedMeetingUrl && !meetingUrl ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Detected from appointment: {resolvedMeetingUrl}
              </p>
            ) : null}
          </div>
          <Button disabled={busy || !(meetingUrl.trim() || resolvedMeetingUrl)} onClick={() => void enable()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add AI Notetaker
          </Button>
        </div>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </Card>
  );
}
