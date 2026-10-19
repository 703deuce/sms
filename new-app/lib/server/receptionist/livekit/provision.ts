import "server-only";

import { getPrisma } from "@/lib/server/db";
import type { ReceptionistPublishedBundle } from "@/lib/server/receptionist/draft-types";
import { syncReceptionistDidDispatchRule } from "./dispatch-sync";

export type LiveKitProvisionResult = {
  ok: boolean;
  actions: string[];
  error?: string;
};

type TelephonyProvision = {
  routingMode?: string;
  state?: string;
  livekitInboundTrunkId?: string;
};

function readTelephonyProvision(settingsJson: unknown): TelephonyProvision {
  if (!settingsJson || typeof settingsJson !== "object") return {};
  const settings = settingsJson as Record<string, unknown>;
  const telephony =
    settings.telephony && typeof settings.telephony === "object"
      ? (settings.telephony as Record<string, unknown>)
      : {};
  const provision =
    telephony.provision && typeof telephony.provision === "object"
      ? (telephony.provision as TelephonyProvision)
      : {};
  return provision;
}

/**
 * Sync LiveKit per-DID dispatch metadata when trunk is already provisioned.
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
  if (provision.routingMode !== "livekit_sip" || provision.state !== "active" || !trunkId) {
    return {
      ok: false,
      actions: ["skipped_not_livekit_provisioned"],
      error: "not_livekit_provisioned",
    };
  }

  try {
    const synced = await syncReceptionistDidDispatchRule({
      e164: phone.e164,
      trunkId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      publishedVersionId: input.publishedVersionId,
    });

    const settings =
      phone.settingsJson && typeof phone.settingsJson === "object"
        ? { ...(phone.settingsJson as object) }
        : {};
    const telephony =
      (settings as Record<string, unknown>).telephony &&
      typeof (settings as Record<string, unknown>).telephony === "object"
        ? { ...((settings as Record<string, unknown>).telephony as object) }
        : {};
    await prisma.phoneNumber.update({
      where: { id: input.phoneNumberId },
      data: {
        settingsJson: {
          ...settings,
          telephony: {
            ...telephony,
            explicitDispatch: {
              workspaceId: input.workspaceId,
              agentId: input.agentId,
              publishedVersionId: input.publishedVersionId,
              toE164: phone.e164,
              dispatchSource: "phone_provision",
            },
          },
        },
      },
    });

    return { ok: true, actions: synced.actions };
  } catch (err) {
    return {
      ok: false,
      actions: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
