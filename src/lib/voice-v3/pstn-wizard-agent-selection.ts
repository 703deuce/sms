import type { CallHandlingPhoneSettings } from "@/lib/call-handling/types";
import { hasExplicitCallHandlingSelection, readCallHandlingBlock } from "@/lib/call-handling/phone-settings";

export type PstnWizardExplicitBindDecision =
  | { useExplicit: true; agentId: string }
  | { useExplicit: false; reason: "not_call_handling_ai" | "no_parked_agent" | "no_explicit_selection" };

/**
 * Whether an inbound call on this ingress should bind to the Call Handling–selected receptionist.
 */
export function decideExplicitCallHandlingPstnBind(settingsJson: unknown): PstnWizardExplicitBindDecision {
  const block = readCallHandlingBlock(settingsJson);
  if (block.activeCallHandler !== "ai_receptionist") {
    return { useExplicit: false, reason: "not_call_handling_ai" };
  }
  const agentId = block.parkedAiReceptionistAgentId?.trim();
  if (!agentId) {
    return { useExplicit: false, reason: "no_parked_agent" };
  }
  if (!hasExplicitCallHandlingSelection(settingsJson)) {
    return { useExplicit: false, reason: "no_explicit_selection" };
  }
  return { useExplicit: true, agentId };
}

/** Legacy V3 Basic: first published appointment receptionist in recency order. */
export function pickFirstPublishedReceptionistAgentId(
  orderedAgentIds: string[],
  isAppointmentReceptionist: (agentId: string) => boolean,
): string | null {
  for (const id of orderedAgentIds) {
    if (isAppointmentReceptionist(id)) return id;
  }
  return null;
}
