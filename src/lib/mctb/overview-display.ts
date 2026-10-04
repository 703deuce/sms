/** Short, scannable copy for MCTB Overview rows (no long LLM paragraphs). */

export function formatOverviewRelativeTime(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.max(0, Math.floor(ms / 60_000));
    if (min < 1) return "Just now";
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hr ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export function buildOverviewMissedCallSubtitle(input: {
  teamBriefHeadline?: string | null;
  recoveryLabel: string;
  replyLabel: string;
}): string {
  const headline = input.teamBriefHeadline?.trim();
  if (headline) {
    const cleaned = headline
      .replace(/^Missed call from\s+/i, "")
      .replace(/\s+replied by SMS.*/i, "")
      .trim();
    if (cleaned.length > 0 && cleaned.length <= 90) return cleaned;
    if (headline.length <= 90) return headline;
    return `${headline.slice(0, 87)}…`;
  }
  const reply = input.replyLabel.toLowerCase();
  if (reply.includes("replied") || reply.includes("reply")) {
    return "Customer replied · Follow up";
  }
  const recovery = input.recoveryLabel.toLowerCase();
  if (recovery.includes("deliver") || recovery.includes("sent")) {
    return "Recovery text sent · Waiting for reply";
  }
  if (recovery.includes("suppress")) return "Recovery suppressed";
  if (recovery.includes("consent") || recovery.includes("waiting")) {
    return "Waiting for consent";
  }
  return input.recoveryLabel;
}

export function overviewMissedCallStatusChip(input: {
  recoveryLabel: string;
  replyLabel: string;
  needsAttention?: boolean;
}): string {
  if (input.needsAttention) return "Needs attention";
  const reply = input.replyLabel.toLowerCase();
  if (reply.includes("replied")) return "Replied";
  const recovery = input.recoveryLabel.toLowerCase();
  if (recovery.includes("deliver") || recovery.includes("sent")) return "Waiting";
  if (recovery.includes("suppress")) return "Suppressed";
  if (recovery.includes("fail")) return "Failed";
  if (recovery.includes("consent")) return "Waiting";
  return "In progress";
}
