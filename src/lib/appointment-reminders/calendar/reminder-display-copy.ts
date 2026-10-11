import type { AggregateReminderStatus } from "@/lib/appointment-reminders/aggregate-reminder-status";

const WORKFLOW_DETAIL_RE = /Automated workflow [“"](.+?)[”"] sends/i;

export function extractWorkflowNameFromDetail(detail: string | null | undefined): string | null {
  if (!detail) return null;
  const m = detail.match(WORKFLOW_DETAIL_RE);
  return m?.[1]?.trim() || null;
}

export function isWorkflowManagedReminder(input: {
  label?: string;
  status?: AggregateReminderStatus | string;
  attentionReason?: string;
  secondaryLine?: string | null;
}): boolean {
  if (input.attentionReason === "workflow_conflict") return true;
  return String(input.label || "").toLowerCase() === "workflow active";
}

export function compactWorkflowManagedLabel(secondaryLine?: string | null): string {
  const name = extractWorkflowNameFromDetail(secondaryLine);
  return name ? `Managed by ${name}` : "Managed by automation workflow";
}

/** Short line for lists and agenda — never the full workflow paragraph. */
export function compactReminderFeedLine(input: {
  label?: string;
  secondaryLine?: string | null;
  status?: string;
  attentionReason?: string;
}): string {
  if (isWorkflowManagedReminder(input)) {
    return compactWorkflowManagedLabel(input.secondaryLine);
  }
  const secondary = input.secondaryLine?.trim();
  if (secondary && secondary.length > 72) {
    return input.label?.trim() || "Reminders";
  }
  if (secondary && !/^reminders?$/i.test(secondary)) return secondary;
  const label = input.label?.trim();
  if (label && !/^workflow active$/i.test(label)) return label;
  if (input.status === "scheduled") return "Reminder scheduled";
  if (input.status === "not_scheduled") return "No reminder scheduled";
  return label || "Reminders";
}

export function compactScheduledSendLine(input: {
  label?: string;
  secondaryLine?: string | null;
  channel?: string;
}): { primary: string; detail: string } | null {
  const secondary = input.secondaryLine?.trim();
  if (!secondary) return null;
  if (WORKFLOW_DETAIL_RE.test(secondary)) return null;
  const channel = input.channel?.toUpperCase() || "SMS";
  const step = input.label?.trim() || "Reminder";
  return { primary: `${step} · ${channel}`, detail: secondary };
}

export function looksLikeJunkCalendarTitle(value: string): boolean {
  const t = value.trim();
  if (!t) return true;
  if (/^[\w.+-]+@[\w.-]+\.\w+$/.test(t)) return true;
  if (/^(microsoft|google|outlook|gmail|calendar|follow|untitled)$/i.test(t)) return true;
  if (/^test\s*\d*\s*edit?$/i.test(t)) return true;
  return false;
}
