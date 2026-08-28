import "server-only";

import { getPrisma } from "@/lib/db";
import { activateJohnOnPhoneNumber } from "@/lib/agents/missed-call-text-back/phone-switch";
import { telnyxLocalA2pSettings } from "@/lib/messaging/compliance/phone-number-class";
import { enqueueMessagingRegistrationAdvance } from "@/lib/messaging/enqueue-advance";
import { clearMctbSipIngressCache } from "@/lib/mctb/sip-ingress/resolver";
import { isWorkspaceAuthorizedForPlatformDemoNumber } from "@/lib/mctb/platform-demo-access";
import {
  assignPhoneNumberToEventOnlyConnection,
  ensureMctb571EventOnlyCallControlApplication,
} from "@/lib/mctb/consent-prompt/telnyx-event-only-route";
import {
  isPlatform571E164,
  route571ToMctbConsentTexml,
} from "@/lib/mctb/consent-prompt/telnyx-texml-route";

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
 * Idempotent Telnyx voice ingress for MCTB.
 * - Platform 571 (+15714073615): TeXML consent (instant answer for AT&T carrier forwards).
 * - Other DIDs (866 test, customer): Call Control event-only → mctb-event-only.
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
  const useTexmlConsent = isPlatform571E164(phone.e164);
  const mctbSettings = telnyxLocalA2pSettings({
    role: role === "platform_demo" ? "platform_demo" : "customer_production",
  });
  const nextSettings = mergeSettings(phone.settingsJson, {
    ...mctbSettings,
    mctbSipIngress: true,
    mctbRole: role,
    routingOwner: useTexmlConsent ? "mctb_texml" : "mctb_call_control",
  });

  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: { settingsJson: nextSettings as object },
  });

  const actions = ["mctb_sip_ingress_tagged"];

  try {
    const settings =
      nextSettings && typeof nextSettings === "object"
        ? { ...nextSettings }
        : ({} as Record<string, unknown>);
    const telephony =
      settings.telephony && typeof settings.telephony === "object"
        ? { ...(settings.telephony as Record<string, unknown>) }
        : {};

    if (useTexmlConsent) {
      const providerNumberId = String(phone.providerNumberId || "").trim();
      if (!providerNumberId) {
        throw new Error("missing_telnyx_provider_number_id");
      }
      const routed = await route571ToMctbConsentTexml(providerNumberId);
      actions.push(
        `texml_consent_assigned:${routed.texmlAppId}`,
        `texml_voice_url:${routed.voiceUrl}`,
      );
      telephony.routingMode = "texml_consent";
      telephony.telnyxTexmlAppId = routed.texmlAppId;
      telephony.lastProvisionedAt = new Date().toISOString();
      telephony.state = "active";
      telephony.lastError = null;
    } else {
      await ensureMctb571EventOnlyCallControlApplication();
      const assigned = await assignPhoneNumberToEventOnlyConnection(phone.e164);
      actions.push(
        `call_control_event_only_assigned:${assigned.callControlAppId}`,
        `telnyx_connection:${assigned.liveConnectionId}`,
      );
      telephony.routingMode = "call_control_event_only";
      telephony.telnyxCallControlAppId = assigned.callControlAppId;
      telephony.lastProvisionedAt = new Date().toISOString();
      telephony.state = "active";
      telephony.lastError = null;
    }

    settings.telephony = telephony;

    await prisma.phoneNumber.update({
      where: { id: phone.id },
      data: { settingsJson: settings as object },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      phoneNumberId: phone.id,
      e164: phone.e164,
      actions,
      error: message || "voice_provision_failed",
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

  actions.push("mctb_john_activated");

  return {
    ok: true,
    phoneNumberId: phone.id,
    e164: phone.e164,
    actions,
  };
}
