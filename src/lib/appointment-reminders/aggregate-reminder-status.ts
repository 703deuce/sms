import type { AppointmentMetadata } from "@/lib/appointments/types";

export type AggregateReminderStatus =
  | "scheduled"
  | "sent"
  | "delivered"
  | "needs_attention"
  | "not_scheduled"
  | "cancelled"
  | "failed";

export type AggregateReminderView = {
  status: AggregateReminderStatus;
  label: string;
  secondaryLine: string;
  attentionReason?: string;
};

const E164_RE = /^\+[1-9]\d{6,14}$/;

export function isValidReminderPhone(phone: string | null | undefined): boolean {
  if (!phone?.trim()) return false;
  const normalized = phone.trim();
  if (normalized.startsWith("email:")) return false;
  if (normalized.includes("@") && !normalized.startsWith("+")) return false;
  if (E164_RE.test(normalized)) return true;
  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function resolveReminderContactPhone(
  meta: AppointmentMetadata,
  inviteePhone: string | null | undefined,
): string | null {
  const override = meta.reminderOverride?.phone;
  const raw = override || meta.inviteePhone || inviteePhone || null;
  if (!raw?.trim()) return null;
  const v = raw.trim();
  if (v.startsWith("email:")) return null;
  if (v.includes("@") && !v.startsWith("+")) return null;
  return v;
}

export function matchesReminderStatusFilter(
  view: AggregateReminderView,
  filter: string,
): boolean {
  if (!filter || filter === "all") return true;
  const map: Record<string, AggregateReminderStatus[]> = {
    scheduled: ["scheduled"],
    sent: ["sent"],
    delivered: ["delivered"],
    needs_attention: ["needs_attention", "failed"],
    not_scheduled: ["not_scheduled"],
    cancelled: ["cancelled"],
  };
  const allowed = map[filter];
  if (!allowed) return true;
  return allowed.includes(view.status);
}
