"use client";

import { ConnectedRecordsPanel } from "@/components/contacts/connected-records-panel";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { RecordingPlayer } from "@/components/voice/recording-player";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Segment = {
  id: string;
  speaker: string;
  text: string;
  startMs?: number | null;
  endMs?: number | null;
};
type Transcript = {
  id: string;
  status: string;
  fullText?: string | null;
  language?: string | null;
  segments?: Segment[];
};
type Insight = {
  id: string;
  summary?: string | null;
  intent?: string | null;
  sentiment?: string | null;
  isLead?: boolean | null;
  leadScore?: number | null;
  qualification?: Record<string, boolean> | null;
  topics?: string[] | null;
  objections?: string[] | null;
  actionItems?: string[] | null;
  needsReview?: boolean;
  confidence?: number | null;
  customFields?: Record<string, unknown> | null;
};
type CallEvent = {
  id: string;
  eventType: string;
  createdAt: string;
  payload?: Record<string, unknown> | null;
};
type ToolExecution = {
  id: string;
  toolType?: string | null;
  status?: string | null;
  latencyMs?: number | null;
  createdAt?: string;
  input?: unknown;
  output?: unknown;
  error?: string | null;
};
type Transfer = {
  id: string;
  transferType?: string | null;
  destination?: string | null;
  status?: string | null;
  summary?: string | null;
};

function fmtMs(ms?: number | null) {
  if (ms == null) return "";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function speakerLabel(speaker: string) {
  const s = speaker.toLowerCase();
  if (s.includes("agent") || s.includes("assistant") || s.includes("ai") || s === "a") {
    return "AI";
  }
  if (s.includes("customer") || s.includes("caller") || s.includes("user") || s === "b") {
    return "Caller";
  }
  return speaker;
}

function isAgent(speaker: string) {
  return speakerLabel(speaker) === "AI";
}

const sentimentTone: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-800",
  negative: "bg-red-100 text-red-800",
  neutral: "bg-slate-100 text-slate-700",
};

