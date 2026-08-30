import "server-only";

import { getPrisma } from "@/lib/db";
import { activateJohnOnPhoneNumber } from "@/lib/agents/missed-call-text-back/phone-switch";
import { telnyxLocalA2pSettings } from "@/lib/messaging/compliance/phone-number-class";
import { enqueueMessagingRegistrationAdvance } from "@/lib/messaging/enqueue-advance";
import { clearMctbSipIngressCache } from "@/lib/mctb/sip-ingress/resolver";
import { invalidateMctbTexmlIngressCache } from "@/lib/mctb/texml-ingress/config-cache";
import { isWorkspaceAuthorizedForPlatformDemoNumber } from "@/lib/mctb/platform-demo-access";
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
 * Idempotent Telnyx voice ingress for MCTB — frozen TeXML pipeline (mctb_texml_final_v1):
 * route DID → shared TeXML app → POST /api/telnyx/voice/mctb-entry
 */
export async function provisionMctbTelnyxSipIngress(input: {
  workspaceId: string;
  phoneNumberId: string;
  messageTemplate?: string;
  delaySeconds?: number;
  /** platform_demo = shared Try It DID; customer_mctb = paid production DID */
  mctbRole?: "platform_demo" | "customer_mctb";
}): Promise<ProvisionMctbTelnyxSipIngressResult> {
  const prisma = getPrisma();
  let phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: {
      id: true,
      e164: true,
      provider: true,
      providerNumberId: true,
      settingsJson: true,
      status: true,
      workspaceId: true,
    },
  });

  if (!phone) {
    const candidate = await prisma.phoneNumber.findFirst({
      where: { id: input.phoneNumberId },
      select: {
        id: true,
        e164: true,
        provider: true,
        providerNumberId: true,
        settingsJson: true,
        status: true,
        workspaceId: true,
      },
    });
    if (
      candidate &&
      (await isWorkspaceAuthorizedForPlatformDemoNumber(input.workspaceId))
    ) {
      phone = candidate;
    }
  }

  if (!phone?.e164) {
    return {
      ok: false,
      phoneNumberId: input.phoneNumberId,
      e164: "",
      actions: [],
      error: "phone_not_found",
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

  const actions = ["mctb_texml_ingress_tagged"];

  try {
    const routed = await switchDidToMctbTexmlIngress({
      workspaceId: input.workspaceId,
      phoneNumberId: phone.id,
      friendlyName: role === "platform_demo" ? "MCTB Platform Demo" : `MCTB ${phone.e164}`,
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

  await activateJohnOnPhoneNumber({
    workspaceId: input.workspaceId,
    phoneNumberId: phone.id,
    smsPhoneNumberId: phone.id,
    delaySeconds: input.delaySeconds ?? 0,
    messageTemplate: input.messageTemplate,
    skipGenericVoiceProvision: true,
  }).catch(() => undefined);

  await enqueueMessagingRegistrationAdvance(input.workspaceId).catch(() => undefined);
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
