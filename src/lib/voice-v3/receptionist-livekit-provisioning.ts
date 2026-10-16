import "server-only";

import { getPrisma } from "@/lib/db";
import type { VoiceAgentConfig } from "@/lib/voice/types";
import type { EnsureNumberProvisionedResult } from "@/lib/telephony/provisioning/types";
import {
  isLiveKitSipProvisionActive,
  readTelephonyProvisionFromSettings,
} from "./receptionist-livekit-policy";

export {
  appointmentReceptionistRequiresLiveKitIngress,
  assertAppointmentReceptionistLiveKitPublish,
  isLiveKitSipProvisionActive,
  readTelephonyProvisionFromSettings,
} from "./receptionist-livekit-policy";

/**
 * Update LiveKit per-DID dispatch metadata only — no Telnyx connection reroute.
 */
export async function syncLiveKitDispatchMetadataForPhone(input: {
  workspaceId: string;
  phoneNumberId: string;
  agentId: string;
  publishedVersionId?: string | null;
  publishedConfig?: VoiceAgentConfig;
}): Promise<{ ok: boolean; actions: string[]; error?: string }> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { e164: true, settingsJson: true },
  });
  if (!phone?.e164) {
    return { ok: false, actions: [], error: "Phone number not found" };
  }

  const provision = readTelephonyProvisionFromSettings(phone.settingsJson);
  if (!isLiveKitSipProvisionActive(provision)) {
    return { ok: false, actions: [], error: "not_livekit_provisioned" };
  }

  const { ensureNumberProvisioned } = await import("@/lib/telephony/provisioning");
  const result = await ensureNumberProvisioned({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
    agentId: input.agentId,
    publishedVersionId: input.publishedVersionId,
    publishedConfig: input.publishedConfig,
    routingMode: "livekit_sip",
    dispatchMetadataOnly: true,
  });

  if (!result.ok) {
    return { ok: false, actions: result.actions, error: result.error || "dispatch_sync_failed" };
  }
  return { ok: true, actions: result.actions };
}

/**
 * Provision or refresh AI Receptionist ingress on LiveKit SIP (never Voice V3 Basic).
 */
export async function provisionAppointmentReceptionistLiveKit(input: {
  workspaceId: string;
  phoneNumberId: string;
  agentId: string;
  publishedVersionId?: string | null;
  publishedConfig?: VoiceAgentConfig;
  /** Config-only wizard saves: sync dispatch snapshot when already on LiveKit SIP */
  configOnly?: boolean;
}): Promise<EnsureNumberProvisionedResult> {
  if (input.configOnly) {
    const sync = await syncLiveKitDispatchMetadataForPhone(input);
    if (sync.ok) {
      const prisma = getPrisma();
      const phone = await prisma.phoneNumber.findFirst({
        where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
        select: { e164: true, settingsJson: true },
      });
      return {
        ok: true,
        phoneNumberId: input.phoneNumberId,
        e164: phone?.e164 || "",
        routingMode: "livekit_sip",
        provision: readTelephonyProvisionFromSettings(phone?.settingsJson),
        actions: [...sync.actions, "config_only_dispatch_sync"],
      };
    }
    if (sync.error !== "not_livekit_provisioned") {
      return {
        ok: false,
        phoneNumberId: input.phoneNumberId,
        e164: "",
        routingMode: "livekit_sip",
        provision: {},
        actions: sync.actions,
        error: sync.error,
      };
    }
  }

  const { ensureNumberProvisioned } = await import("@/lib/telephony/provisioning");
  return ensureNumberProvisioned({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
    agentId: input.agentId,
    publishedVersionId: input.publishedVersionId,
    publishedConfig: input.publishedConfig,
    routingMode: "livekit_sip",
  });
}
