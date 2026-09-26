"use client";

import { CallAttentionBadge } from "@/components/calls/call-attention-badge";
import { CallOutcomeBadge } from "@/components/calls/call-outcome-badge";
import { WaveformRecordingPlayer } from "@/components/calls/waveform-recording-player";
import {
  buildActionItems,
  buildCapturedFields,
} from "@/lib/voice/calls/detail";
import {
  buildCustomerActivityFeed,
  formatCallCostCents,
  formatTelephonyProviderLabel,
  recordingPipelineState,
  summaryPipelineState,
  transcriptPipelineState,
} from "@/lib/voice/calls/customer-activity-feed";
import { fmtCallDuration, fmtCallPhone } from "@/lib/voice/calls/display";
import {
  deriveCallDetailMaterialOutcomes,
  deriveCallListOutcomeDisplay,
} from "@/lib/voice/calls/outcome-display";
import {
  getMockCallById,
  isDemoCallId,
  MOCK_ACTIVITY_EVENTS,
  MOCK_TRANSCRIPT_SEGMENTS,
} from "@/lib/voice/calls/mock-data";
import { cn } from "@/lib/utils";
import { Bot, ChevronRight, User } from "lucide-react";
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

type CallInsight = {
  summary?: string | null;
  intent?: string | null;
  sentiment?: string | null;
};

