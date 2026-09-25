import type { ActivationIssue } from "@/lib/solutions/appointment-receptionist/capability-checklist";

export type OverviewPublicationStatus = "setup_required" | "draft" | "active" | "needs_attention";

export function deriveOverviewPublicationStatus(input: {
  hasCanonicalAgent: boolean;
  published: boolean;
  agentStatus: string | null;
}): OverviewPublicationStatus {
  if (!input.hasCanonicalAgent) return "setup_required";
  if (!input.published) return "draft";
  if (input.agentStatus && input.agentStatus !== "ACTIVE") return "needs_attention";
  return "active";
}

export function publicationStatusLabel(status: OverviewPublicationStatus): string {
  switch (status) {
    case "setup_required":
      return "Setup required";
    case "draft":
      return "Draft";
    case "active":
      return "Active";
    case "needs_attention":
      return "Needs attention";
    default:
      return "Unknown";
  }
}

export type OverviewAttentionRow = {
  id: string;
  label: string;
  href: string;
};

export function buildOverviewAttentionRows(input: {
  voiceCallsNeedingAttention: number;
  openKnowledgeGaps: number;
  blockingSetupIssues: ActivationIssue[];
  maxRows?: number;
}): OverviewAttentionRow[] {
  const max = input.maxRows ?? 5;
  const rows: OverviewAttentionRow[] = [];

  if (input.voiceCallsNeedingAttention > 0) {
    const n = input.voiceCallsNeedingAttention;
    rows.push({
      id: "voice-calls",
      label: `${n} call${n === 1 ? "" : "s"} need follow-up`,
      href: "/voice/calls?attention=open",
    });
  }

  if (input.openKnowledgeGaps > 0) {
    const n = input.openKnowledgeGaps;
    rows.push({
      id: "knowledge-gaps",
      label: `${n} unanswered question${n === 1 ? "" : "s"}`,
      href: "/voice/knowledge#knowledge-gaps",
    });
  }

  for (const issue of input.blockingSetupIssues) {
    if (rows.length >= max) break;
    rows.push({
      id: `setup-${issue.id}`,
      label: issue.message,
      href: setupIssueHref(issue.id),
    });
  }

  return rows.slice(0, max);
}

function setupIssueHref(issueId: string): string {
  if (issueId === "business_name" || issueId.startsWith("knowledge") || issueId === "website_url") {
    return "/voice/knowledge";
  }
  if (issueId === "transfer" || issueId === "phone") {
    return "/voice/call-handling";
  }
  if (issueId === "calendar" || issueId === "appointment_types") {
    return "/integrations";
  }
  return "/voice/receptionist";
}

export function calendarProviderCustomerLabel(provider: string | null): string | null {
  if (!provider) return null;
  const p = provider.toLowerCase();
  if (p === "microsoft") return "Microsoft Calendar connected";
  if (p === "google") return "Google Calendar connected";
  if (p === "calendly") return "Calendly connected";
  if (p === "internal") return "Calendar connected";
  return "Calendar connected";
}
