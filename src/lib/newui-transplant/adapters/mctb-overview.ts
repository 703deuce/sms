import type { MissedCall, RecoveryStatus } from "@/newui-transplant/lib/view-models";
import type { MctbOverviewPayload } from "@/lib/mctb/overview-types";

function toRecovery(label: string): RecoveryStatus {
  const l = label.toLowerCase();
  if (l.includes("suppress")) return "Suppressed";
  if (l.includes("fail")) return "Failed";
  if (l.includes("consent") || l.includes("waiting")) return "Waiting for consent";
  if (l.includes("reply")) return "Replied";
  if (l.includes("need")) return "Needs attention";
  return "Sent";
}

export function mapMctbOverviewRecentMissedCalls(data: MctbOverviewPayload): MissedCall[] {
  return data.recentMissedCalls.map((row) => ({
    id: row.id,
    caller: row.callerLabel,
    phone: row.callerPhoneLabel,
    missed: row.missedAt,
    trigger: "No answer",
    recovery: toRecovery(row.recoveryLabel),
    reply: row.replyLabel === "—" ? null : row.replyLabel,
    line: data.setupHealth.businessLine ?? "—",
    teamBriefHeadline: row.teamBriefHeadline ?? null,
    teamBriefSummary: row.teamBriefSummary ?? row.summaryText,
  }));
}
