import { getPrisma } from "@/lib/db";
import type { RealEstateCallState, RealEstateIntent } from "./types";
import { REAL_ESTATE_INTENT_LABELS } from "./types";

function activeIntents(state: RealEstateCallState): RealEstateIntent[] {
  const intents: RealEstateIntent[] = [];
  if (state.primaryIntent) intents.push(state.primaryIntent);
  for (const secondary of state.secondaryIntents) {
    if (!intents.includes(secondary)) intents.push(secondary);
  }
  return intents;
}

/**
 * Notify staff of RE front desk events via audit log + optional workspace notification hooks.
 */
import type { CompiledRealEstateFrontDesk } from "@/lib/voice/real-estate/compile/types";

export async function notifyRealEstateStaff(input: {
  workspaceId: string;
  callId: string;
  callState: RealEstateCallState;
  businessName: string;
  event: "intake_complete" | "message_taken" | "appointment_booked" | "transfer_requested";
  callerE164?: string | null;
  notifications?: CompiledRealEstateFrontDesk["notifications"];
}): Promise<void> {
  const prefs = input.notifications;
  if (input.event === "intake_complete" && prefs?.onQualified === false) return;
  if (input.event === "message_taken" && prefs?.onNeedsHuman === false) return;
  if (input.event === "appointment_booked" && prefs?.onAppointmentBooked === false) return;
  if (input.event === "transfer_requested" && prefs?.onNeedsHuman === false) return;
  const prisma = getPrisma();
  const intents = activeIntents(input.callState)
    .map((i) => REAL_ESTATE_INTENT_LABELS[i])
    .join(" + ");
  const name = input.callState.collectedFields.name || input.callState.contactName || "Unknown caller";
  const phone = input.callerE164?.trim() || input.callState.collectedFields.callback_phone || "";

  const titleByEvent: Record<typeof input.event, string> = {
    intake_complete: `New qualified lead: ${name}`,
    message_taken: `Message from ${name}`,
    appointment_booked: `Appointment booked: ${name}`,
    transfer_requested: `Transfer requested: ${name}`,
  };

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      event: `voice.real_estate.${input.event}`,
      detail: JSON.stringify({
        callId: input.callId,
        title: titleByEvent[input.event],
        name,
        phone,
        intents,
        leadStatus: input.callState.leadStatus,
        businessName: input.businessName,
        collectedFields: input.callState.collectedFields,
      }),
    },
  });
}
