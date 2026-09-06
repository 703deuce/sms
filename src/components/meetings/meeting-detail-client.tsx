"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { MEETING_STATUS_LABELS } from "@/lib/meeting-assistant/types";
import { meetingPlatformLabel } from "@/lib/meeting-assistant/platform";
import type { MeetingPlatform } from "@/lib/meeting-assistant/types";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MeetingSharePanel } from "@/components/meetings/meeting-share-panel";

type MeetingDetail = {
  id: string;
  title: string | null;
  status: string;
  meetingPlatform: string;
  meetingUrl: string;
  meetingSource?: string;
  scheduledStartAt: string | null;
  durationSeconds: number | null;
  summaryText: string | null;
  summaryOriginal: string | null;
  followUpEmailDraft: string | null;
  appointmentId: string | null;
  transcriptStatus?: string;
  recordingStatus?: string;
  summaryStatus?: string;
  actionItemsStatus?: string;
  followUpStatus?: string;
  recapShares?: Array<{
    id: string;
    publicUrl: string;
    expiresAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    status: "active" | "expired" | "revoked";
  }>;
  actionItems: Array<{ id: string; description: string; assigneeText: string | null; completed: boolean }>;
  transcriptSegments: Array<{ id: string; speakerName: string | null; text: string; startMs: number | null }>;
};

const PROCESSING_STATUSES = new Set(["processing", "ended", "joining", "active", "recording"]);

export function MeetingDetailClient({ meetingId }: { meetingId: string }) {
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [summary, setSummary] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/meetings/${meetingId}`);
    const json = await res.json();
    setMeeting(json.data || null);
    setSummary(json.data?.summaryText || "");
    if (json.data?.recordingStatus === "ready") {
      const rec = await fetch(`/api/meetings/${meetingId}/recording`);
      const recJson = await rec.json();
      setRecordingUrl(recJson.data?.url || null);
    } else {
      setRecordingUrl(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [meetingId]);

  useEffect(() => {
    if (!meeting || !PROCESSING_STATUSES.has(meeting.status)) return;
    const id = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(id);
  }, [meeting?.status, meetingId]);

  async function patch(action: string, extra?: Record<string, unknown>) {
    setSaving(true);
    await fetch(`/api/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    await load();
    setSaving(false);
  }

  if (loading || !meeting) {
    return <div className="p-8 text-sm text-muted-foreground">Loading meeting recap…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <Link href="/meetings" className="text-sm text-muted-foreground hover:text-foreground">← Meetings</Link>
        <h1 className="mt-2 font-display text-2xl font-semibold">{meeting.title || "Meeting recap"}</h1>
        <p className="text-sm text-muted-foreground">
          {meetingPlatformLabel(meeting.meetingPlatform as MeetingPlatform)}
          {meeting.scheduledStartAt ? ` · ${new Date(meeting.scheduledStartAt).toLocaleString()}` : ""}
          {meeting.durationSeconds ? ` · ${Math.round(meeting.durationSeconds / 60)} min` : ""}
        </p>
        <p className="mt-1 text-sm">
          Status: {MEETING_STATUS_LABELS[meeting.status as keyof typeof MEETING_STATUS_LABELS] || meeting.status}
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Transcript: {meeting.transcriptStatus || "pending"}</span>
          <span>Recording: {meeting.recordingStatus || "pending"}</span>
          <span>Summary: {meeting.summaryStatus || "pending"}</span>
          <span>Action items: {meeting.actionItemsStatus || "pending"}</span>
        </div>
        {meeting.meetingUrl && meeting.meetingSource !== "transovo_video" ? (
          <a href={meeting.meetingUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
            Open original meeting link
          </a>
        ) : null}
        {meeting.appointmentId ? (
          <Link href={`/appointments/${meeting.appointmentId}`} className="text-sm text-primary underline">
            View appointment
          </Link>
        ) : null}
        <div className="mt-4">
          <MeetingSharePanel meetingId={meetingId} initialShares={meeting.recapShares || []} />
        </div>
      </div>

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Summary</h2>
        <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={8} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={saving} onClick={() => patch("update_summary", { summaryText: summary })}>
            Save summary
          </Button>
        <Button size="sm" variant="outline" disabled={saving} onClick={() => patch("reset_summary")}>
          Reset to original
        </Button>
        {meeting.status === "processing" || meeting.status === "no_recap" || meeting.summaryStatus === "failed" ? (
          <Button size="sm" variant="outline" disabled={saving} onClick={() => patch("retry_processing")}>
            Retry recap processing
          </Button>
        ) : null}
        </div>
      </Card>

      {recordingUrl ? (
        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Recording</h2>
          <video src={recordingUrl} controls className="w-full rounded-lg bg-black" />
        </Card>
      ) : meeting.recordingStatus === "processing" ? (
        <Card className="p-5 text-sm text-muted-foreground">Recording is being processed…</Card>
      ) : null}

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Action items</h2>
        {meeting.actionItems.length ? (
          <ul className="space-y-2">
            {meeting.actionItems.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={(e) =>
                    patch("toggle_action_item", { itemId: item.id, completed: e.target.checked })
                  }
                />
                <span>
                  {item.description}
                  {item.assigneeText ? ` — ${item.assigneeText}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No action items yet.</p>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Transcript</h2>
        <div className="max-h-80 space-y-3 overflow-y-auto text-sm">
          {meeting.transcriptSegments.map((seg) => (
            <div key={seg.id}>
              <p className="font-medium text-muted-foreground">{seg.speakerName || "Speaker"}</p>
              <p>{seg.text}</p>
            </div>
          ))}
          {!meeting.transcriptSegments.length ? (
            <p className="text-muted-foreground">Transcript not available yet.</p>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Follow-up email draft</h2>
        <Textarea value={meeting.followUpEmailDraft || ""} readOnly rows={6} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={saving} onClick={() => patch("generate_follow_up")}>
            Regenerate follow-up
          </Button>
          {meeting.followUpEmailDraft ? (
            <Button
              size="sm"
              disabled={saving}
              onClick={() => patch("send_follow_up")}
            >
              Send follow-up email
            </Button>
          ) : null}
        </div>
        {meeting.followUpStatus === "sent" ? (
          <p className="text-xs text-emerald-700">Follow-up email sent.</p>
        ) : null}
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">Ask AI</h2>
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What did the customer agree to?"
          rows={2}
        />
        <Button
          size="sm"
          disabled={saving || !question.trim()}
          onClick={async () => {
            setSaving(true);
            const res = await fetch(`/api/meetings/${meetingId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "ask", question }),
            });
            const json = await res.json();
            setAnswer(json.data?.answer || "");
            setSaving(false);
          }}
        >
          Ask
        </Button>
        {answer ? <p className="text-sm whitespace-pre-wrap">{answer}</p> : null}
      </Card>
    </div>
  );
}
