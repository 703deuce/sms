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

const REPAIRABLE_ISSUES = new Set([
  "livekit_trunk_missing_number",
  "dispatch_rule_not_found",
  "dispatch_rule_missing_trunk",
  "telnyx_connection_mismatch",
  "livekit_outbound_trunk_missing",
  "livekit_outbound_trunk_not_found",
  "livekit_outbound_trunk_missing_caller_id",
]);

function issuesAreRepairable(issues: string[]): boolean {
  return issues.some((i) => REPAIRABLE_ISSUES.has(i));
}

/**
 * Verify LiveKit ingress against provider truth; repair when safe.
 */
export async function reconcileAppointmentReceptionistLiveKit(input: {
  workspaceId: string;
  phoneNumberId: string;
  agentId: string;
  publishedVersionId?: string | null;
  publishedConfig?: VoiceAgentConfig;
  configOnly?: boolean;
}): Promise<EnsureNumberProvisionedResult> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { e164: true, settingsJson: true },
  });
  if (!phone?.e164) {
    return {
      ok: false,
      phoneNumberId: input.phoneNumberId,
      e164: "",
      routingMode: "livekit_sip",
      provision: {},
      actions: [],
      error: "Phone number not found",
    };
  }

  const { verifyNumberRouting, repairLiveKitSipRouting, ensureNumberProvisioned } =
    await import("@/lib/telephony/provisioning");

  const stored = readTelephonyProvisionFromSettings(phone.settingsJson);
  const actions: string[] = [];

  if (input.configOnly && isLiveKitSipProvisionActive(stored)) {
    const verify = await verifyNumberRouting({
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
    });
    if (verify.ok) {
      const sync = await syncLiveKitDispatchMetadataForPhone(input);
      if (sync.ok) {
        const refreshed = await prisma.phoneNumber.findFirst({
          where: { id: input.phoneNumberId },
          select: { settingsJson: true },
        });
        return {
          ok: true,
          phoneNumberId: input.phoneNumberId,
          e164: phone.e164,
          routingMode: "livekit_sip",
          provision: readTelephonyProvisionFromSettings(refreshed?.settingsJson),
          actions: [...actions, ...sync.actions, "reconcile_config_only"],
        };
      }
      if (sync.error !== "not_livekit_provisioned") {
        return {
          ok: false,
          phoneNumberId: input.phoneNumberId,
          e164: phone.e164,
          routingMode: "livekit_sip",
          provision: stored,
          actions: [...actions, ...sync.actions],
          error: sync.error,
        };
      }
    } else if (issuesAreRepairable(verify.issues)) {
      actions.push(`verify_issues:${verify.issues.join(",")}`);
    } else if (verify.issues.length === 0) {
      const sync = await syncLiveKitDispatchMetadataForPhone(input);
      if (sync.ok) {
        return {
          ok: true,
          phoneNumberId: input.phoneNumberId,
          e164: phone.e164,
          routingMode: "livekit_sip",
          provision: stored,
          actions: [...actions, ...sync.actions],
        };
      }
    }
  }

  let verify = await verifyNumberRouting({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
  });

  if (!verify.ok && isLiveKitSipProvisionActive(stored) && issuesAreRepairable(verify.issues)) {
    try {
      const repaired = await repairLiveKitSipRouting({
        workspaceId: input.workspaceId,
        phoneNumberId: input.phoneNumberId,
        agentId: input.agentId,
      });
      actions.push(...repaired.actions, "reconcile_repair_livekit");
      if (repaired.provision.ok) {
        verify = await verifyNumberRouting({
          workspaceId: input.workspaceId,
          phoneNumberId: input.phoneNumberId,
        });
        if (verify.ok) {
          return {
            ...repaired.provision,
            actions: [...actions, ...repaired.provision.actions],
          };
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      actions.push(`reconcile_repair_failed:${message}`);
    }
  }

  if (verify.ok && isLiveKitSipProvisionActive(stored)) {
    const sync = await syncLiveKitDispatchMetadataForPhone(input);
    if (sync.ok) {
      const refreshed = await prisma.phoneNumber.findFirst({
        where: { id: input.phoneNumberId },
        select: { settingsJson: true },
      });
      return {
        ok: true,
        phoneNumberId: input.phoneNumberId,
        e164: phone.e164,
        routingMode: "livekit_sip",
        provision: readTelephonyProvisionFromSettings(refreshed?.settingsJson),
        actions: [...actions, ...sync.actions, "reconcile_verify_ok_dispatch_sync"],
      };
    }
  }

  const provisioned = await ensureNumberProvisioned({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
    agentId: input.agentId,
    publishedVersionId: input.publishedVersionId,
    publishedConfig: input.publishedConfig,
    routingMode: "livekit_sip",
  });
  actions.push(...provisioned.actions);

  if (!provisioned.ok) {
    return { ...provisioned, actions };
  }

  verify = await verifyNumberRouting({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
  });
  if (!verify.ok) {
    return {
      ok: false,
      phoneNumberId: input.phoneNumberId,
      e164: phone.e164,
      routingMode: "livekit_sip",
      provision: provisioned.provision,
      actions: [...actions, `verify_after_provision:${verify.issues.join(",")}`],
      error: `LiveKit routing verification failed: ${verify.issues.join(", ") || "unknown"}`,
    };
  }

  return { ...provisioned, actions };
}

/**
 * Provision or refresh AI Receptionist ingress on LiveKit SIP (never Voice V3 Basic).
 */
export async function provisionAppointmentReceptionistLiveKit(
  input: {
    workspaceId: string;
    phoneNumberId: string;
    agentId: string;
    publishedVersionId?: string | null;
    publishedConfig?: VoiceAgentConfig;
    configOnly?: boolean;
  },
): Promise<EnsureNumberProvisionedResult> {
  return reconcileAppointmentReceptionistLiveKit(input);
}
