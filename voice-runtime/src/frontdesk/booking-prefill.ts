import type { AgentSession } from "@livekit/agents";
import { applyReceptionistFieldBackfill } from "@/lib/voice/receptionist/field-backfill";
import { tryNormalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { FrontDeskUserData } from "./userdata";

export function prefillReceptionistFieldsForBooking(
  session: AgentSession<FrontDeskUserData>,
): void {
  const userData = session.userData;
  const manifest = userData.receptionistCompiled?.fieldManifest;
  if (!manifest?.length) return;
  if (!userData.receptionistFields) userData.receptionistFields = {};
  userData.receptionistFields = applyReceptionistFieldBackfill({
    chatCtx: session.chatCtx,
    manifest,
    receptionistFields: userData.receptionistFields,
    authoritativeFieldIds: userData.authoritativeFieldIds,
  });
  if (!userData.receptionistFields.phone?.trim() && userData.callerE164?.trim()) {
    const ani = tryNormalizeE164(userData.callerE164.trim());
    if (ani) userData.receptionistFields.phone = ani;
  }
}
