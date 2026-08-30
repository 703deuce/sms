import "server-only";

import { getPrisma } from "@/lib/db";
import { activateJohnOnPhoneNumber } from "@/lib/agents/missed-call-text-back/phone-switch";
import { telnyxLocalA2pSettings } from "@/lib/messaging/compliance/phone-number-class";
import { enqueueMessagingRegistrationAdvance } from "@/lib/messaging/enqueue-advance";
import {
  assertMctbProvisionPhoneInWorkspace,
  MCTB_CANONICAL_PROVISION_ENTRY,
} from "@/lib/mctb/provision-policy";
import { clearMctbSipIngressCache } from "@/lib/mctb/sip-ingress/resolver";
import { invalidateMctbTexmlIngressCache } from "@/lib/mctb/texml-ingress/config-cache";
import {
  MCTB_TEXML_ROUTING_OWNER,
} from "@/lib/mctb/texml-ingress/constants";
import { switchDidToMctbTexmlIngress } from "@/lib/mctb/texml-ingress/provision";

function mergeSettings(
  current: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...patch };
}

export type ProvisionMctbTelnyxSipIngressResult = {
  ok: boolean;
  phoneNumberId: string;
  e164: string;
  actions: string[];
  error?: string;
};

/**
 * Canonical MCTB voice provision — frozen TeXML pipeline (mctb_texml_final_v1).
 * Route DID → shared TeXML app → POST /api/telnyx/voice/mctb-entry.
 * This is the only supported MCTB voice provision entry point.
 */
export async function provisionMctbCustomerVoice(input: {
  workspaceId: string;
  phoneNumberId: string;
  messageTemplate?: string;
  delaySeconds?: number;
  /** platform_demo = shared Try It DID; customer_mctb = paid production DID */
  mctbRole?: "platform_demo" | "customer_mctb";
  /** When false, route TeXML but do not force-enable runtime (number switch). */
  activate?: boolean;
}): Promise<ProvisionMctbTelnyxSipIngressResult> {
  const prisma = getPrisma();
  let phone;
  try {
    phone = await assertMctbProvisionPhoneInWorkspace({
      workspaceId: input.workspaceId,
      phoneNumberId: input.phoneNumberId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      phoneNumberId: input.phoneNumberId,
      e164: "",
      actions: [],
      error: message || "phone_not_found",
    };
  }

  if (String(phone.provider || "").toLowerCase() !== "telnyx") {
    return {
      ok: false,
      phoneNumberId: phone.id,
      e164: phone.e164,
      actions: [],
      error: "not_telnyx_number",
    };
  }

  const role = input.mctbRole || "customer_mctb";
  const mctbSettings = telnyxLocalA2pSettings({
    role: role === "platform_demo" ? "platform_demo" : "customer_production",
  });
  const nextSettings = mergeSettings(phone.settingsJson, {
    ...mctbSettings,
    mctbSipIngress: true,
    mctbRole: role,
    routingOwner: MCTB_TEXML_ROUTING_OWNER,
  });

  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: { settingsJson: nextSettings as object },
  });

  const actions = [MCTB_CANONICAL_PROVISION_ENTRY, "mctb_texml_ingress_tagged"];

  try {
    const provisionWorkspaceId = phone.workspaceId;
    const routed = await switchDidToMctbTexmlIngress({
      workspaceId: provisionWorkspaceId,
      phoneNumberId: phone.id,
      friendlyName: role === "platform_demo" ? "MCTB Platform Demo" : `MCTB ${phone.e164}`,
      mctbRole: role,
    });
    actions.push(
      `mctb_texml_app:${String((routed.texmlRoute as { texmlAppId?: string }).texmlAppId || "")}`,
      `mctb_texml_route:${routed.verify.ok ? "verified" : "unverified"}`,
      routed.e164,
    );

    if (!routed.ok || !routed.verify.ok) {
      throw new Error(routed.verify.failReason || "mctb_texml_route_failed");
    }

    await prisma.voiceAgent.updateMany({
      where: { phoneNumberId: phone.id, status: "ACTIVE" },
      data: { phoneNumberId: null },
    });

    const { pauseLegacyMctbSmartRoutingFlows } = await import(
      "@/lib/mctb/consent-prompt/service"
    );
    await pauseLegacyMctbSmartRoutingFlows(input.workspaceId, {
      activePhoneNumberId: phone.id,
    }).catch(() => undefined);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      phoneNumberId: phone.id,
      e164: phone.e164,
      actions,
      error: message || "mctb_texml_provision_failed",
    };
  }

  const { loadMissedCallTextConfig } = await import("@/lib/agents/missed-call-text-back/config");
  const { loadMctbScheduleSettings, isMctbSchedulePaused } = await import("@/lib/mctb/schedule");
  const runtimeConfig = await loadMissedCallTextConfig(input.workspaceId);
  const scheduleSettings = await loadMctbScheduleSettings(input.workspaceId, runtimeConfig);
  const paused = isMctbSchedulePaused(scheduleSettings, runtimeConfig);

  const shouldActivate = input.activate === true && !paused;

  await activateJohnOnPhoneNumber({
    workspaceId: input.workspaceId,
    phoneNumberId: phone.id,
    smsPhoneNumberId: phone.id,
    delaySeconds: input.delaySeconds ?? 0,
    messageTemplate: input.messageTemplate,
    skipGenericVoiceProvision: true,
    activate: shouldActivate,
  }).catch(() => undefined);

  await enqueueMessagingRegistrationAdvance(input.workspaceId).catch(() => undefined);

  const { repairMessagingOnWorkspaceNumber } = await import("@/lib/phone/telnyx-dual-provision");
  await repairMessagingOnWorkspaceNumber({
    workspaceId: input.workspaceId,
    phoneNumberId: phone.id,
  }).catch(() => undefined);

  clearMctbSipIngressCache();
  invalidateMctbTexmlIngressCache(phone.e164);

  actions.push("mctb_john_activated");

  return {
    ok: true,
    phoneNumberId: phone.id,
    e164: phone.e164,
    actions,
  };
}

/** @deprecated Use provisionMctbCustomerVoice — sole supported MCTB voice provision path. */
export const provisionMctbTelnyxSipIngress = provisionMctbCustomerVoice;
