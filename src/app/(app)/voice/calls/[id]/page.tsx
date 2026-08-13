"use client";

import { CallFeedbackPanel } from "@/components/calls/call-feedback-panel";
import { CallOutcomeBadge } from "@/components/calls/call-outcome-badge";
import {
  WaveformRecordingPlayer,
  type WaveformPlayerHandle,
} from "@/components/calls/waveform-recording-player";
import {
  buildActionItems,
  buildCapturedFields,
  deriveOutcomeBadges,
  fmtSentimentLabel,
  fmtUrgency,
} from "@/lib/voice/calls/detail";
import {
  deriveCallOutcomeBadge,
  fmtCallDateTime,
  fmtCallDuration,
  fmtCallPhone,
} from "@/lib/voice/calls/display";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronLeft,
  MessageSquare,
  Minus,
  MoreHorizontal,
  Phone,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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
  segments?: Segment[];
};

type Insight = {
  summary?: string | null;
  intent?: string | null;
  sentiment?: string | null;
  isLead?: boolean | null;
  leadScore?: number | null;
  customFields?: Record<string, unknown> | null;
};

type ToolExecution = {
  id: string;
  toolType?: string | null;
  status?: string | null;
  createdAt?: string;
  error?: string | null;
};

type Transfer = {
  id: string;
  destination?: string | null;
  status?: string | null;
  summary?: string | null;
  createdAt?: string;
};

