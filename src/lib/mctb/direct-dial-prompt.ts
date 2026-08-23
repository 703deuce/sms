import type { MissedCallTextConfigRecord } from "@/lib/agents/missed-call-text-back/types";

const DEFAULT_DIRECT_DIAL_PROMPT =
  "Please hold while we connect you to the business.";

export function buildDirectDialForwardPromptText(
  config: Pick<MissedCallTextConfigRecord, "directDialForwardE164">,
  businessName?: string | null,
): string | null {
  const forward = config.directDialForwardE164?.trim();
  if (!forward) return null;
  const name = businessName?.trim();
  if (name) {
    return `Please hold while we connect you to ${name}.`;
  }
  return DEFAULT_DIRECT_DIAL_PROMPT;
}

export function resolveMctbDirectDialForwardE164(
  config: Pick<MissedCallTextConfigRecord, "directDialForwardE164">,
): string | null {
  const forward = config.directDialForwardE164?.trim();
  return forward || null;
}
