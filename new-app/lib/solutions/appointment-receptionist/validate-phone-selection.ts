import "server-only";

import { getPrisma } from "@/lib/server/db";
import { getPhoneNumberAiOwner } from "@/lib/voice/agent-phone";
export type ReceptionistPhoneValidationResult =
  | { ok: true; phoneNumberId: string; e164: string }
  | { ok: false; error: string; code: string };

/**
 * Validate a wizard phone pick without changing Telnyx/LiveKit routing.
 * Draft saves may persist the selection; activation owns call-handler switches.
 */
export async function validateReceptionistPhoneSelection(input: {
  workspaceId: string;
  phoneNumberId: string;
  agentId: string;
  /** When true (Activate / explicit takeover), another ACTIVE AI owner is allowed. */
  allowTakeoverFromOtherAgent?: boolean;
}): Promise<ReceptionistPhoneValidationResult> {
  const phoneNumberId = input.phoneNumberId?.trim();
  if (!phoneNumberId) {
    return { ok: false, error: "Select a phone number", code: "missing_phone" };
  }

  const phone = await getPrisma().phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId: input.workspaceId },
    select: { id: true, e164: true, settingsJson: true },
  });
  if (!phone?.e164) {
    return {
      ok: false,
      error: "That phone number is not in this workspace",
      code: "phone_not_found",
    };
  }

  // MCTB TeXML lock is cleared on publish via syncVoiceAgentPhoneAssignment
  // (allowMctbTexmlVoiceAgentTakeover). Draft saves may select these DIDs.

  if (!input.allowTakeoverFromOtherAgent) {
    const owner = await getPhoneNumberAiOwner(input.workspaceId, phoneNumberId);
    if (owner && owner.id !== input.agentId && owner.status === "ACTIVE") {
      return {
        ok: false,
        error: `This number is already assigned to ${owner.name}. Activate with takeover or choose another number.`,
        code: "phone_owned_by_other_agent",
      };
    }
  }

  return { ok: true, phoneNumberId: phone.id, e164: phone.e164 };
}
