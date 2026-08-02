"use client";

import { ConnectedRecordsPanel } from "@/components/contacts/connected-records-panel";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { RecordingPlayer } from "@/components/voice/recording-player";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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
};
type CallEvent = { id: string; eventType: string; createdAt: string };

function fmtMs(ms?: number | null) {
  if (ms == null) return "";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function speakerLabel(speaker: string) {
  const s = speaker.toLowerCase();
  if (s.includes("agent") || s.includes("assistant") || s.includes("ai") || s === "a") return "Agent";
  if (s.includes("customer") || s.includes("caller") || s.includes("user") || s === "b") return "Caller";
  return speaker;
}

function isAgent(speaker: string) {
  return speakerLabel(speaker) === "Agent";
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

  const segments: Segment[] = transcripts.flatMap((t) => t.segments || []);
  const fullText = transcripts.map((t) => t.fullText).filter(Boolean).join("\n\n");
  const insight = insights[0];

  return (
    <div>
      <PageHeader title="Call detail" description="Timeline, transcript, insights, transfers, and costs." />
      <VoiceSubNav />
      {!call ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-2 p-5">
            <CardTitle>Summary</CardTitle>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <StatusChip status={String(call.status)} />
              {call.outcome ? <StatusChip status={String(call.outcome)} /> : null}
            </div>
            <p className="text-sm"><strong>From:</strong> {String(call.fromE164)}</p>
            <p className="text-sm"><strong>To:</strong> {String(call.toE164)}</p>
            <p className="text-sm"><strong>Direction:</strong> {String(call.direction)}</p>
            {call.durationSeconds != null ? (
              <p className="text-sm"><strong>Duration:</strong> {fmtMs(Number(call.durationSeconds) * 1000)}</p>
            ) : null}
            <p className="text-sm"><strong>Cost:</strong> ${((Number(call.costCents) || 0) / 100).toFixed(2)}</p>
            {call.leadScore != null ? (
              <p className="text-sm"><strong>Lead score:</strong> {String(call.leadScore)}</p>
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
              <p className="mt-2 text-sm text-muted-foreground">No recording for this call.</p>
            )}
          </Card>

          <Card className="p-5">
            <CardTitle>Insights</CardTitle>
            {!insight ? (
              <p className="mt-2 text-sm text-muted-foreground">No insights generated yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {insight.summary ? (
                  <p className="text-sm leading-relaxed">{insight.summary}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {insight.intent ? (
                    <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800">
                      {insight.intent.replace(/_/g, " ")}
                    </span>
                  ) : null}
                  {insight.sentiment ? (
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", sentimentTone[insight.sentiment] || "bg-muted text-muted-foreground")}>
                      {insight.sentiment}
                    </span>
                  ) : null}
                  {insight.isLead ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                      Qualified lead{insight.leadScore != null ? ` · ${insight.leadScore}` : ""}
                    </span>
                  ) : null}
                  {insight.needsReview ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      Needs review
                    </span>
                  ) : null}
                </div>

                {insight.qualification && Object.keys(insight.qualification).length > 0 ? (
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {Object.entries(insight.qualification).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-1.5 text-xs">
                        <span className={cn("h-2 w-2 rounded-full", v ? "bg-emerald-500" : "bg-slate-300")} />
                        <span className="text-muted-foreground">{k.replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {insight.topics && insight.topics.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Topics</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {insight.topics.map((t) => (
                        <span key={t} className="rounded bg-muted px-2 py-0.5 text-xs">{t}</span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {insight.objections && insight.objections.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Objections</p>
                    <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                      {insight.objections.map((o, i) => <li key={i}>{o}</li>)}
                    </ul>
                  </div>
                ) : null}

                {insight.actionItems && insight.actionItems.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Action items</p>
                    <ul className="mt-1 list-disc pl-4 text-xs">
                      {insight.actionItems.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <CardTitle>Transcript</CardTitle>
            {segments.length > 0 ? (
              <div className="mt-3 max-h-96 space-y-3 overflow-auto pr-1">
                {segments.map((seg) => (
                  <div key={seg.id} className={cn("flex", isAgent(seg.speaker) ? "justify-start" : "justify-end")}>
                    <div className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                      isAgent(seg.speaker) ? "bg-muted" : "bg-primary/10",
                    )}>
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {speakerLabel(seg.speaker)}{seg.startMs != null ? ` · ${fmtMs(seg.startMs)}` : ""}
                      </p>
                      <p className="leading-relaxed">{seg.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : fullText ? (
              <p className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-sm leading-relaxed">{fullText}</p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No transcript available for this call.</p>
            )}
          </Card>

          {call.contactId ? (
            <Card className="space-y-2 p-5 lg:col-span-2">
              <CardTitle>CRM &amp; calendar</CardTitle>
              <p className="text-sm text-muted-foreground">
                Connected Salesforce / Zoho / Pipedrive / Calendly context for this caller.
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
            <CardTitle>Event timeline</CardTitle>
            {events.length > 0 ? (
              <ol className="mt-3 space-y-0">
                {events.map((e, idx) => (
                  <li key={e.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                      {idx < events.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium">{e.eventType.replace(/[._]/g, " ")}</p>
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
        <Link href="/voice/calls" className="underline">← All calls</Link>
      </p>
    </div>
  );
}