function fmtSegmentTime(ms?: number | null) {
  if (ms == null) return "0:00";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function speakerLabel(speaker: string, agentName: string, callerName: string) {
  const s = speaker.toLowerCase();
  if (s.includes("agent") || s.includes("assistant") || s.includes("ai")) return agentName;
  return callerName;
}

function isAgent(speaker: string) {
  const s = speaker.toLowerCase();
  return s.includes("agent") || s.includes("assistant") || s.includes("ai");
}

export default function VoiceCallsDetailLegacyPage() {
  const params = useParams();
  const id = String(params.id || "");
  const [tab, setTab] = useState<"overview" | "transcript">("overview");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [showTranscriptDetails, setShowTranscriptDetails] = useState(true);
  const [showTechnical, setShowTechnical] = useState(false);
  const demo = isDemoCallId(id);
  const mock = demo ? getMockCallById(id) : undefined;

  useEffect(() => {
    if (!id || demo) {
      setApiLoaded(true);
      return;
    }
    setApiLoaded(false);
    fetch(`/api/voice/calls/${id}`)
      .then((r) => r.json())
      .then((j) => setData(j.data ?? null))
      .catch(() => setData(null))
      .finally(() => setApiLoaded(true));
  }, [id, demo]);

  const call = demo && mock
    ? {
        id: mock.id,
        direction: mock.direction,
        status: mock.status,
        fromE164: mock.fromE164,
        toE164: mock.toE164,
        startedAt: mock.startedAt,
        durationSeconds: mock.durationSeconds,
        contactName: mock.contactName,
        contactEmail: mock.contactEmail,
        agentName: mock.agentName,
        summary: mock.summary,
        intent: mock.intent,
        sentiment: mock.sentiment,
      }
    : (data?.call as Record<string, unknown> | undefined);

  const recordings = demo
    ? []
    : ((data?.recordings as Array<{ id: string; status?: string | null; provider?: string | null; createdAt?: string }>) ||
        []);
  const rawEvents =
    (data?.events as Array<{ id: string; eventType: string; createdAt: string; payload?: unknown }>) || [];
  const rawTranscripts =
    (data?.transcripts as Array<{ status?: string | null; segments?: Segment[] }>) || [];
  const segments: Segment[] = demo
    ? MOCK_TRANSCRIPT_SEGMENTS
    : rawTranscripts.flatMap((t) => t.segments || []);
  const insight: CallInsight | undefined = demo && mock
    ? { summary: mock.summary, intent: mock.intent, sentiment: mock.sentiment }
    : ((data?.insights as CallInsight[]) || [])[0];

  if (demo && !mock) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
        <p className="text-sm text-[#6b7280]">Call not found.</p>
        <Link href="/voice/calls" className="mt-2 text-sm text-[#6366f1] hover:underline">
          Back to calls
        </Link>
      </div>
    );
  }

  if (!call) {
    if (!apiLoaded) {
      return (
        <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
          <p className="text-sm text-[#6b7280]">Loading call…</p>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
        <p className="text-sm text-[#6b7280]">Call not found.</p>
        <Link href="/voice/calls" className="mt-2 text-sm text-[#6366f1] hover:underline">
          Back to calls
        </Link>
      </div>
    );
  }

  const callerPhone =
    String(call.direction) === "INBOUND" ? String(call.fromE164) : String(call.toE164);
  const callerName = String(call.contactName || "Unknown Caller");
  const agentName = String(call.agentName || "Amy");
  const started = new Date(String(call.startedAt));
  const dateLabel = started.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeLabel = started.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const mockCall = demo ? mock : undefined;
  const callbackRequest = data?.callbackRequest as
    | { id: string; status: string; reason?: string | null; requestedAt: string }
    | null
    | undefined;
  const structuredMessage = call.structuredMessage;
  const insightCustom =
    (data?.insights as Array<{ customFields?: Record<string, unknown> }>)?.[0]?.customFields ??
    null;
  const infoFields = buildCapturedFields({
    contactName: call.contactName as string | null,
    contactEmail: (call.contactEmail as string | null) ?? mockCall?.contactEmail,
    fromE164: callerPhone,
    structuredMessage,
    insightCustomFields: insightCustom,
    insightSummary: insight?.summary,
  });
  const callHistoryMeta = (() => {
    const meta = (call.metadata as Record<string, unknown> | undefined) ?? {};
    const ch = meta.callHistory;
    return ch && typeof ch === "object" && !Array.isArray(ch)
      ? (ch as Record<string, unknown>)
      : null;
  })();

  const actionItems = buildActionItems({
    call: {
      appointmentBooked: Boolean(call.appointmentBooked),
      transferred: Boolean(call.transferred),
      outcome: call.outcome as string | null,
      endedAt: call.endedAt as string | null,
    },
    structuredMessage,
    toolExecutions:
      (data?.toolExecutions as Array<{
        toolType?: string | null;
        status?: string | null;
        createdAt?: string;
        error?: string | null;
      }>) || [],
    transfers: (data?.transfers as Array<{ status?: string; destination?: string; summary?: string; createdAt?: string }>) || [],
  });

  const activityFeed = buildCustomerActivityFeed({
    call: {
      startedAt: String(call.startedAt),
      answeredAt: call.answeredAt as string | null | undefined,
      endedAt: call.endedAt as string | null | undefined,
      appointmentBooked: Boolean(call.appointmentBooked),
      transferred: Boolean(call.transferred),
    },
    events: demo ? undefined : rawEvents,
    toolExecutions: demo
      ? undefined
      : (data?.toolExecutions as Array<{
          id: string;
          status?: string | null;
          createdAt?: string;
          completedAt?: string | null;
          errorMessage?: string | null;
          toolType?: string | null;
          input?: unknown;
          output?: unknown;
        }>) || [],
    transfers: demo
      ? undefined
      : (data?.transfers as Array<{
          id: string;
          status?: string | null;
          destination?: string | null;
          createdAt?: string;
          completedAt?: string | null;
        }>) || [],
    recordings: demo ? undefined : recordings,
    callbackRequest: demo ? null : callbackRequest,
    demoItems: demo
      ? MOCK_ACTIVITY_EVENTS.map((e, i) => ({
          id: e.id,
          label: e.label,
          at: e.at,
          sortMs: i,
        }))
      : undefined,
  });

  const costLabel = demo ? null : formatCallCostCents(call.costCents as number | undefined);
  const providerLabel = demo
    ? null
    : formatTelephonyProviderLabel(recordings[0]?.provider ?? null);

  const recordingState = recordingPipelineState({
    recordings,
    callHistoryRecordingStatus: callHistoryMeta?.recordingStatus as string | null | undefined,
  });
  const transcriptState = transcriptPipelineState({
    segmentsCount: segments.length,
    transcripts: rawTranscripts,
  });
  const summaryState = summaryPipelineState({
    summary: insight?.summary,
    insights: (data?.insights as Array<{ status?: string | null }>) || [],
    callEnded: Boolean(call.endedAt),
  });

  const contactEmailDisplay =
    (call.contactEmail as string | null | undefined)?.trim() ||
    (demo ? mockCall?.contactEmail : null);

  const knowledgeGaps =
    (data?.knowledgeGaps as Array<{
      id: string;
      displayQuestion: string;
      status: string;
      timesAsked?: number;
    }>) || [];

  const transfersForOutcome =
    (data?.transfers as Array<{ status?: string }>) || [];
  const outcomeInput = {
    outcome: call.outcome as string | null,
    appointmentBooked: Boolean(call.appointmentBooked),
    transferred: Boolean(call.transferred),
    voicemailDetected: Boolean(call.voicemailDetected),
    transfers: transfersForOutcome,
    hasKnowledgeGap: knowledgeGaps.length > 0,
  };
  const listOutcome = deriveCallListOutcomeDisplay(outcomeInput);
  const materialOutcomes = deriveCallDetailMaterialOutcomes(outcomeInput);
  const contactId = call.contactId as string | null | undefined;
  const executionTrace = call.executionTrace as unknown;
  const toolExecutions =
    (data?.toolExecutions as Array<{
      toolType?: string | null;
      status?: string | null;
      errorMessage?: string | null;
    }>) || [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-[#6b7280]">
        <Link href="/voice/overview" className="hover:text-[#374151]">Overview</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/voice/calls" className="hover:text-[#374151]">Calls</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-[#374151]">Call from {callerName}</span>
      </nav>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-tight text-[#111827]">
            {callerName}
          </h1>
          <p className="mt-1 text-sm text-[#6b7280]">{fmtCallPhone(callerPhone)}</p>
          <p className="mt-2 text-sm text-[#6b7280]">
            {dateLabel} at {timeLabel}
            {" · "}
            {fmtCallDuration(call.durationSeconds as number)}
            {" · "}
            {String(call.status)}
          </p>
          {contactId ? (
            <p className="mt-2 text-sm">
              <Link href={`/contacts/${contactId}`} className="font-medium text-[#6366f1] hover:underline">
                View contact
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      <div className="mb-6 flex gap-6 border-b border-[#e5e7eb]">
        {(["overview", "transcript"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "pb-3 text-sm font-medium capitalize",
              tab === t
                ? "border-b-2 border-[#6366f1] text-[#6366f1]"
                : "text-[#6b7280] hover:text-[#374151]",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
        <div className="min-w-0 space-y-6">
          {tab === "overview" ? (
            <>
              <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-[#111827]">What happened</h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {materialOutcomes.map((o) => (
                    <CallOutcomeBadge key={o} outcome={o} />
                  ))}
                  {listOutcome.attention ? (
                    <CallAttentionBadge label={listOutcome.attention} />
                  ) : null}
                </div>
                <ul className="mt-4 space-y-2 text-sm text-[#374151]">
                  {actionItems
                    .filter((item) => item.status !== "skipped")
                    .map((item) => (
                      <li key={item.id}>
                        <span className="font-medium">{item.label}</span>
                        {item.detail ? ` — ${item.detail}` : ""}
                      </li>
                    ))}
                </ul>
              </div>

              {callbackRequest ? (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-[#111827]">Still needs follow-up</h2>
                  <p className="mt-2 text-sm text-[#374151]">
                    Callback requested
                    {callbackRequest.reason ? ` — ${callbackRequest.reason}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-[#6b7280]">
                    Status: {callbackRequest.status} ·{" "}
                    {new Date(callbackRequest.requestedAt).toLocaleString()}
                  </p>
                  <Link
                    href="/voice/calls?attention=open"
                    className="mt-3 inline-block text-sm font-medium text-[#6366f1] hover:underline"
                  >
                    Open needs attention queue
                  </Link>
                </div>
              ) : null}

              <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-[#111827]">Summary</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#374151]">
                  {summaryState === "ready"
                    ? insight?.summary || mockCall?.summary
                    : summaryState === "processing"
                      ? "Summary is being generated…"
                      : insight?.intent
                        ? String(insight.intent)
                        : "No summary available for this call."}
                </p>
              </div>

              <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-[#111827]">Information collected</h2>
                <dl className="mt-4 divide-y divide-[#f3f4f6]">
                  {infoFields.map((f) => (
                    <div key={f.label} className="flex justify-between gap-4 py-3 text-sm">
                      <dt className="text-[#6b7280]">{f.label}</dt>
                      <dd className="text-right font-medium text-[#111827]">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {knowledgeGaps.length > 0 ? (
                <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-[#111827]">Knowledge gaps</h2>
                    <Link
                      href="/voice/knowledge#knowledge-gaps"
                      className="text-sm font-medium text-[#6366f1] hover:underline"
                    >
                      Manage gaps
                    </Link>
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-[#374151]">
                    {knowledgeGaps.map((g) => (
                      <li key={g.id}>
                        <span className="font-medium">{g.displayQuestion}</span>
                        <span className="mt-0.5 block text-xs text-[#6b7280]">
                          Status: {g.status.replace(/_/g, " ")}
                          {g.timesAsked != null ? ` · Asked ${g.timesAsked} time(s)` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {recordings[0]?.id && recordingState === "ready" ? (
                <WaveformRecordingPlayer recordingId={recordings[0].id} />
              ) : (
                <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-[#111827]">Recording</h2>
                  <p className="mt-2 text-sm text-[#374151]">
                    {recordingState === "processing"
                      ? "Recording is being processed…"
                      : "Recording unavailable for this call."}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[#111827]">Transcript</h2>
                  <label className="flex items-center gap-2 text-xs text-[#6b7280]">
                    <input
                      type="checkbox"
                      checked={showTranscriptDetails}
                      onChange={(e) => setShowTranscriptDetails(e.target.checked)}
                      className="rounded border-[#d1d5db] text-[#6366f1]"
                    />
                    Show details
                  </label>
                </div>
                <div className="mt-4 space-y-4">
                  {transcriptState === "processing" && segments.length === 0 ? (
                    <p className="text-sm text-[#6b7280]">Transcript is being processed…</p>
                  ) : null}
                  {transcriptState === "unavailable" && segments.length === 0 ? (
                    <p className="text-sm text-[#6b7280]">Transcript unavailable for this call.</p>
                  ) : null}
                  {segments.slice(0, 4).map((seg) => (
                    <div key={seg.id} className="flex gap-3">
                      {showTranscriptDetails ? (
                        <span className="w-10 shrink-0 text-xs tabular-nums text-[#9ca3af]">
                          {fmtSegmentTime(seg.startMs)}
                        </span>
                      ) : null}
                      <div>
                        <p className="text-xs font-semibold text-[#6b7280]">
                          {speakerLabel(seg.speaker, agentName, callerName)}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-[#374151]">{seg.text}</p>
                      </div>
                    </div>
                  ))}
                  {segments.length > 4 ? (
                    <button
                      type="button"
                      className="text-sm font-medium text-[#6366f1] hover:underline"
                      onClick={() => setTab("transcript")}
                    >
                      See full transcript
                    </button>
                  ) : null}
                </div>
              </div>

              {(executionTrace || toolExecutions.some((t) => t.status === "failed")) ? (
                <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-left text-sm font-semibold text-[#111827]"
                    onClick={() => setShowTechnical((v) => !v)}
                    aria-expanded={showTechnical}
                  >
                    Technical details
                    <span className="text-xs font-normal text-[#6b7280]">
                      {showTechnical ? "Hide" : "Show"}
                    </span>
                  </button>
                  {showTechnical ? (
                    <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-[#f9fafb] p-3 text-xs text-[#374151]">
                      {JSON.stringify(
                        { executionTrace, toolExecutions },
                        null,
                        2,
                      )}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
              <div className="max-h-[32rem] space-y-4 overflow-auto">
                {segments.map((seg) => {
                  const agent = isAgent(seg.speaker);
                  return (
                    <div key={seg.id} className="flex gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          agent ? "bg-[#eef2ff] text-[#6366f1]" : "bg-[#f3f4f6] text-[#6b7280]",
                        )}
                      >
                        {agent ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[#6b7280]">
                          {fmtSegmentTime(seg.startMs)} ·{" "}
                          {speakerLabel(seg.speaker, agentName, callerName)}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-[#374151]">{seg.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#111827]">Call Data</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-[#6b7280]">Status</dt>
                <dd className="font-medium text-[#111827]">{String(call.status)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#6b7280]">Date</dt>
                <dd className="font-medium text-[#111827]">
                  {started.toLocaleDateString(undefined, { month: "2-digit", day: "2-digit", year: "numeric" })}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#6b7280]">Direction</dt>
                <dd className="font-medium text-[#111827]">{String(call.direction)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#6b7280]">Length</dt>
                <dd className="font-medium text-[#111827]">
                  {fmtCallDuration(call.durationSeconds as number)}
                </dd>
              </div>
              {costLabel ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-[#6b7280]">Cost</dt>
                  <dd className="font-medium text-[#111827]">{costLabel}</dd>
                </div>
              ) : null}
              {providerLabel ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-[#6b7280]">Provider</dt>
                  <dd className="font-medium text-[#111827]">{providerLabel}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-[#6b7280]">To</dt>
                <dd className="font-medium text-[#111827]">{fmtCallPhone(String(call.toE164))}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#6b7280]">From</dt>
                <dd className="font-medium text-[#111827]">{fmtCallPhone(String(call.fromE164))}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#111827]">Activity Feed</h2>
            {activityFeed.length === 0 ? (
              <p className="mt-4 text-sm text-[#6b7280]">No activity recorded for this call yet.</p>
            ) : (
              <ol className="mt-4 space-y-0">
                {activityFeed.map((e, idx, arr) => (
                  <li key={e.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-[#6366f1]" />
                      {idx < arr.length - 1 ? <span className="w-px flex-1 bg-[#e5e7eb]" /> : null}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-[#111827]">{e.label}</p>
                      <p className="text-xs text-[#6b7280]">{e.at}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              {mockCall?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mockCall.avatarUrl}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover ring-1 ring-[#e5e7eb]"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef2ff] text-sm font-semibold text-[#6366f1]">
                  {callerName.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#111827]">{callerName}</p>
                <p className="text-xs text-[#6b7280]">{fmtCallPhone(callerPhone)}</p>
                {contactEmailDisplay ? (
                  <p className="truncate text-xs text-[#6b7280]">{contactEmailDisplay}</p>
                ) : null}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
