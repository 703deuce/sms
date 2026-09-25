import type { LeadRecoveryCollectField } from "@/lib/mctb/lead-recovery/types";

/** Customer-facing collection toggles — map to runtime `LeadRecoveryCollectField`. */
export const AI_RECOVERY_SIMPLIFIED_FIELDS = [
  {
    field: "NAME" as LeadRecoveryCollectField,
    label: "Name",
    description: "Caller’s name when it isn’t already known.",
  },
  {
    field: "REASON" as LeadRecoveryCollectField,
    label: "What they need",
    description: "Why they called or what service they’re looking for.",
  },
  {
    field: "ADDRESS" as LeadRecoveryCollectField,
    label: "Service location",
    description: "Address or area for the job when relevant.",
  },
  {
    field: "URGENCY" as LeadRecoveryCollectField,
    label: "Urgency",
    description: "How soon they need help.",
  },
  {
    field: "CALLBACK_TIME" as LeadRecoveryCollectField,
    label: "Best time to call back",
    description: "When they prefer a return call.",
  },
] as const;

export type AiRecoverySimplifiedField = (typeof AI_RECOVERY_SIMPLIFIED_FIELDS)[number]["field"];

const SIMPLIFIED_SET = new Set<LeadRecoveryCollectField>(
  AI_RECOVERY_SIMPLIFIED_FIELDS.map((f) => f.field),
);

export function deriveSimplifiedFieldEnabled(
  collectCapabilities: LeadRecoveryCollectField[],
): Record<AiRecoverySimplifiedField, boolean> {
  const caps = new Set(collectCapabilities);
  const reasonOn =
    caps.has("REASON") || caps.has("ISSUE_DESCRIPTION") || caps.has("SERVICE_CATEGORY");
  return {
    NAME: caps.has("NAME"),
    REASON: reasonOn,
    ADDRESS: caps.has("ADDRESS"),
    URGENCY: caps.has("URGENCY"),
    CALLBACK_TIME: caps.has("CALLBACK_TIME") || caps.has("CALLBACK_NUMBER"),
  };
}

export function simplifiedTogglesToCollectCapabilities(
  enabled: Record<AiRecoverySimplifiedField, boolean>,
): LeadRecoveryCollectField[] {
  const out: LeadRecoveryCollectField[] = [];
  for (const def of AI_RECOVERY_SIMPLIFIED_FIELDS) {
    if (enabled[def.field]) out.push(def.field);
  }
  if (enabled.CALLBACK_TIME && !out.includes("CALLBACK_NUMBER")) {
    out.push("CALLBACK_NUMBER");
  }
  return out;
}

export function isSimplifiedCollectField(field: LeadRecoveryCollectField): boolean {
  return SIMPLIFIED_SET.has(field) || field === "CALLBACK_NUMBER" || field === "ISSUE_DESCRIPTION";
}