function fmtSegmentTime(ms?: number | null) {
  if (ms == null) return "";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function speakerDisplay(speaker: string, agentName?: string | null, callerName?: string | null) {
  const s = speaker.toLowerCase();
  if (s.includes("agent") || s.includes("assistant") || s.includes("ai") || s === "a") {
    return agentName || "Amy";
  }
  if (s.includes("customer") || s.includes("caller") || s.includes("user") || s === "b") {
    return callerName || "Caller";
  }
  return speaker;
}

function isAgentSpeaker(speaker: string) {
  const s = speaker.toLowerCase();
  return s.includes("agent") || s.includes("assistant") || s.includes("ai") || s === "a";
}

export default function VoiceCallDetailPage() {
  const params = useParams();
  const id = String(params.id || "");
  const playerRef = useRef<WaveformPlayerHandle | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [activeSegmentMs, setActiveSegmentMs] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/voice/calls/${id}`)
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .catch(() => undefined);
  }, [id]);

  const call = data?.call as Record<string, unknown> | undefined;
  const recordings = (data?.recordings as Array<{ id: string }>) || [];
  const transcripts = (data?.transcripts as Transcript[]) || [];
  const insights = (data?.insights as Insight[]) || [];
  const transfers = (data?.transfers as Transfer[]) || [];
  const toolExecutions = (data?.toolExecutions as ToolExecution[]) || [];

  const insight = insights[0];
  const segments = transcripts.flatMap((t) => t.segments || []);
  const fullText = transcripts.map((t) => t.fullText).filter(Boolean).join("\n\n");

  const callerPhone = call
    ? String(call.direction === "INBOUND" ? call.fromE164 : call.toE164)
    : "";
  const callerName = (call?.contactName as string | null) || "Unknown Caller";
  const agentName = (call?.agentName as string | null) || "Amy";
  const structuredMessage = call?.structuredMessage;
  const callFeedback = call?.callFeedback as
    | { rating?: "good" | "needs_improvement"; reason?: string }
    | undefined;

  const outcomeBadges = useMemo(() => {
    if (!call) return [];
    return deriveOutcomeBadges({
      outcome: call.outcome as string | null,
      appointmentBooked: Boolean(call.appointmentBooked),
      transferred: Boolean(call.transferred),
      voicemailDetected: Boolean(call.voicemailDetected),
      isLead: insight?.isLead,
      leadScore: (call.leadScore as number | null) ?? insight?.leadScore,
      status: String(call.status),
    });
  }, [call, insight]);

  const capturedFields = useMemo(() => {
    if (!call) return [];
    return buildCapturedFields({
      contactName: call.contactName as string | null,
      contactEmail: call.contactEmail as string | null,
      fromE164: callerPhone,
      structuredMessage,
      insightCustomFields: insight?.customFields,
      insightSummary: insight?.summary,
    });
  }, [call, callerPhone, structuredMessage, insight]);

  const actions = useMemo(() => {
    if (!call) return [];
    return buildActionItems({
      call: {
        appointmentBooked: Boolean(call.appointmentBooked),
        transferred: Boolean(call.transferred),
        outcome: call.outcome as string | null,
        endedAt: call.endedAt as string | null,
      },
      structuredMessage,
      toolExecutions,
      transfers,
    });
  }, [call, structuredMessage, toolExecutions, transfers]);

  const dt = call ? fmtCallDateTime(String(call.startedAt)) : null;
  const primaryOutcome = call
    ? deriveCallOutcomeBadge({
        outcome: call.outcome as string | null,
        appointmentBooked: Boolean(call.appointmentBooked),
        transferred: Boolean(call.transferred),
        isLead: insight?.isLead,
        leadScore: (call.leadScore as number | null) ?? insight?.leadScore,
        status: String(call.status),
      })
    : null;

  async function copyTranscript() {
    const text =
      segments.length > 0
        ? segments
            .map(
              (s) =>
                `${fmtSegmentTime(s.startMs)} ${speakerDisplay(s.speaker, agentName, callerName)}\n${s.text}`,
            )
            .join("\n\n")
        : fullText;
    if (!text) return;
    await navigator.clipboard.writeText(text).catch(() => undefined);
  }

  if (!call) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <p className="text-sm text-[#6b7280]">Loading call…</p>
      </div>
    );
  }

  const recordingId = recordings[0]?.id;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link
        href="/voice/calls"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[#6b7280] hover:text-[#374151]"
      >
        <ChevronLeft className="h-4 w-4" />
        All calls
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[#111827]">
              Call from {callerName === "Unknown Caller" ? fmtCallPhone(callerPhone) : callerName}
            </h1>
            {primaryOutcome ? <CallOutcomeBadge outcome={primaryOutcome} /> : null}
          </div>
          <p className="mt-2 text-sm text-[#6b7280]">
            {capturedFields.find((f) => f.label === "Service Address")?.value !== "—"
              ? `${capturedFields.find((f) => f.label === "Service Address")?.value} · `
              : ""}
            {callerName !== "Unknown Caller" ? `${callerName} · ` : ""}
            {fmtCallPhone(callerPhone)}
          </p>
          <p className="mt-1 text-sm text-[#6b7280]">
            {dt?.primary} at {dt?.secondary} · {fmtCallDuration(call.durationSeconds as number)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {outcomeBadges.map((b) => (
              <CallOutcomeBadge key={b} outcome={b} />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`tel:${callerPhone}`}
            className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#374151] shadow-sm hover:bg-[#f9fafb]"
          >
            <Phone className="h-4 w-4" />
            Call Back
          </a>
          <Link
            href={`/send/quick?to=${encodeURIComponent(callerPhone)}`}
            className="inline-flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#374151] shadow-sm hover:bg-[#f9fafb]"
          >
            <MessageSquare className="h-4 w-4" />
            Text Caller
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white shadow-sm"
            >
              <MoreHorizontal className="h-4 w-4 text-[#6b7280]" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-[#e5e7eb] bg-white py-1 shadow-lg">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-[#374151] hover:bg-[#f9fafb]"
                  onClick={() => void copyTranscript()}
                >
                  Copy transcript
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
        <div className="min-w-0 space-y-6">
          {recordingId ? (
            <WaveformRecordingPlayer
              ref={playerRef}
              recordingId={recordingId}
              onTimeUpdate={(ms) => setActiveSegmentMs(ms)}
            />
          ) : (
            <div className="rounded-xl border border-[#e5e7eb] bg-white p-6 text-sm text-[#6b7280] shadow-sm">
              No recording available for this call.
            </div>
          )}

          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#6366f1]" />
              <h2 className="text-sm font-semibold text-[#111827]">AI Summary</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#374151]">
              {insight?.summary ||
                "No AI summary yet. It will appear here after post-call processing."}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-[#6366f1]" />
                <h2 className="text-sm font-semibold text-[#111827]">Captured Information</h2>
              </div>
              <dl className="mt-4 space-y-3">
                {capturedFields.map((field) => (
                  <div key={field.label}>
                    <dt className="text-xs font-medium text-[#9ca3af]">{field.label}</dt>
                    <dd className="mt-0.5 text-sm text-[#111827]">{field.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#6366f1]" />
                <h2 className="text-sm font-semibold text-[#111827]">Actions Taken</h2>
              </div>
              <ul className="mt-4 space-y-3">
                {actions.map((action) => (
                  <li key={action.id} className="flex items-start gap-2 text-sm">
                    {action.status === "done" ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : action.status === "failed" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    ) : (
                      <Minus className="mt-0.5 h-4 w-4 shrink-0 text-[#9ca3af]" />
                    )}
                    <div>
                      <p
                        className={cn(
                          action.status === "skipped" ? "text-[#9ca3af]" : "text-[#111827]",
                        )}
                      >
                        {action.label}
                      </p>
                      {action.detail ? (
                        <p className="text-xs text-[#6b7280]">{action.detail}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#6366f1]" />
                <h2 className="text-sm font-semibold text-[#111827]">Transcript</h2>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#6b7280]">
                <input
                  type="checkbox"
                  checked={showTimestamps}
                  onChange={(e) => setShowTimestamps(e.target.checked)}
                  className="rounded border-[#d1d5db] text-[#6366f1]"
                />
                Show timestamps
              </label>
            </div>

            {segments.length > 0 ? (
              <div className="mt-4 max-h-[32rem] space-y-4 overflow-auto pr-1">
                {segments.map((seg) => {
                  const agent = isAgentSpeaker(seg.speaker);
                  const isActive =
                    activeSegmentMs != null &&
                    seg.startMs != null &&
                    seg.endMs != null &&
                    activeSegmentMs >= seg.startMs &&
                    activeSegmentMs <= seg.endMs;
                  return (
                    <div
                      key={seg.id}
                      className={cn(
                        "flex gap-3 rounded-lg p-2 transition",
                        isActive ? "bg-[#eef2ff]" : "",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          agent ? "bg-[#eef2ff] text-[#6366f1]" : "bg-[#f3f4f6] text-[#6b7280]",
                        )}
                      >
                        {agent ? (
                          <Bot className="h-4 w-4" />
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-[#6b7280]">
                          {showTimestamps && seg.startMs != null ? (
                            <button
                              type="button"
                              className="mr-2 tabular-nums text-[#6366f1] hover:underline"
                              onClick={() => playerRef.current?.seekToMs(seg.startMs!)}
                            >
                              {fmtSegmentTime(seg.startMs)}
                            </button>
                          ) : null}
                          {speakerDisplay(seg.speaker, agentName, callerName)}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-[#374151]">{seg.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : fullText ? (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[#374151]">
                {fullText}
              </p>
            ) : (
              <p className="mt-4 text-sm text-[#6b7280]">No transcript available.</p>
            )}
          </div>

          <CallFeedbackPanel
            callId={id}
            initialRating={callFeedback?.rating}
            initialReason={callFeedback?.reason}
          />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#111827]">Call Details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-[#9ca3af]">Outcome</dt>
                <dd className="mt-0.5 text-[#111827]">{primaryOutcome || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#9ca3af]">Intent</dt>
                <dd className="mt-0.5 text-[#111827]">
                  {insight?.intent?.replace(/_/g, " ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#9ca3af]">Sentiment</dt>
                <dd className="mt-0.5 text-[#111827]">
                  {fmtSentimentLabel(insight?.sentiment)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#9ca3af]">Urgency</dt>
                <dd className="mt-0.5 text-[#111827]">
                  {fmtUrgency({
                    structuredMessage,
                    insightCustomFields: insight?.customFields,
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#9ca3af]">Answered by</dt>
                <dd className="mt-0.5 text-[#111827]">{agentName}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#9ca3af]">Number called</dt>
                <dd className="mt-0.5 text-[#111827]">
                  {fmtCallPhone(String(call.toE164))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#9ca3af]">Duration</dt>
                <dd className="mt-0.5 text-[#111827]">
                  {fmtCallDuration(call.durationSeconds as number)}
                </dd>
              </div>
            </dl>
          </div>

          {insight?.intent || primaryOutcome ? (
            <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-[#111827]">Tags</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {primaryOutcome ? (
                  <span className="rounded-full bg-[#eef2ff] px-2.5 py-0.5 text-xs font-medium text-[#4f46e5]">
                    {primaryOutcome}
                  </span>
                ) : null}
                {insight?.intent ? (
                  <span className="rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-xs font-medium text-[#374151]">
                    {insight.intent.replace(/_/g, " ")}
                  </span>
                ) : null}
                {capturedFields
                  .filter((f) => f.label === "Service Address" && f.value !== "—")
                  .map((f) => (
                    <span
                      key={f.value}
                      className="rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-xs font-medium text-[#374151]"
                    >
                      {f.value.split(",")[0]}
                    </span>
                  ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
