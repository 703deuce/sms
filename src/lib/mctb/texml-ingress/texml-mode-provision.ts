import "server-only";

import { getPrisma } from "@/lib/db";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { MCTB_CONSENT_MODE_EXISTING } from "@/lib/mctb/consent-mode";
import { greetingTokenForE164 } from "@/lib/phone/voicemail-active-greeting";
import { routingTokenForE164 } from "@/lib/mctb/texml-ingress/routing-profile";
import { MCTB_TEXML_DEFAULT_APP_ID } from "./constants";
import { invalidateMctbTexmlIngressCache } from "./config-cache";
import {
  ensureMctbTexmlApplication,
  mctbTexmlEntryVoiceUrl,
  routePhoneToTexmlApp,
} from "./texml-route";

export type MctbTexmlHandlerMode = "press_1" | "voicemail";

/** Runtime branch inside mctb-entry — not a separate Telnyx voice_url. */
export function resolveMctbTexmlHandlerMode(input: {
  consentMode: MctbConsentMode;
  automationActive: boolean;
}): MctbTexmlHandlerMode {
  if (input.consentMode === MCTB_CONSENT_MODE_EXISTING) return "voicemail";
  if (!input.automationActive) return "voicemail";
  return "press_1";
}

/**
 * Save-time: point DID at the **frozen** certified MCTB TeXML ingress (same as 866).
 * @see docs/MCTB_FINAL_PRODUCTION_PIPELINE.md — app 3037587396909598261 + mctb-entry
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
  const voiceUrl = mctbTexmlEntryVoiceUrl();
  const texmlAppId = await ensureMctbTexmlApplication({
    friendlyName: "MCTB TeXML Ingress",
    preferredAppId:
      process.env.MCTB_TEXML_APP_ID?.trim() || MCTB_TEXML_DEFAULT_APP_ID,
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

  const ws = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { customFieldsConfig: true },
  });
  const mctbCfg =
    ws?.customFieldsConfig &&
    typeof ws.customFieldsConfig === "object" &&
    (ws.customFieldsConfig as Record<string, unknown>).mctb &&
    typeof (ws.customFieldsConfig as Record<string, unknown>).mctb === "object"
      ? ((ws.customFieldsConfig as Record<string, unknown>).mctb as Record<string, unknown>)
      : {};
  const consentConfigRevision =
    typeof mctbCfg.consentConfigRevision === "string" && mctbCfg.consentConfigRevision.trim()
      ? mctbCfg.consentConfigRevision.trim()
      : `ccfg_${Date.now()}`;

  await prisma.phoneNumber.update({
    where: { id: phone.id },
    data: {
      settingsJson: {
        ...settings,
        mctbInbound: {
          ...mctbInbound,
          texmlHandlerMode: handlerMode,
          consentMode: input.consentMode,
          consentConfigRevision,
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
      event: "frozen_ingress_routed",
      workspaceId: input.workspaceId,
      phoneNumberId: phone.id,
      e164: phone.e164,
      handlerMode,
      voiceUrl,
      texmlAppId,
      pipeline: "mctb_texml_final_v1",
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
