import "server-only";

/**
 * Server-only transfer destination sync for the appointment receptionist.
 * Client Components must import helpers from `./transfer-utils` instead.
 */

import { upsertTransferDestination } from "@/lib/voice/platform/ai-platform";
import {
  normalizeWizardTransferPhone,
  wizardTransferDestinationName,
  WIZARD_HANDOFF_NAME,
} from "./transfer-utils";

export {
  normalizeWizardTransferPhone,
  wizardTransferDestinationName,
  WIZARD_HANDOFF_NAME,
} from "./transfer-utils";

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
