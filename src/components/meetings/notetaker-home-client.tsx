"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { parseJsonResponse } from "@/lib/api/parse-json-response";
import { meetingPlatformLabel } from "@/lib/meeting-assistant/platform";
import type { MeetingPlatform } from "@/lib/meeting-assistant/types";
import { Calendar, ExternalLink, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type OverviewData = {
  entitlements: { aiNotetaker: boolean };
  upcomingSessions: Array<{
    id: string;
    title: string | null;
    status: string;
    meetingPlatform: string;
    meetingUrl: string;
    scheduledStartAt: string | null;
  }>;
  recentRecaps: Array<{
    id: string;
    title: string | null;
    scheduledStartAt: string | null;
    meetingPlatform: string;
  }>;
};

export function NotetakerHomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"home" | "add" | "schedule">("home");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [title, setTitle] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  useEffect(() => {
    const requested = searchParams.get("mode");
    if (requested === "schedule") setMode("schedule");
    if (requested === "add") setMode("add");
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/meetings/overview")
      .then((r) => parseJsonResponse<{ data?: OverviewData }>(r))
      .then((json) => setData(json.data || null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  async function submitNotetaker(scheduled: boolean) {
    const url = meetingUrl.trim();
    if (!url) {
      setError("Meeting URL is required.");
      return;
    }
    if (scheduled && (!scheduleDate || !scheduleTime)) {
      setError("Date and time are required to schedule.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const scheduledStartAt = scheduled
        ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
        : undefined;
      const res = await fetch("/api/meetings/standalone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingUrl: url,
          title: title.trim() || undefined,
          scheduledStartAt,
        }),
      });
      const json = await parseJsonResponse<{ data?: { id: string }; error?: string }>(res);
      if (!res.ok) throw new Error(json.error || "Could not add AI Notetaker");

      router.push(
        scheduled ? "/meetings?filter=upcoming" : `/meetings/${json.data?.id}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add AI Notetaker");
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading AI Notetaker…</div>;
  }

  const entitled = data?.entitlements.aiNotetaker;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">AI Notetaker</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Add AI notes to Zoom, Google Meet, Microsoft Teams, or Webex. Transovo joins your
          meeting, records, transcribes, and prepares a recap with action items.
        </p>
      </div>

      {mode === "home" ? (
        <>
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-1 h-5 w-5 text-primary" />
              <div className="flex-1">
                <h2 className="font-semibold">Add to a meeting</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Paste your Zoom, Meet, Teams, or Webex link. Start now or schedule the notetaker
                  for later.
                </p>
                {entitled ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={() => setMode("add")}>Add AI Notetaker</Button>
                    <Button variant="outline" onClick={() => setMode("schedule")}>
                      Schedule for later
                    </Button>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-amber-700">
                    AI Notetaker is not available on your current plan.
                  </p>
                )}
              </div>
            </div>
          </Card>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Upcoming</h3>
                <Link href="/meetings?filter=upcoming" className="text-sm text-primary underline">
                  View all
                </Link>
              </div>
              {data?.upcomingSessions.length ? (
                <div className="space-y-2">
                  {data.upcomingSessions.map((s) => (
                    <Card key={s.id} className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{s.title || "Meeting"}</p>
                          <p className="text-xs text-muted-foreground">
                            {meetingPlatformLabel(s.meetingPlatform as MeetingPlatform)}
                            {s.scheduledStartAt
                              ? ` · ${new Date(s.scheduledStartAt).toLocaleString()}`
                              : ""}
                          </p>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <a href={s.meetingUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open meeting
                          </a>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-6 text-sm text-muted-foreground">
                  No upcoming notetaker sessions yet.
                </Card>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Recent recaps</h3>
                <Link href="/meetings?filter=past" className="text-sm text-primary underline">
                  View all
                </Link>
              </div>
              {data?.recentRecaps.length ? (
                <div className="space-y-2">
                  {data.recentRecaps.map((s) => (
                    <Link key={s.id} href={`/meetings/${s.id}`}>
                      <Card className="p-4 transition-colors hover:border-primary/40">
                        <p className="font-medium">{s.title || "Meeting recap"}</p>
                        <p className="text-xs text-muted-foreground">
                          {meetingPlatformLabel(s.meetingPlatform as MeetingPlatform)}
                          {s.scheduledStartAt
                            ? ` · ${new Date(s.scheduledStartAt).toLocaleString()}`
                            : ""}
                        </p>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <Card className="p-6 text-sm text-muted-foreground">
                  Recaps appear here after your meetings end.
                </Card>
              )}
            </section>
          </div>

          <Card className="border-dashed p-5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Want this on every booked appointment?</p>
            <p className="mt-1">
              Enable AI Notetaker on an appointment type, or{" "}
              <Link href="/settings/ai-notetaker" className="text-primary underline">
                review notetaker settings
              </Link>
              .
            </p>
          </Card>
        </>
      ) : null}

      {mode === "add" || mode === "schedule" ? (
        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            {mode === "schedule" ? <Calendar className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
            <h2 className="font-semibold">
              {mode === "schedule" ? "Schedule AI Notetaker" : "Add AI Notetaker"}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Paste a Zoom, Google Meet, Microsoft Teams, or Webex link.
          </p>
          <div>
            <Label htmlFor="notetaker-meeting-url">Meeting URL</Label>
            <Input
              id="notetaker-meeting-url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://zoom.us/j/... or meet.google.com/..."
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="notetaker-title">Title (optional)</Label>
            <Input
              id="notetaker-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
            />
          </div>
          {mode === "schedule" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="notetaker-date">Date</Label>
                <Input
                  id="notetaker-date"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="notetaker-time">Start time</Label>
                <Input
                  id="notetaker-time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button
              disabled={busy}
              onClick={() => void submitNotetaker(mode === "schedule")}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === "schedule" ? "Schedule AI Notetaker" : "Add AI Notetaker"}
            </Button>
            <Button variant="outline" onClick={() => setMode("home")}>Cancel</Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
