import type { MissedCall, RecoveryStatus } from "@/newui-transplant/lib/view-models";
import type { MctbMissedCallsListData } from "@/lib/mctb/missed-calls-list-data";
import { fmtCallPhone } from "@/lib/voice/calls/display";

function mapRecoveryStatus(status: string, suppressionReason: string | null): RecoveryStatus {
  const s = status.toLowerCase();
  if (s.includes("suppress") || suppressionReason) return "Suppressed";
  if (s.includes("fail")) return "Failed";
  if (s.includes("consent") || s.includes("waiting")) return "Waiting for consent";
  if (s.includes("reply") || s.includes("replied")) return "Replied";
  if (s.includes("need")) return "Needs attention";
  if (s.includes("sent") || s.includes("deliver")) return "Sent";
  return "Sent";
}

function mapTrigger(classification: string | null): MissedCall["trigger"] {
  const c = (classification || "").toLowerCase();
  if (c.includes("busy")) return "Busy";
  if (c.includes("reject")) return "Rejected";
  if (c.includes("unreach")) return "Unreachable";
  if (c.includes("voicemail")) return "Voicemail";
  return "No answer";
}

export function mapMctbMissedCallsListToNewUi(data: MctbMissedCallsListData): MissedCall[] {
  return data.events.map((e) => ({
    id: e.id,
    caller: e.contactName?.trim() || fmtCallPhone(e.callerE164),
    phone: fmtCallPhone(e.callerE164),
    callerE164: e.callerE164,
    missed: new Date(e.detectedAt).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    trigger: mapTrigger(e.classification),
    recovery: mapRecoveryStatus(e.status, e.suppressionReason),
    reply: null,
    line: fmtCallPhone(e.businessE164),
    conversationId: e.conversationId ?? undefined,
    callsToday: e.callsToday && e.callsToday > 1 ? e.callsToday : undefined,
  }));
}
