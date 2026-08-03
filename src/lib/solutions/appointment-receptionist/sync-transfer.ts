import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { upsertTransferDestination } from "@/lib/voice/platform/ai-platform";

/** Canonical escalate_human target used by flow global rules. */
export const WIZARD_HANDOFF_NAME = "Agent Handoff";

export function normalizeWizardTransferPhone(raw: string): string | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  try {
    return normalizeE164(trimmed);
  } catch {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    if (trimmed.startsWith("+") && digits.length >= 10) return `+${digits}`;
    return null;
  }
}

export function wizardTransferDestinationName(name: string): string {
  const trimmed = String(name || "").trim();
  return trimmed || WIZARD_HANDOFF_NAME;
}

/**
 * Persist wizard transfer phone so escalate_human / Telnyx sync have a real E.164.
 * Upserts both the display name and "Agent Handoff" (flow default).
 */
export async function syncWizardTransferDestinations(input: {
  workspaceId: string;
  agentId: string;
  destinationName: string;
  destinationPhone: string;
  returnToAiOnFail?: boolean;
}) {
  const e164 = normalizeWizardTransferPhone(input.destinationPhone);
  if (!e164) return { synced: false as const, e164: null };

  const displayName = wizardTransferDestinationName(input.destinationName);
  const names = new Set([displayName, WIZARD_HANDOFF_NAME, "Front Desk"]);

  for (const name of names) {
    await upsertTransferDestination(input.workspaceId, {
      agentId: input.agentId,
      name,
      kind: "phone",
      destination: e164,
      voicemailOnFail: false,
      returnToAiOnFail: input.returnToAiOnFail ?? true,
      enabled: true,
    });
  }

  return { synced: true as const, e164, displayName };
}
