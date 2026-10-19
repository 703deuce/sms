import "server-only";

import { getPrisma } from "@/lib/server/db";
import type { ReceptionistPublishedBundle } from "@/lib/server/receptionist/draft-types";
import { readTelephonyProvision } from "@/lib/server/telephony/telephony-record";
import { provisionVoiceV3ReceptionistIngress } from "@/lib/server/telephony/v3-receptionist-provision";
import { ensureCanonicalV3SharedDispatchRule } from "./canonical-dispatch";

export type LiveKitProvisionResult = {
  ok: boolean;
  actions: string[];
  error?: string;
};

/**
 * Full golden-era V3 provision on publish, or dispatch-only refresh when already on LiveKit.
 */
export async function provisionReceptionistLiveKitOnPublish(input: {
  workspaceId: string;
  phoneNumberId: string;
  agentId: string;
  publishedVersionId: string;
  bundle: ReceptionistPublishedBundle;
}): Promise<LiveKitProvisionResult> {
  void input.bundle;
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { e164: true, settingsJson: true },
  });
  if (!phone?.e164) {
    return { ok: false, actions: [], error: "phone_not_found" };
  }

  const provision = readTelephonyProvision(phone.settingsJson);
  const trunkId = provision.livekitInboundTrunkId;
  const livekitReady =
    provision.routingMode === "livekit_sip" &&
    provision.state === "active" &&
    Boolean(trunkId);

  if (!livekitReady) {
    const full = await provisionVoiceV3ReceptionistIngress({
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
      agentId: input.agentId,
      publishedVersionId: input.publishedVersionId,
    });
    return {
      ok: full.ok,
      actions: full.actions,
      error: full.error,
    };
  }

  try {
    const dispatch = await ensureCanonicalV3SharedDispatchRule({ trunkId: trunkId! });
    return { ok: true, actions: dispatch.actions };
  } catch (err) {
    return {
      ok: false,
      actions: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
