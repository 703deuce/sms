"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, CalendarClock, Check, CheckCircle2, Circle, Clock,
  ExternalLink, FileText, ListChecks, Mail, Mic, Pause, Play, RefreshCw,
  RotateCcw, Save, Send, Sparkles, Video,
} from "lucide-react";
import { Button, Card, CardTitle, Input, Label, StatusChip, Textarea, artifactTone, cn } from "./ui";
import { MeetingSharePanel } from "./MeetingSharePanel";
import { MEETING_STATUS_LABELS, mockMeeting, type MeetingDetail } from "../types";

const PROCESSING_STATUSES = new Set(["processing", "ended", "joining", "active", "recording"]);

function platformLabel(p: string) {
  switch (p) {
    case "zoom": return "Zoom";
    case "google_meet": return "Google Meet";
    case "microsoft_teams": return "Microsoft Teams";
    case "webex": return "Webex";
    case "transovo_video": return "Transovo Video";
    default: return "Online meeting";
  }
}

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function MeetingDetailClient({ meetingId }: { meetingId: string }) {
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [summary, setSummary] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState("");
  const playTimer = useRef<number | null>(null);

  async function load() {
    setLoadError(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`);
      const json = await res.json();
      const data = json.data as MeetingDetail | null;
      setMeeting(data);
      setSummary(data?.summaryText || "");
      setFollowUpDraft(data?.followUpEmailDraft || "");
      if (data?.recordingStatus === "ready") {
        const rec = await fetch(`/api/meetings/${meetingId}/recording`);
        const recJson = await rec.json();
        setRecordingUrl(recJson.data?.url || null);
      } else {
        setRecordingUrl(null);
      }
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    return () => {
      if (playTimer.current) window.clearTimeout(playTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  useEffect(() => {
    if (!meeting || !PROCESSING_STATUSES.has(meeting.status)) return;
    const id = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.status, meetingId]);

  async function patch(action: string, extra?: Record<string, unknown>) {
    setSaving(action);
    const res = await fetch(`/api/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    if (action === "ask" && res.ok) {
      const json = await res.json();
      setAnswer(json.data?.answer || "");
      setSaving(null);
      return;
    }
    await load();
    setSaving(null);
  }

  function togglePlay() {
    if (playing) {
      if (playTimer.current) window.clearTimeout(playTimer.current);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    // Sandbox: auto-stop after a short simulated playback window
    playTimer.current = window.setTimeout(() => setPlaying(false), 8000);
  }

  async function askQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    await new Promise((r) => setTimeout(r, 900));
    setAnswer(
      "Based on the transcript, the written estimate will be sent by Thursday and includes both pricing tiers with the 10-year warranty breakdown. The provisional installation slot is Tuesday between 8:00 and 11:00 AM.",
    );
    setAsking(false);
  }

  const statusTone = useMemo(() => {
    if (!meeting) return "neutral" as const;
    if (meeting.status === "completed") return "success" as const;
    if (PROCESSING_STATUSES.has(meeting.status)) return "info" as const;
    if (meeting.status === "failed" || meeting.status === "no_recap") return "danger" as const;
    if (meeting.status === "canceled") return "neutral" as const;
    return "warning" as const;
  }, [meeting]);

  /* ---------- Loading ---------- */
  if (loading && !meeting) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 px-6 py-6" aria-busy="true" aria-label="Loading meeting recap">
        <div className="ts-skeleton h-4 w-28" />
        <div className="ts-skeleton h-8 w-96 max-w-full" />
        <div className="ts-skeleton h-4 w-72 max-w-full" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="ts-skeleton h-56" />
            <div className="ts-skeleton h-40" />
          </div>
          <div className="ts-skeleton h-72" />
        </div>
      </div>
    );
  }

  /* ---------- Error ---------- */
  if (loadError || !meeting) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6">
        <Link
          href="/meetings"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Meetings
        </Link>
        <Card className="mt-6 flex flex-col items-center px-6 py-12 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(0_72%_51%/0.08)]">
            <AlertTriangle className="h-5 w-5 text-[hsl(0_72%_44%)]" />
          </div>
          <h1 className="mt-4 font-display text-lg font-semibold tracking-tight">
            This recap couldn't be loaded
          </h1>
          <p className="mt-1.5 max-w-sm text-[13px] text-muted-foreground">
            The meeting recap may have been removed, or the connection was interrupted. Your other recaps are unaffected.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setLoading(true);
                void load();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </Button>
            <Link href="/meetings">
              <Button size="sm" variant="outline">
                Back to recaps
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const isProcessing = PROCESSING_STATUSES.has(meeting.status);
  const hasFailedArtifacts =
    meeting.transcriptStatus === "failed" ||
    meeting.summaryStatus === "failed" ||
    meeting.actionItemsStatus === "failed";

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      {/* Back + header */}
      <Link
        href="/meetings"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Meetings
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-[22px] font-semibold leading-tight tracking-tight">
              {meeting.title || "Meeting recap"}
            </h1>
            <StatusChip tone={statusTone} pulse={isProcessing}>
              {MEETING_STATUS_LABELS[meeting.status] || meeting.status}
            </StatusChip>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5" />
              {platformLabel(meeting.meetingPlatform)}
            </span>
            {meeting.scheduledStartAt ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                {new Date(meeting.scheduledStartAt).toLocaleString(undefined, {
                  weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                })}
              </span>
            ) : null}
            {meeting.durationSeconds ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {Math.round(meeting.durationSeconds / 60)} min
              </span>
            ) : null}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {meeting.meetingUrl && meeting.meetingSource !== "transovo_video" ? (
              <a
                href={meeting.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
              >
                Open original meeting link
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            {meeting.appointmentId ? (
              <Link
                href={`/appointments/${meeting.appointmentId}`}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
              >
                {meeting.appointmentLabel || "View appointment"}
                <ExternalLink className="h-3 w-3" />
              </Link>
            ) : null}
          </div>
        </div>
        <div className="shrink-0">
          <MeetingSharePanel meetingId={meetingId} initialShares={meeting.recapShares} />
        </div>
      </div>

      {/* Artifact pipeline status */}
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          ["Recording", meeting.recordingStatus],
          ["Transcript", meeting.transcriptStatus],
          ["Summary", meeting.summaryStatus],
          ["Action items", meeting.actionItemsStatus],
          ["Follow-up", meeting.followUpStatus],
        ].map(([label, st]) => (
          <span
            key={label as string}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px]"
          >
            <span className="text-muted-foreground">{label as string}</span>
            <StatusChip tone={artifactTone(st as string)} pulse={st === "processing"}>
              {(st as string) || "pending"}
            </StatusChip>
          </span>
        ))}
      </div>

      {isProcessing ? (
        <div
          className="mt-4 flex items-center gap-2.5 rounded-xl border border-[hsl(234_62%_54%/0.25)] bg-[hsl(234_62%_54%/0.05)] px-4 py-3 text-[13px] text-foreground"
          role="status"
        >
          <span className="ts-spinner" aria-hidden="true" />
          Transovo is processing this meeting. The recap updates automatically — no need to refresh.
        </div>
      ) : null}

      {hasFailedArtifacts && !isProcessing ? (
        <div
          className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[hsl(0_72%_51%/0.25)] bg-[hsl(0_72%_51%/0.05)] px-4 py-3"
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-[hsl(0_72%_44%)]" />
          <p className="min-w-0 flex-1 text-[13px] text-foreground">
            Recap processing didn't finish for this meeting. The recording is safe — you can retry generating the
            transcript, summary, and action items.
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={saving !== null}
            onClick={() => patch("retry_processing")}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {saving === "retry_processing" ? "Retrying…" : "Retry processing"}
          </Button>
        </div>
      ) : null}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-5 lg:col-span-2">
          {/* Summary */}
          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Summary
              </CardTitle>
              {savedFlash ? (
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[hsl(152_56%_30%)]" role="status">
                  <Check className="h-3.5 w-3.5" /> Saved
                </span>
              ) : null}
            </div>
            {meeting.summaryStatus === "processing" ? (
              <div className="space-y-2 py-1" aria-label="Summary is being generated">
                <div className="ts-skeleton h-3.5 w-full" />
                <div className="ts-skeleton h-3.5 w-11/12" />
                <div className="ts-skeleton h-3.5 w-4/5" />
              </div>
            ) : (
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={8}
                aria-label="Meeting summary"
                placeholder="No summary yet. Once processing finishes, the AI-generated summary appears here and you can edit it."
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={saving !== null || !summary.trim()}
                onClick={() => patch("update_summary", { summaryText: summary })}
              >
                <Save className="h-3.5 w-3.5" />
                {saving === "update_summary" ? "Saving…" : "Save summary"}
              </Button>
              <Button size="sm" variant="outline" disabled={saving !== null} onClick={() => patch("reset_summary")}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to original
              </Button>
              {meeting.status === "processing" || meeting.status === "no_recap" || meeting.summaryStatus === "failed" ? (
                <Button size="sm" variant="outline" disabled={saving !== null} onClick={() => patch("retry_processing")}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  {saving === "retry_processing" ? "Retrying…" : "Retry recap processing"}
                </Button>
              ) : null}
            </div>
          </Card>

          {/* Recording */}
          {recordingUrl ? (
            <Card className="space-y-3 p-5">
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-muted-foreground" />
                Recording
                {playing ? (
                  <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary" role="status">
                    <span className="h-1.5 w-1.5 rounded-full bg-current ts-pulse-dot" />
                    Playing
                  </span>
                ) : null}
              </CardTitle>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
                <button
                  type="button"
                  aria-label={playing ? "Pause recording" : "Play recording"}
                  aria-pressed={playing}
                  onClick={togglePlay}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {playing ? (
                    <Pause className="h-4 w-4 fill-current" />
                  ) : (
                    <Play className="ml-0.5 h-4 w-4 fill-current" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex h-8 items-end gap-[3px]" aria-hidden="true">
                    {[10, 18, 26, 14, 30, 22, 12, 28, 20, 16, 32, 24, 10, 18, 26, 14, 22, 30, 12, 20, 16, 26, 10, 18, 24, 14, 28, 20, 12, 22].map(
                      (h, i) => (
                        <span
                          key={i}
                          className={cn(
                            "w-[3px] rounded-full",
                            i < 9 ? "bg-primary/70" : "bg-border",
                            playing && "ts-wave-bar",
                          )}
                          style={{ height: `${h}px` }}
                        />
                      ),
                    )}
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>{playing ? "Playing…" : "0:00"}</span>
                    <span>{Math.round((meeting.durationSeconds || 0) / 60)}:00</span>
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          {/* Transcript */}
          <Card className="space-y-3 p-5">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Transcript
            </CardTitle>
            {meeting.transcriptSegments.length ? (
              <ol className="divide-y divide-border/70 rounded-lg border border-border">
                {meeting.transcriptSegments.map((seg) => (
                  <li key={seg.id} className="ts-transcript-row flex gap-3 px-3.5 py-2.5 transition-colors">
                    <span className="mt-0.5 w-9 shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                      {seg.startMs != null ? fmtMs(seg.startMs) : "—"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-foreground/90">{seg.speakerName || "Speaker"}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-foreground/80">{seg.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-[13px] text-muted-foreground">
                {meeting.transcriptStatus === "processing"
                  ? "Transcription in progress…"
                  : meeting.transcriptStatus === "failed"
                    ? "Transcription failed. Use Retry processing above to try again."
                    : "No transcript available for this meeting."}
              </p>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Action items */}
          <Card className="space-y-3 p-5">
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              Action items
              {meeting.actionItems.length ? (
                <span className="ml-auto text-[11px] font-semibold text-muted-foreground">
                  {meeting.actionItems.filter((a) => a.completed).length}/{meeting.actionItems.length} done
                </span>
              ) : null}
            </CardTitle>
            {meeting.actionItems.length ? (
              <ul className="space-y-2">
                {meeting.actionItems.map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5 rounded-lg border border-border p-2.5">
                    <button
                      type="button"
                      aria-label={item.completed ? `Mark "${item.description}" not done` : `Mark "${item.description}" done`}
                      aria-pressed={item.completed}
                      className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-[hsl(152_56%_36%)]"
                      onClick={() =>
                        setMeeting({
                          ...meeting,
                          actionItems: meeting.actionItems.map((a) =>
                            a.id === item.id ? { ...a, completed: !a.completed } : a,
                          ),
                        })
                      }
                    >
                      {item.completed ? (
                        <CheckCircle2 className="h-[18px] w-[18px] text-[hsl(152_56%_36%)]" />
                      ) : (
                        <Circle className="h-[18px] w-[18px]" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-[13px] leading-snug",
                          item.completed ? "text-muted-foreground line-through" : "text-foreground/90",
                        )}
                      >
                        {item.description}
                      </p>
                      {item.assigneeText ? (
                        <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{item.assigneeText}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-5 text-center text-[13px] text-muted-foreground">
                {meeting.actionItemsStatus === "processing" || meeting.actionItemsStatus === "pending"
                  ? "Action items will appear once processing finishes."
                  : meeting.actionItemsStatus === "failed"
                    ? "Action items couldn't be generated. Retry processing to try again."
                    : "No action items were identified in this meeting."}
              </p>
            )}
          </Card>

          {/* Follow-up email */}
          <Card className="space-y-3 p-5">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Follow-up email
            </CardTitle>
            {meeting.followUpEmailDraft ? (
              meeting.followUpStatus === "sent" ? (
                <>
                  <div className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3.5 text-[13px] leading-relaxed text-foreground/85">
                    {meeting.followUpEmailDraft}
                  </div>
                  <StatusChip tone="success">Sent to attendees</StatusChip>
                </>
              ) : (
                <>
                  <Label htmlFor="followup-draft">Review and edit before sending</Label>
                  <Textarea
                    id="followup-draft"
                    value={followUpDraft}
                    onChange={(e) => setFollowUpDraft(e.target.value)}
                    rows={9}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={saving !== null || !followUpDraft.trim()}
                      onClick={() => patch("send_follow_up", { draftText: followUpDraft })}
                    >
                      <Send className="h-3.5 w-3.5" />
                      {saving === "send_follow_up" ? "Sending…" : "Send follow-up"}
                    </Button>
                  </div>
                </>
              )
            ) : (
              <>
                <p className="text-[13px] text-muted-foreground">
                  Generate a draft follow-up email from this recap. You can review it before anything is sent.
                </p>
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving !== null || meeting.followUpStatus === "processing"}
                    onClick={() => patch("generate_follow_up")}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {saving === "generate_follow_up" ? "Generating…" : "Generate follow-up"}
                  </Button>
                </div>
              </>
            )}
          </Card>

          {/* Ask about this meeting */}
          <Card className="space-y-3 p-5">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              Ask about this meeting
            </CardTitle>
            <form onSubmit={(e) => void askQuestion(e)} className="space-y-2">
              <Label htmlFor="meeting-question" className="sr-only">
                Ask a question about this meeting
              </Label>
              <div className="flex gap-2">
                <Input
                  id="meeting-question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. When is the estimate due?"
                />
                <Button size="md" type="submit" disabled={asking || !question.trim()}>
                  {asking ? "…" : "Ask"}
                </Button>
              </div>
            </form>
            {asking ? (
              <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3.5" role="status">
                <div className="ts-skeleton h-3 w-full" />
                <div className="ts-skeleton h-3 w-3/4" />
              </div>
            ) : answer ? (
              <div className="rounded-lg border border-[hsl(234_62%_54%/0.25)] bg-[hsl(234_62%_54%/0.05)] p-3.5 text-[13px] leading-relaxed text-foreground/85">
                {answer}
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
