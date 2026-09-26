import { mapVoiceCallApiRowToNewUi, type VoiceCallApiRow } from "@/lib/newui-transplant/adapters/voice-calls";
import { fmtCallPhone } from "@/lib/voice/calls/display";
import type { CallOutcome } from "@/newui-transplant/lib/view-models";

export type VoiceCallDetailWired = {
  id: string;
  caller: string;
  phone: string;
  phoneTel: string;
  date: string;
  time: string;
  duration: string;
  outcome: CallOutcome;
  attention?: string;
  summary: string;
  recordingUrl?: string | null;
  transcript: Array<{ who: string; text: string }>;
  lifecycleSteps: string[];
  collectedRows: Array<{ label: string; value: string }>;
  knowledgeGapsText: string;
  callDataRows: Array<{ label: string; value: string }>;
  activityFeed: Array<{ time: string; text: string }>;
  conversationHref?: string;
};

type DetailPayload = {
  call: VoiceCallApiRow & {
    agentName?: string | null;
    structuredMessage?: unknown;
    sentiment?: string | null;
  };
  transcripts?: Array<{ segments?: Array<{ speaker: string; text: string }> }>;
  recordings?: Array<{ url?: string | null; playbackUrl?: string | null }>;
  events?: Array<{ eventType?: string; label?: string; createdAt: string }>;
  knowledgeGaps?: Array<{ displayQuestion?: string }>;
};

function speakerLabel(speaker: string): string {
  const s = speaker.toLowerCase();
  if (s.includes("agent") || s.includes("assistant") || s === "ai") return "AI";
  if (s.includes("caller") || s.includes("user")) return "Caller";
  return speaker;
}

export function buildVoiceCallDetailWired(payload: DetailPayload): VoiceCallDetailWired {
  const vm = mapVoiceCallApiRowToNewUi(payload.call);
  const segments =
    payload.transcripts?.flatMap((t) => t.segments ?? []) ?? [];
  const transcript = segments.map((seg) => ({
    who: speakerLabel(seg.speaker),
    text: seg.text,
  }));

  const recording =
    payload.recordings?.find((r) => r.playbackUrl || r.url) ?? payload.recordings?.[0];
  const recordingUrl = recording?.playbackUrl || recording?.url || null;

  const lifecycleSteps =
    payload.events?.length
      ? payload.events.map((e) => e.label || e.eventType || "Event")
      : [];

  const structured = payload.call.structuredMessage as Record<string, unknown> | undefined;
  const collectedRows: Array<{ label: string; value: string }> = [];
  if (vm.caller) collectedRows.push({ label: "Name", value: vm.caller });
  if (structured?.serviceReason && typeof structured.serviceReason === "string") {
    collectedRows.push({ label: "Need", value: structured.serviceReason });
  }
  if (structured?.address && typeof structured.address === "string") {
    collectedRows.push({ label: "Address", value: structured.address });
  }
  if (structured?.urgency && typeof structured.urgency === "string") {
    collectedRows.push({ label: "Urgency", value: structured.urgency });
  }
  if (collectedRows.length === 0) {
    collectedRows.push({ label: "Name", value: vm.caller });
  }

  const gaps = payload.knowledgeGaps ?? [];
  const knowledgeGapsText =
    gaps.length === 0
      ? "No gaps detected on this call."
      : gaps.map((g) => g.displayQuestion).filter(Boolean).join(" · ");

  const callDataRows = [
    { label: "Call ID", value: payload.call.id },
    { label: "Line", value: fmtCallPhone(payload.call.toE164) },
    { label: "Handler", value: payload.call.agentName ? `AI · ${payload.call.agentName}` : "AI" },
    {
      label: "Sentiment",
      value: payload.call.sentiment?.trim() || "Unknown",
    },
  ];

  const activityFeed =
    payload.events?.map((e) => ({
      time: new Date(e.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      text: e.label || e.eventType || "Activity",
    })) ?? [
      { time: vm.time, text: "Call started" },
      { time: vm.duration, text: "Call ended" },
    ];

  return {
    id: payload.call.id,
    caller: vm.caller,
    phone: vm.phone,
    phoneTel: fmtCallPhone(payload.call.fromE164),
    date: vm.date,
    time: vm.time,
    duration: vm.duration,
    outcome: vm.outcome,
    attention: vm.attention,
    summary: vm.summary,
    recordingUrl,
    transcript,
    lifecycleSteps,
    collectedRows,
    knowledgeGapsText,
    callDataRows,
    activityFeed,
  };
}
