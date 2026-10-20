import "server-only";

import { getPrisma } from "@/lib/server/db";
import { applyUnwantedSolicitorCustomerBilling } from "./billing";
import { blockCallerForWorkspace } from "./blocklist";
import { readVoiceV3ScreeningFromCallMetadata } from "./call-metadata";

export async function recordVoiceV3UnwantedSolicitorOutcome(input: {
  workspaceId: string;
  callId: string;
  callerE164: string | null | undefined;
  displayName?: string | null;
}): Promise<{ ok: true; alreadyRecorded: boolean; callerBlocked: boolean }> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { id: true, metadata: true },
  });
  if (!call) {
    throw new Error("call_not_found");
  }

  const screening = readVoiceV3ScreeningFromCallMetadata(call.metadata);
  if (screening?.transovoOutcome === "UNWANTED_SOLICITATION") {
    return { ok: true, alreadyRecorded: true, callerBlocked: true };
  }

  let callerBlocked = false;
  const caller = input.callerE164?.trim();
  if (caller) {
    const blocked = await blockCallerForWorkspace({
      workspaceId: input.workspaceId,
      callerE164: caller,
      sourceCallId: input.callId,
      displayName: input.displayName,
    });
    callerBlocked = blocked.ok;
  }

  await applyUnwantedSolicitorCustomerBilling({
    workspaceId: input.workspaceId,
    callId: input.callId,
  });

  return { ok: true, alreadyRecorded: false, callerBlocked };
}
