import "server-only";

import { getPrisma } from "@/lib/db";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { MCTB_CONSENT_MODE_EXISTING } from "@/lib/mctb/consent-mode";
import { greetingTokenForE164 } from "@/lib/phone/voicemail-active-greeting";
import { routingTokenForE164 } from "@/lib/mctb/texml-ingress/routing-profile";
import { getTelnyxWebhookUrls } from "@/lib/messaging/telnyx/config";
import { invalidateMctbTexmlIngressCache } from "./config-cache";
import { ensureMctbTexmlApplicationAtVoiceUrl, routePhoneToTexmlApp } from "./texml-route";

export type MctbTexmlHandlerMode = "press_1" | "voicemail";

/** Which dedicated TeXML handler the DID should hit — decided at Save, not on ring. */
export function resolveMctbTexmlHandlerMode(input: {
  consentMode: MctbConsentMode;
  automationActive: boolean;
}): MctbTexmlHandlerMode {
  if (input.consentMode === MCTB_CONSENT_MODE_EXISTING) return "voicemail";
  if (!input.automationActive) return "voicemail";
  return "press_1";
}

export function buildMctbTexmlVoiceUrlForHandler(
  mode: MctbTexmlHandlerMode,
  e164: string,
): string {
  const urls = getTelnyxWebhookUrls();
  const g = greetingTokenForE164(e164);
  const r = routingTokenForE164(e164);

  if (mode === "voicemail") {
    const url = new URL(urls.mctbVoicemail);
    url.searchParams.set("g", g);
    url.searchParams.set("r", r);
    return url.toString();
  }

  const url = new URL(urls.mctbPress1);
  url.searchParams.set("r", r);
  return url.toString();
}

function preferredAppIdForMode(mode: MctbTexmlHandlerMode): string | null {
  if (mode === "voicemail") {
    return process.env.MCTB_TEXML_VOICEMAIL_APP_ID?.trim() || null;
  }
  return process.env.MCTB_TEXML_PRESS1_APP_ID?.trim() || null;
}

/**
 * Save-time: point DID at dedicated press-1 or voicemail TeXML app (not shared mctb-entry).
 */
export async function provisionMctbPhoneTexmlIngressMode(input: {
  workspaceId: string;
  phoneNumberId: string;
  consentMode: MctbConsentMode;
  automationActive: boolean;
}): Promise<{
  handlerMode: MctbTexmlHandlerMode;
  voiceUrl: string;
  texmlAppId: string;
  e164: string;
}> {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { id: true, e164: true, providerNumberId: true, settingsJson: true },
  });
  if (!phone?.e164 || !phone.providerNumberId) {
    throw new Error("MCTB phone not found or missing providerNumberId");
  }

  const handlerMode = resolveMctbTexmlHandlerMode({
    consentMode: input.consentMode,
    automationActive: input.automationActive,
  });
  const voiceUrl = buildMctbTexmlVoiceUrlForHandler(handlerMode, phone.e164);
  const friendlyName =
    handlerMode === "voicemail" ? "MCTB Voicemail TeXML" : "MCTB Press-1 TeXML";

  const texmlAppId = await ensureMctbTexmlApplicationAtVoiceUrl({
    voiceUrl,
    friendlyName,
    preferredAppId: preferredAppIdForMode(handlerMode),
  });

  await routePhoneToTexmlApp({
    e164: phone.e164,
    providerNumberId: phone.providerNumberId,
    texmlAppId,
  });

  const settings =
    phone.settingsJson && typeof phone.settingsJson === "object"
      ? (phone.settingsJson as Record<string, unknown>)
      : {};
  const mctbInbound =
    settings.mctbInbound && typeof settings.mctbInbound === "object"
      ? (settings.mctbInbound as Record<string, unknown>)
      : {};

  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: {
      settingsJson: {
        ...settings,
        mctbInbound: {
          ...mctbInbound,
          texmlHandlerMode: handlerMode,
          texmlVoiceUrl: voiceUrl,
          texmlAppId,
          greetingToken: greetingTokenForE164(phone.e164),
          routingToken: routingTokenForE164(phone.e164),
        },
      },
    },
  });

  invalidateMctbTexmlIngressCache(phone.e164);

  console.log(
    JSON.stringify({
      source: "mctb-texml-mode-provision",
      event: "handler_routed",
      workspaceId: input.workspaceId,
      phoneNumberId: phone.id,
      e164: phone.e164,
      handlerMode,
      voiceUrl,
      texmlAppId,
    }),
  );

  return {
    handlerMode,
    voiceUrl,
    texmlAppId,
    e164: phone.e164,
  };
}

export async function provisionMctbPhoneTexmlIngressModeForWorkspace(
  workspaceId: string,
  phoneNumberId?: string | null,
): Promise<Awaited<ReturnType<typeof provisionMctbPhoneTexmlIngressMode>> | null> {
  const { loadMissedCallTextConfig } = await import("@/lib/agents/missed-call-text-back/config");
  const { loadMctbConsentMode } = await import("@/lib/mctb/consent-prompt/service");
  const { loadMctbScheduleSettings, isMctbAutomationActive } = await import("@/lib/mctb/schedule");

  const runtime = await loadMissedCallTextConfig(workspaceId);
  const pid = phoneNumberId?.trim() || runtime.phoneNumberId;
  if (!pid) return null;

  const [consentMode, scheduleSettings] = await Promise.all([
    loadMctbConsentMode(workspaceId),
    loadMctbScheduleSettings(workspaceId, runtime),
  ]);
  const automationActive = isMctbAutomationActive(scheduleSettings, runtime);

  return provisionMctbPhoneTexmlIngressMode({
    workspaceId,
    phoneNumberId: pid,
    consentMode,
    automationActive,
  });
}
