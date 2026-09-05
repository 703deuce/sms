"use client";

import { WaveformRecordingPlayer } from "@/components/calls/waveform-recording-player";
import { fmtCallDuration, fmtCallPhone } from "@/lib/voice/calls/display";
import {
  getMockCallById,
  isDemoCallId,
  MOCK_ACTIVITY_EVENTS,
  MOCK_TRANSCRIPT_SEGMENTS,
} from "@/lib/voice/calls/mock-data";
import { cn } from "@/lib/utils";
import {
  Bot,
  ChevronRight,
  Download,
  Link2,
  MoreHorizontal,
  Share2,
  Trash2,
  User,
} from "lucide-react";
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

export default function VoiceCallDetailPage() {
  const params = useParams();
  const id = String(params.id || "");
  const [tab, setTab] = useState<"overview" | "transcript">("overview");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [showTranscriptDetails, setShowTranscriptDetails] = useState(true);
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

  const recordings = demo ? [] : ((data?.recordings as Array<{ id: string }>) || []);
  const segments: Segment[] = demo
    ? MOCK_TRANSCRIPT_SEGMENTS
    : ((data?.transcripts as Array<{ segments?: Segment[] }>) || []).flatMap(
        (t) => t.segments || [],
      );
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
  const shortId = id.slice(0, 12);

  const mockCall = demo ? mock : undefined;
  const infoFields = [
    { label: "Name", value: callerName },
    { label: "Email", value: mockCall?.contactEmail || "—" },
    { label: "Phone", value: fmtCallPhone(callerPhone) },
    { label: "Policy/Account Number", value: mockCall ? "849302-39" : "—" },
    { label: "Interest Level", value: mockCall ? "Interested (High)" : "—" },
    {
      label: "Next Steps Identified",
      value: mockCall ? "Send quote, schedule follow-up" : "—",
    },
    { label: "Goal", value: mockCall?.reason || insight?.intent || "—" },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-[#6b7280]">
        <Link href="/voice/setup" className="hover:text-[#374151]">AI Receptionist</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/voice/calls" className="hover:text-[#374151]">Calls</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-[#374151]">Call from {callerName}</span>
      </nav>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[26px] font-semibold tracking-tight text-[#111827]">
              Call from {callerName}
            </h1>
            <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-violet-700 ring-1 ring-inset ring-violet-200">
              Incoming
            </span>
          </div>
          <p className="mt-2 text-sm text-[#6b7280]">
            <span className="font-mono text-xs">{shortId}…</span>
            {" · "}
            {dateLabel} at {timeLabel}
            {" · "}
            {fmtCallDuration(call.durationSeconds as number)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#374151] shadow-sm hover:bg-[#f9fafb]"
          >
            Transfer
          </button>
          <button
            type="button"
            className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#374151] shadow-sm hover:bg-[#f9fafb]"
          >
            Add Note
          </button>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white shadow-sm"
          >
            <MoreHorizontal className="h-4 w-4 text-[#6b7280]" />
          </button>
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
              {recordings[0]?.id ? (
                <WaveformRecordingPlayer recordingId={recordings[0].id} />
              ) : (
                <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                  <div className="flex h-16 items-center gap-3 rounded-lg bg-[#f9fafb] px-4">
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6366f1] text-white"
                    >
                      ▶
                    </button>
                    <div className="flex-1">
                      <div className="flex h-8 items-end gap-0.5">
                        {Array.from({ length: 48 }).map((_, i) => (
                          <div
                            key={i}
                            className="w-1 rounded-full bg-[#6366f1]"
                            style={{ height: `${20 + Math.abs(Math.sin(i * 0.4)) * 24}px` }}
                          />
                        ))}
                      </div>
                    </div>
                    <span className="text-sm tabular-nums text-[#6b7280]">
                      0:45 / {fmtCallDuration(call.durationSeconds as number)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#6366f1]">
                    <button type="button" className="inline-flex items-center gap-1.5 hover:underline">
                      <Download className="h-4 w-4" /> Download
                    </button>
                    <button type="button" className="inline-flex items-center gap-1.5 hover:underline">
                      <Share2 className="h-4 w-4" /> Share
                    </button>
                    <button type="button" className="inline-flex items-center gap-1.5 hover:underline">
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                    <button type="button" className="inline-flex items-center gap-1.5 hover:underline">
                      <Link2 className="h-4 w-4" /> Copy link
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-[#111827]">AI Summary</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#374151]">
                  {insight?.summary ||
                    mockCall?.summary ||
                    "No AI summary available for this call."}
                </p>
              </div>

              <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[#111827]">Call Information</h2>
                  <button type="button" className="text-sm font-medium text-[#6366f1] hover:underline">
                    Edit
                  </button>
                </div>
                <dl className="mt-4 divide-y divide-[#f3f4f6]">
                  {infoFields.map((f) => (
                    <div key={f.label} className="flex justify-between gap-4 py-3 text-sm">
                      <dt className="text-[#6b7280]">{f.label}</dt>
                      <dd className="text-right font-medium text-[#111827]">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

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
                    <button type="button" className="text-sm font-medium text-[#6366f1] hover:underline">
                      See more
                    </button>
                  ) : null}
                </div>
              </div>
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
              <div className="flex justify-between gap-2">
                <dt className="text-[#6b7280]">Cost</dt>
                <dd className="font-medium text-[#111827]">$0.15 (est.)</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#6b7280]">Provider</dt>
                <dd className="font-medium text-[#111827]">Twilio</dd>
              </div>
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
            <ol className="mt-4 space-y-0">
              {(demo ? MOCK_ACTIVITY_EVENTS : MOCK_ACTIVITY_EVENTS).map((e, idx, arr) => (
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
          </div>

          <div className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#111827]">Tags & Lead Status</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#eef2ff] px-2.5 py-0.5 text-xs font-medium text-[#4f46e5]">
                Sales
              </span>
              <span className="rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-xs font-medium text-[#374151]">
                Inbound Call
              </span>
              <button type="button" className="text-xs font-medium text-[#6366f1] hover:underline">
                + Add Tag
              </button>
            </div>
            <div className="mt-4">
              <label className="text-xs text-[#6b7280]">Lead Status</label>
              <select className="mt-1 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-sm">
                <option>Interested (High)</option>
                <option>Interested (Medium)</option>
                <option>Not interested</option>
              </select>
            </div>
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
              <div>
                <p className="text-sm font-semibold text-[#111827]">{callerName}</p>
                <p className="text-xs text-[#6b7280]">Last contact: 10 mins ago</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
