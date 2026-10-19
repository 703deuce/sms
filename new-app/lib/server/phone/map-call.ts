import type { Contact, HumanCall, HumanCallNote, VoicemailMessage } from "@prisma/client";
import type { CallOutcome, PhoneCallDto } from "@/lib/phone/types";

function mapStatusToOutcome(status: string, disposition: string | null): CallOutcome {
  const d = (disposition || "").toLowerCase();
  if (d.includes("voicemail")) return "voicemail";
  if (status === "completed" && d.includes("no_answer")) return "missed";
  if (status === "completed" && !disposition) return "answered";
  if (status === "failed") return "failed";
  if (status === "busy") return "busy";
  if (status === "canceled") return "canceled";
  if (status === "voicemail") return "voicemail";
  if (status === "completed") return "answered";
  if (status === "no_answer" || status === "missed") return "missed";
  return status === "in_progress" || status === "ringing" ? "answered" : "missed";
}

export function mapHumanCallToDto(
  call: HumanCall,
  opts?: {
    contact?: Contact | null;
    voicemail?: VoicemailMessage | null;
    callNotes?: HumanCallNote[];
    numberLabel?: string | null;
  },
): PhoneCallDto {
  const contact = opts?.contact;
  const name =
    contact
      ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.company || call.from
      : call.direction === "inbound"
        ? call.from
        : call.to;

  const outcome = mapStatusToOutcome(call.status, call.disposition);
  const durationSec =
    call.answeredAt && call.endedAt
      ? Math.max(0, Math.floor((call.endedAt.getTime() - call.answeredAt.getTime()) / 1000))
      : call.endedAt && call.startedAt
        ? Math.max(0, Math.floor((call.endedAt.getTime() - call.startedAt.getTime()) / 1000))
        : 0;

  return {
    id: call.id,
    direction: call.direction === "outbound" ? "outbound" : "inbound",
    caller: name,
    callerNumber: call.direction === "inbound" ? call.from : call.to,
    contactId: call.contactId,
    numberId: call.phoneNumberId,
    startedAt: call.startedAt.toISOString(),
    durationSec,
    outcome,
    routedTo: opts?.numberLabel || call.callerIdNumber || call.to,
    user: call.agentUserId ? "Operator" : null,
    handled: call.handled,
    callbackNeeded: call.callbackNeeded,
    recording: Boolean(call.recordingUrl),
    recordingUrl: call.recordingUrl,
    disposition: call.disposition,
    source: call.source,
    status: call.status,
    transcriptText: call.transcriptText,
    voicemail: opts?.voicemail
      ? {
          durationSec: opts.voicemail.durationSeconds ?? 0,
          transcript: opts.voicemail.transcriptText,
          messageId: opts.voicemail.id,
          isRead: opts.voicemail.isRead,
        }
      : null,
    notes: (opts?.callNotes || []).map((n) => ({
      id: n.id,
      content: n.content,
      createdAt: n.createdAt.toISOString(),
      author: n.createdByUserId ? "Team" : null,
    })),
    metadata: (call.metadata as Record<string, unknown> | null) ?? null,
  };
}