export default function VoiceCallDetailPage() {
  const params = useParams();
  const id = String(params.id || "");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/voice/calls/${id}`)
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .catch(() => undefined);
  }, [id]);

  const call = data?.call as Record<string, unknown> | undefined;
  const recordings = (data?.recordings as Array<{ id: string; status: string }>) || [];
  const transcripts = (data?.transcripts as Transcript[]) || [];
  const insights = (data?.insights as Insight[]) || [];
  const events = (data?.events as CallEvent[]) || [];
  const transfers = (data?.transfers as Transfer[]) || [];
  const toolExecutions = (data?.toolExecutions as ToolExecution[]) || [];

  const segments: Segment[] = transcripts.flatMap((t) => t.segments || []);
  const fullText = transcripts.map((t) => t.fullText).filter(Boolean).join("\n\n");
  const insight = insights[0];

  const filteredSegments = useMemo(() => {
    const q = transcriptQuery.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, transcriptQuery]);

  async function copyTranscript() {
    const text =
      segments.length > 0
        ? segments
            .map(
              (s) =>
                `${fmtMs(s.startMs)} ${speakerLabel(s.speaker)}\n${s.text}`,
            )
            .join("\n\n")
        : fullText;
    if (!text) return;
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadTranscript() {
    const text =
      segments.length > 0
        ? segments
            .map(
              (s) =>
                `${fmtMs(s.startMs)} ${speakerLabel(s.speaker)}\n${s.text}`,
            )
            .join("\n\n")
        : fullText;
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call-${id}-transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const followUps = insight?.actionItems || [];
  const keyFacts = [
    ...(insight?.topics || []).map((t) => t),
    ...(insight?.qualification
      ? Object.entries(insight.qualification)
          .filter(([, v]) => v)
          .map(([k]) => k.replace(/_/g, " "))
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Call details"
        description="Recording, transcript, AI summary, tools, and CRM — like a modern phone system."
      />
      <VoiceSubNav />
      {!call ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-2 p-5">
            <CardTitle>Call</CardTitle>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <StatusChip status={String(call.status)} />
              {call.outcome ? <StatusChip status={String(call.outcome)} /> : null}
              {call.transferred ? <StatusChip status="TRANSFERRED" /> : null}
            </div>
            <p className="text-sm">
              <strong>From:</strong> {String(call.fromE164)}
            </p>
            <p className="text-sm">
              <strong>To:</strong> {String(call.toE164)}
            </p>
            <p className="text-sm">
              <strong>Direction:</strong> {String(call.direction)}
            </p>
            <p className="text-sm">
              <strong>Started:</strong>{" "}
              {new Date(String(call.startedAt)).toLocaleString()}
            </p>
            {call.durationSeconds != null ? (
              <p className="text-sm">
                <strong>Duration:</strong> {fmtMs(Number(call.durationSeconds) * 1000)}
              </p>
            ) : null}
            <p className="text-sm">
              <strong>Call ID:</strong>{" "}
              <span className="font-mono text-xs">{String(call.id)}</span>
            </p>
            {call.telnyxCallControlId ? (
              <p className="text-sm">
                <strong>Telnyx:</strong>{" "}
                <span className="font-mono text-xs">
                  {String(call.telnyxCallControlId)}
                </span>
              </p>
            ) : null}
            {call.leadScore != null ? (
              <p className="text-sm">
                <strong>Lead score:</strong> {String(call.leadScore)}
              </p>
            ) : null}
          </Card>

          <Card className="p-5">
            <CardTitle>Recording</CardTitle>
            {recordings.length ? (
              <div className="mt-2 space-y-4">
                {recordings.map((r) => (
                  <RecordingPlayer key={r.id} recordingId={r.id} label={r.status} />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No recording for this call.
              </p>
            )}
          </Card>

          <Card className="p-5 lg:col-span-2">
            <CardTitle>AI Summary</CardTitle>
            {!insight ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No insights generated yet.
              </p>
            ) : (
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Reason for call
                    </p>
                    <p className="mt-1 text-sm leading-relaxed">
                      {insight.summary || "—"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {insight.intent ? (
                      <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800">
                        {insight.intent.replace(/_/g, " ")}
                      </span>
                    ) : null}
                    {insight.sentiment ? (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          sentimentTone[insight.sentiment] ||
                            "bg-muted text-muted-foreground",
                        )}
                      >
                        {insight.sentiment}
                      </span>
                    ) : null}
                    {insight.isLead ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                        Lead
                        {insight.leadScore != null ? ` · ${insight.leadScore}` : ""}
                      </span>
                    ) : null}
                  </div>
                  {keyFacts.length ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Key information
                      </p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
                        {keyFacts.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Outcome
                    </p>
                    <p className="mt-1 text-sm">
                      {String(call.outcome || call.status).replace(/_/g, " ")}
                      {call.appointmentBooked ? " · Appointment booked" : ""}
                      {call.transferred ? " · Transferred" : ""}
                      {call.voicemailDetected ? " · Voicemail" : ""}
                    </p>
                  </div>
                  {followUps.length ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Follow-up
                      </p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
                        {followUps.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {insight.objections && insight.objections.length ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Objections
                      </p>
                      <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
                        {insight.objections.map((o, i) => (
                          <li key={i}>{o}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Transcript</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="h-8 w-48 text-xs"
                  placeholder="Search transcript…"
                  value={transcriptQuery}
                  onChange={(e) => setTranscriptQuery(e.target.value)}
                />
                <Button type="button" size="sm" variant="outline" onClick={() => void copyTranscript()}>
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={downloadTranscript}>
                  Download
                </Button>
              </div>
            </div>
            {filteredSegments.length > 0 ? (
              <div className="mt-3 max-h-[28rem] space-y-3 overflow-auto pr-1">
                {filteredSegments.map((seg) => (
                  <div
                    key={seg.id}
                    className={cn(
                      "flex",
                      isAgent(seg.speaker) ? "justify-start" : "justify-end",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        isAgent(seg.speaker) ? "bg-muted" : "bg-primary/10",
                      )}
                    >
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {fmtMs(seg.startMs) || "—"} · {speakerLabel(seg.speaker)}
                      </p>
                      <p className="leading-relaxed">{seg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : fullText ? (
              <p className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-sm leading-relaxed">
                {fullText}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No transcript available for this call.
              </p>
            )}
          </Card>

          {(toolExecutions.length > 0 || transfers.length > 0) && (
            <Card className="p-5 lg:col-span-2">
              <CardTitle>Tools &amp; actions</CardTitle>
              <div className="mt-3 space-y-2">
                {toolExecutions.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {String(t.toolType || "tool").replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.status || "—"}
                        {t.latencyMs != null ? ` · ${t.latencyMs} ms` : ""}
                        {t.createdAt
                          ? ` · ${new Date(t.createdAt).toLocaleTimeString()}`
                          : ""}
                      </p>
                    </div>
                    {t.error ? (
                      <span className="text-xs text-rose-600">{String(t.error)}</span>
                    ) : null}
                  </div>
                ))}
                {transfers.map((t) => (
                  <div
                    key={t.id}
                    className="rounded border border-border px-3 py-2 text-sm"
                  >
                    Transfer {t.transferType || ""} → {t.destination || "—"} ·{" "}
                    {t.status || "—"}
                    {t.summary ? (
                      <p className="mt-1 text-xs text-muted-foreground">{t.summary}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {call.contactId ? (
            <Card className="space-y-2 p-5 lg:col-span-2">
              <CardTitle>CRM &amp; calendar</CardTitle>
              <p className="text-sm text-muted-foreground">
                Connected Salesforce / Zoho / Pipedrive / Calendly context for this
                caller.
              </p>
              <ConnectedRecordsPanel contactId={String(call.contactId)} />
              <Link
                href={`/contacts/${String(call.contactId)}`}
                className="inline-block text-sm underline"
              >
                Open contact
              </Link>
            </Card>
          ) : null}

          <Card className="p-5 lg:col-span-2">
            <CardTitle>Timeline</CardTitle>
            {events.length > 0 ? (
              <ol className="mt-3 space-y-0">
                {events.map((e, idx) => (
                  <li key={e.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                      {idx < events.length - 1 ? (
                        <span className="w-px flex-1 bg-border" />
                      ) : null}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium">
                        {e.eventType.replace(/[._]/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No events recorded.</p>
            )}
          </Card>
        </div>
      )}
      <p className="mt-6 text-sm">
        <Link href="/voice/calls" className="underline">
          ← All calls
        </Link>
      </p>
    </div>
  );
}
