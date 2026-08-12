import type { RealtorLeadStatus } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function mapLeadStatusFromMeta(
  raw: string | null | undefined,
  meta: Record<string, unknown>,
): RealtorLeadStatus {
  const reState = asRecord(meta.realEstateCallState);
  const leadStatus = String(reState.leadStatus || meta.leadStatus || raw || "").toLowerCase();
  if (leadStatus.includes("qualified")) return "qualified";
  if (leadStatus.includes("appointment")) return "appointment";
  if (leadStatus.includes("message")) return "contacted";
  if (leadStatus.includes("intake")) return "working";
  if (leadStatus.includes("not_interested")) return "closed";
  if (leadStatus.includes("nurture")) return "nurture";
  return "new";
}
