import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";

export type MctbNumberRow = {
  id: string;
  e164: string;
  friendlyName: string | null;
  type: string | null;
  provider: string | null;
  status: string | null;
  messagingStatus?: { approved: boolean; label: string };
  voiceReady?: boolean;
};

export function formatNumberTypeLabel(type: string | null | undefined): string {
  const t = String(type || "").toLowerCase();
  if (t.includes("toll")) return "Toll-free";
  if (t.includes("local")) return "Local";
  return type || "Local";
}

export function messagingUiLabel(row: MctbNumberRow): { label: string; tone: "ready" | "pending" | "attention" } {
  if (row.messagingStatus?.approved) return { label: "Ready", tone: "ready" };
  const raw = row.messagingStatus?.label || "Verification required";
  if (/reject|action|fail/i.test(raw)) return { label: "Needs attention", tone: "attention" };
  return { label: raw.replace(/_/g, " "), tone: "pending" };
}

export function voiceUiLabel(row: MctbNumberRow): string {
  if (row.voiceReady === false) return "Pending";
  return "Ready";
}

export function displayNumber(e164: string): string {
  return formatMctbPhoneLabel(e164);
}

export type TfvUiStatus = {
  status: string;
  statusLabel: string;
  approved: boolean;
  failureReason?: string | null;
};

export function tfvTone(status: string, approved: boolean): "ready" | "pending" | "attention" {
  if (approved) return "ready";
  if (/reject|action_required|action required/i.test(status)) return "attention";
  return "pending";
}
