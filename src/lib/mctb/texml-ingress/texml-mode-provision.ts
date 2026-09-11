import "server-only";

import { getPrisma } from "@/lib/db";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { MCTB_CONSENT_MODE_EXISTING } from "@/lib/mctb/consent-mode";
import { greetingTokenForE164 } from "@/lib/phone/voicemail-active-greeting";
import { routingTokenForE164 } from "@/lib/mctb/texml-ingress/routing-profile";
import { resolveFrozenMctbTexmlAppId } from "./constants";
import { invalidateMctbTexmlIngressCache } from "./config-cache";
import { switchDidToMctbTexmlIngress } from "./provision";
import { frozenMctbTexmlProductionVoiceUrl, mctbTexmlEntryVoiceUrl } from "./texml-route";

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
 * Save-time: apply the **same** frozen TeXML ingress as 866 cert (app + mctb-entry cert=D).
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

  const switchResult = await switchDidToMctbTexmlIngress({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
    preferredTexmlAppId: resolveFrozenMctbTexmlAppId(),
    mctbRole: "customer_mctb",
  });

  const voiceUrl = mctbTexmlEntryVoiceUrl();
  const texmlAppId =
    switchResult.verify.texmlAppId ||
    String((switchResult.texmlRoute as { texmlAppId?: string }).texmlAppId || "");

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
          frozenVoiceUrl: frozenMctbTexmlProductionVoiceUrl(),
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
      frozenVoiceUrl: frozenMctbTexmlProductionVoiceUrl(),
      texmlAppId,
      pipeline: "mctb_texml_final_v1",
      verifyOk: switchResult.verify.ok,
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
