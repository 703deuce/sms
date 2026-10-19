import type { VoiceCall, VoiceTranscript, VoiceToolExecution } from "@prisma/client";
import type { AiOutcome, Call } from "@/lib/data";

function mapOutcome(outcome: string | null, transferred: boolean, appointmentBooked: boolean): AiOutcome {
  const o = (outcome || "").toLowerCase();
  if (appointmentBooked || o.includes("book")) return "booked";
  if (transferred || o.includes("transfer")) return "transferred";
  if (o.includes("callback")) return "callback";
  if (o.includes("message")) return "message";
  if (o.includes("fail")) return "failed";
  return "unresolved";
}

export function mapVoiceCallToUiCall(
  call: VoiceCall,
  extras?: {
    transcript?: VoiceTranscript | null;
    tools?: VoiceToolExecution[];
    numberLabel?: string;
    summary?: string | null;
  },
): Call {
  const durationSec = call.durationSeconds ?? 0;
  const meta = (call.metadata as Record<string, unknown>) || {};
  const dyn = (call.dynamicVariables as Record<string, unknown>) || {};
  const aiOutcome = mapOutcome(call.outcome, call.transferred, call.appointmentBooked);
  const intent =
    (typeof meta.aiIntent === "string" && meta.aiIntent) ||
    (typeof dyn.aiIntent === "string" && dyn.aiIntent) ||
    call.outcome ||
    "general";
  const followUpMeta =
    meta.followUp === "open" || dyn.followUp === "open"
      ? "open"
      : aiOutcome === "callback" || aiOutcome === "unresolved"
        ? "open"
        : "none";
  const transcriptLines =
    extras?.transcript?.fullText && typeof extras.transcript.fullText === "string"
      ? extras.transcript.fullText.split("\n").map((line, i) => ({
          speaker: line.startsWith("Caller:") ? ("caller" as const) : ("agent" as const),
          text: line.replace(/^(Caller|Agent):\s*/i, ""),
          at: new Date(call.startedAt.getTime() + i * 1000).toISOString(),
        }))
      : [];

  return {
    id: call.id,
    contactId: call.contactId ?? undefined,
    caller: call.fromE164,
    callerNumber: call.fromE164,
    numberId: call.phoneNumberId || "",
    direction: call.direction === "OUTBOUND" ? "outbound" : "inbound",
    startedAt: call.startedAt.toISOString(),
    durationSec,
    outcome: "ai_handled",
    routedTo: extras?.numberLabel || call.toE164,
    recording: false,
    callbackNeeded: aiOutcome === "callback",
    handled: true,
    ai: {
      intent,
      outcome: aiOutcome,
      summary:
        extras?.summary ||
        (typeof meta.callSummary === "string" ? meta.callSummary : undefined) ||
        call.errorMessage ||
        "AI handled call",
      followUp: followUpMeta,
      tools: (extras?.tools || []).map((t) => ({
        name:
          t.input && typeof t.input === "object" && "toolName" in (t.input as object)
            ? String((t.input as { toolName?: string }).toolName)
            : "tool",
        status: t.status === "success" ? "success" : t.status === "failed" ? "failed" : "skipped",
        detail: t.errorMessage || "",
      })),
      transcript: transcriptLines,
    },
  };
}
