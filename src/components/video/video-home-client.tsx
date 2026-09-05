"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  Calendar,
  Link2,
  Loader2,
  Sparkles,
  Video,
} from "lucide-react";
import { VideoInvitePanel } from "@/components/video/video-invite-panel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type OverviewData = {
  entitlements: { transovoVideo: boolean; aiNotetaker: boolean };
  upcomingVideoMeetings: Array<{
    id: string;
    title: string | null;
    scheduledStartAt: string | null;
    publicMeetingToken?: string;
    hostJoinUrl: string;
    meetingUrl: string;
  }>;
  upcomingSessions: Array<{
    id: string;
    title: string | null;
    status: string;
    meetingSource?: string;
    meetingUrl: string;
    scheduledStartAt: string | null;
    videoMeetingId?: string | null;
  }>;
  recentRecaps: Array<{
    id: string;
    title: string | null;
    scheduledStartAt: string | null;
    meetingSource?: string;
  }>;
};

export function VideoHomeClient() {
  const router = useRouter();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"home" | "schedule" | "notetaker" | "join">("home");
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleDuration, setScheduleDuration] = useState("30");
  const [notetakerUrl, setNotetakerUrl] = useState("");
  const [notetakerTitle, setNotetakerTitle] = useState("");
  const [notetakerMode, setNotetakerMode] = useState<"now" | "schedule">("now");
  const [notetakerDate, setNotetakerDate] = useState("");
  const [notetakerTime, setNotetakerTime] = useState("");
  const [joinUrl, setJoinUrl] = useState("");

  useEffect(() => {
    fetch("/api/video/overview")
      .then((r) => r.json())
      .then((json) => setData(json.data || null))
      .finally(() => setLoading(false));
  }, []);

  async function startInstantMeeting() {
    if (!data?.entitlements.transovoVideo) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/video/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "instant" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not start meeting");
      router.push(json.data.hostJoinUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start meeting");
      setBusy(false);
    }
  }

  async function scheduleMeeting() {
    if (!scheduleDate || !scheduleTime) {
      setError("Date and time are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const scheduledStartAt = new Date(`${scheduleDate}T${scheduleTime}`);
      const res = await fetch("/api/video/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule",
          title: scheduleTitle || "Scheduled meeting",
          scheduledStartAt: scheduledStartAt.toISOString(),
          durationMinutes: Number(scheduleDuration) || 30,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not schedule meeting");
      router.push(`/meetings?filter=upcoming`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule meeting");
      setBusy(false);
    }
  }

  async function addNotetaker() {
    if (!notetakerUrl.trim()) {
      setError("Meeting URL is required.");
      return;
    }
    if (notetakerMode === "schedule" && (!notetakerDate || !notetakerTime)) {
      setError("Date and time are required for scheduled notetaker.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const scheduledStartAt =
        notetakerMode === "schedule"
          ? new Date(`${notetakerDate}T${notetakerTime}`).toISOString()
          : undefined;
      const res = await fetch("/api/meetings/standalone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingUrl: notetakerUrl.trim(),
          title: notetakerTitle.trim() || undefined,
          scheduledStartAt,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not add AI Notetaker");
      router.push(
        notetakerMode === "schedule" ? "/meetings?filter=upcoming" : `/meetings/${json.data.id}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add AI Notetaker");
      setBusy(false);
    }
  }

  function handleJoinByLink() {
    const url = joinUrl.trim();
    if (!url) return;
    if (url.includes("/video/")) {
      window.location.href = url;
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading Video…</div>;
  }

  const videoEntitled = data?.entitlements.transovoVideo;
  const notetakerEntitled = data?.entitlements.aiNotetaker;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Video</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Instant client meetings built into your scheduling workspace. Start a browser meeting,
          schedule one for later, or bring AI notes to Zoom, Meet, Teams, or Webex.
        </p>
      </div>

      {mode === "home" ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-start gap-3">
                <Video className="mt-1 h-5 w-5 text-primary" />
                <div className="flex-1">
                  <h2 className="font-semibold">Transovo Video</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Start a browser meeting instantly or schedule one for later.
                  </p>
                  {videoEntitled ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button disabled={busy} onClick={() => void startInstantMeeting()}>
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Start instant meeting
                      </Button>
                      <Button variant="outline" onClick={() => setMode("schedule")}>
                        Schedule video meeting
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-amber-700">
                      Transovo Video is not available on your current plan.
                    </p>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-1 h-5 w-5 text-primary" />
                <div className="flex-1">
                  <h2 className="font-semibold">AI Notetaker</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Bring recording, transcripts, summaries, and action items to Zoom, Meet, Teams,
                    or Webex.
                  </p>
                  {notetakerEntitled ? (
                    <Button className="mt-4" variant="outline" onClick={() => setMode("notetaker")}>
                      Add AI Notetaker
                    </Button>
                  ) : (
                    <p className="mt-4 text-sm text-amber-700">
                      AI Notetaker is not available on your current plan.
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">Join meeting</h3>
                <p className="text-sm text-muted-foreground">
                  Paste a Transovo guest link or open an external meeting URL.
                </p>
              </div>
              <Button variant="outline" onClick={() => setMode("join")}>
                <Link2 className="mr-2 h-4 w-4" />
                Join by link
              </Button>
            </div>
          </Card>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Upcoming meetings</h3>
                <Link href="/meetings?filter=upcoming" className="text-sm text-primary underline">
                  View all
                </Link>
              </div>
              {(data?.upcomingVideoMeetings.length || data?.upcomingSessions.length) ? (
                <div className="space-y-2">
                  {data?.upcomingVideoMeetings.map((m) => (
                    <Card key={m.id} className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{m.title || "Transovo Video"}</p>
                          <p className="text-xs text-muted-foreground">
                            Transovo Video
                            {m.scheduledStartAt
                              ? ` · ${new Date(m.scheduledStartAt).toLocaleString()}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                        <Button asChild size="sm">
                          <Link href={m.hostJoinUrl}>Join as host</Link>
                        </Button>
                        {m.publicMeetingToken ? (
                          <VideoInvitePanel
                            videoMeetingId={m.id}
                            token={m.publicMeetingToken}
                            title={m.title}
                            scheduledStartAt={m.scheduledStartAt}
                          />
                        ) : null}
                        </div>
                      </div>
                    </Card>
                  ))}
                  {data?.upcomingSessions
                    .filter((s) => s.meetingSource !== "transovo_video")
                    .slice(0, 4)
                    .map((s) => (
                      <Card key={s.id} className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{s.title || "Meeting"}</p>
                            <p className="text-xs text-muted-foreground">AI Notetaker</p>
                          </div>
                          <Button asChild size="sm" variant="outline">
                            <a href={s.meetingUrl} target="_blank" rel="noreferrer">
                              Open meeting
                            </a>
                          </Button>
                        </div>
                      </Card>
                    ))}
                </div>
              ) : (
                <Card className="p-6 text-sm text-muted-foreground">
                  No upcoming meetings yet.
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
                      <Card className="p-4 hover:border-primary/40 transition-colors">
                        <p className="font-medium">{s.title || "Meeting recap"}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.meetingSource === "transovo_video" ? "Transovo Video" : "AI Notetaker"}
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
            <p className="font-medium text-foreground">Want automatic booking links and reminders?</p>
            <p className="mt-1">
              Set an appointment type to Transovo Video, or{" "}
              <Link href="/appointments/booking" className="text-primary underline">
                create a booking page
              </Link>
              .
            </p>
          </Card>
        </>
      ) : null}

      {mode === "schedule" ? (
        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <h2 className="font-semibold">Schedule video meeting</h2>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} className="mt-1.5" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Start time</Label>
              <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Input type="number" min={15} value={scheduleDuration} onChange={(e) => setScheduleDuration(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void scheduleMeeting()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Schedule meeting
            </Button>
            <Button variant="outline" onClick={() => setMode("home")}>Cancel</Button>
          </div>
        </Card>
      ) : null}

      {mode === "notetaker" ? (
        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <h2 className="font-semibold">Add AI Notetaker</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Paste a Zoom, Google Meet, Microsoft Teams, or Webex link. Transovo will join, record,
            transcribe, and prepare a recap.
          </p>
          <div>
            <Label>Meeting URL</Label>
            <Input
              value={notetakerUrl}
              onChange={(e) => setNotetakerUrl(e.target.value)}
              placeholder="https://zoom.us/j/... or meet.google.com/..."
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Title (optional)</Label>
            <Input value={notetakerTitle} onChange={(e) => setNotetakerTitle(e.target.value)} className="mt-1.5" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={notetakerMode === "now" ? "default" : "outline"}
              onClick={() => setNotetakerMode("now")}
            >
              Start now
            </Button>
            <Button
              type="button"
              size="sm"
              variant={notetakerMode === "schedule" ? "default" : "outline"}
              onClick={() => setNotetakerMode("schedule")}
            >
              Schedule for later
            </Button>
          </div>
          {notetakerMode === "schedule" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={notetakerDate}
                  onChange={(e) => setNotetakerDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Start time</Label>
                <Input
                  type="time"
                  value={notetakerTime}
                  onChange={(e) => setNotetakerTime(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void addNotetaker()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {notetakerMode === "schedule" ? "Schedule AI Notetaker" : "Add AI Notetaker"}
            </Button>
            <Button variant="outline" onClick={() => setMode("home")}>Cancel</Button>
          </div>
        </Card>
      ) : null}

      {mode === "join" ? (
        <Card className="space-y-4 p-6">
          <h2 className="font-semibold">Join by link</h2>
          <Textarea
            value={joinUrl}
            onChange={(e) => setJoinUrl(e.target.value)}
            placeholder="Paste a Transovo guest link or external meeting URL"
            rows={3}
          />
          <div className="flex gap-2">
            <Button onClick={handleJoinByLink}>Continue</Button>
            <Button variant="outline" onClick={() => setMode("home")}>Cancel</Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
