import "server-only";

import { getPrisma } from "@/lib/db";
import { updateMissedCallTextConfig, loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { setActiveCallHandler } from "@/lib/call-handling/set-active-call-handler";
import { ensureMctbPlatformSenderDefault } from "@/lib/mctb/ensure-platform-sender-default";
import {
  getTrialNumberStatus,
} from "@/lib/mctb/onboarding/trial-number";
import {
  loadMctbOnboardingState,
  markStepComplete,
  recordFunnelEvent,
  saveMctbOnboardingState,
} from "@/lib/mctb/onboarding/state";
import type { MctbTrialNumberInfo } from "@/lib/mctb/onboarding/types";
import { MCTB_TRIAL_TOLL_FREE_AREA_CODES } from "@/lib/mctb/onboarding/constants";
import { routePhoneToMctbCallHandlingIngress } from "@/lib/mctb/texml-ingress/provision";
import { verifyMctbTexmlIngressRoute } from "@/lib/mctb/texml-ingress/texml-route";
import { messagingOnboarding } from "@/lib/messaging/service";
import { telnyxProvider } from "@/lib/messaging/telnyx/provider";
import {
  parseMctbPhoneRole,
  tollFreeComplianceSettings,
} from "@/lib/messaging/compliance/phone-number-class";
import { importTelnyxNumbersIntoWorkspace } from "@/lib/voice/telnyx/number-import";
import {
  isNorthAmericaTollFreeE164,
  isPreferredMctbIngressTollFreeE164,
  pickTelnyxTollFreeIngressE164,
} from "@/lib/mctb/provisioning/telnyx-toll-free-ingress-pool";
import {
  clearMctbIngressProvisionPendingE164,
  readMctbIngressProvisionPendingE164,
  writeMctbIngressProvisionPendingE164,
  withMctbWorkspaceIngressProvisionLock,
} from "@/lib/mctb/provisioning/workspace-ingress-provision-lock";

export type ProvisionMctbWorkspaceTollFreeIngressResult = {
  ok: boolean;
  trialNumber?: MctbTrialNumberInfo;
  e164?: string;
  phoneNumberId?: string;
  error?: string;
  source?: "existing" | "pool" | "purchased";
};

async function workspaceIngressAlreadyReady(
  workspaceId: string,
): Promise<{ ready: boolean; phoneNumberId?: string; e164?: string }> {
  const status = await getTrialNumberStatus(workspaceId);
  const e164 = status.trialNumber?.e164;
  const phoneNumberId = status.trialNumber?.phoneNumberId;
  if (!status.provisioned || !e164 || !phoneNumberId) {
    return { ready: false };
  }
  if (!isNorthAmericaTollFreeE164(e164)) {
    return { ready: false };
  }

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
    select: { e164: true, providerNumberId: true, provider: true, settingsJson: true },
  });
  if (!phone?.providerNumberId || String(phone.provider || "").toLowerCase() !== "telnyx") {
    return { ready: false };
  }
  if (parseMctbPhoneRole(phone.settingsJson) === "platform_mctb_sender") {
    return { ready: false };
  }

  const runtime = await loadMissedCallTextConfig(workspaceId);
  if (runtime.phoneNumberId !== phoneNumberId) {
    return { ready: false };
  }

  const verify = await verifyMctbTexmlIngressRoute({
    e164: phone.e164,
    providerNumberId: phone.providerNumberId,
  });
  return verify.ok ? { ready: true, phoneNumberId, e164: phone.e164 } : { ready: false };
}

async function purchaseTelnyxTollFree(workspaceId: string): Promise<string | null> {
  await messagingOnboarding.start(workspaceId).catch(() => undefined);
  for (const areaCode of MCTB_TRIAL_TOLL_FREE_AREA_CODES) {
    try {
      const results = await telnyxProvider.searchNumbers(areaCode);
      const candidate = results.find((n) => isPreferredMctbIngressTollFreeE164(n.phoneNumber))
        ?.phoneNumber;
      if (!candidate) continue;
      await messagingOnboarding.purchaseNumber(workspaceId, candidate, "telnyx");
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Same production model as ws_1: workspace-owned Telnyx toll-free CFNA target on frozen MCTB TeXML.
 * SMS recovery uses PLATFORM sender (not the ingress TFN).
 */
export async function provisionMctbWorkspaceTollFreeIngress(
  workspaceId: string,
): Promise<ProvisionMctbWorkspaceTollFreeIngressResult> {
  return withMctbWorkspaceIngressProvisionLock(workspaceId, () =>
    provisionMctbWorkspaceTollFreeIngressLocked(workspaceId),
  );
}

async function provisionMctbWorkspaceTollFreeIngressLocked(
  workspaceId: string,
): Promise<ProvisionMctbWorkspaceTollFreeIngressResult> {
  const existing = await workspaceIngressAlreadyReady(workspaceId);
  if (existing.ready && existing.phoneNumberId && existing.e164) {
    return {
      ok: true,
      source: "existing",
      phoneNumberId: existing.phoneNumberId,
      e164: existing.e164,
      trialNumber: {
        e164: existing.e164,
        phoneNumberId: existing.phoneNumberId,
        provider: "telnyx",
        numberType: "toll_free",
        voiceStatus: "ready",
        messagingVerificationStatus: "not_started",
        provisionedAt: new Date().toISOString(),
      },
    };
  }

  let e164 = await readMctbIngressProvisionPendingE164(workspaceId);
  let source: ProvisionMctbWorkspaceTollFreeIngressResult["source"] = e164
    ? "purchased"
    : undefined;

  if (!e164) {
    e164 = await pickTelnyxTollFreeIngressE164(workspaceId);
    source = e164 ? "pool" : undefined;
  }

  if (!e164) {
    e164 = await purchaseTelnyxTollFree(workspaceId);
    source = e164 ? "purchased" : undefined;
    if (e164) {
      await writeMctbIngressProvisionPendingE164(workspaceId, e164);
    }
  }

  if (!e164) {
    return { ok: false, error: "no_telnyx_toll_free_available" };
  }

  const prisma = getPrisma();

  await importTelnyxNumbersIntoWorkspace({
    workspaceId,
    e164s: [e164],
    attachConnection: false,
  });

  let phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId, e164 },
    select: { id: true, e164: true, providerNumberId: true, settingsJson: true },
  });

  if (!phone?.providerNumberId) {
    return { ok: false, error: "ingress_phone_row_missing" };
  }
  if (parseMctbPhoneRole(phone.settingsJson) === "platform_mctb_sender") {
    return { ok: false, error: "refuse_platform_sender_as_ingress" };
  }

  if (source === "purchased") {
    await prisma.phoneNumber.update({
      where: { id: phone.id },
      data: {
        settingsJson: {
          ...(phone.settingsJson && typeof phone.settingsJson === "object"
            ? (phone.settingsJson as object)
            : {}),
          ...tollFreeComplianceSettings(),
          mctbSipIngress: true,
          mctbRole: "customer_mctb",
        } as object,
      },
    });
  }

  const route = await routePhoneToMctbCallHandlingIngress({
    workspaceId,
    phoneNumberId: phone.id,
    friendlyName: `MCTB ingress ${workspaceId}`,
    mctbRole: "customer_mctb",
  });

  if (!route.verify.ok) {
    return {
      ok: false,
      error: route.verify.failReason || "mctb_texml_route_failed",
      e164: phone.e164,
      phoneNumberId: phone.id,
    };
  }

  await updateMissedCallTextConfig({
    workspaceId,
    patch: { phone_number_id: phone.id },
    source: "mctb_toll_free_ingress",
  });

  await setActiveCallHandler({
    workspaceId,
    voiceIngressPhoneNumberId: phone.id,
    handler: "mctb",
  });

  await ensureMctbPlatformSenderDefault(workspaceId).catch(() => undefined);

  const info: MctbTrialNumberInfo = {
    e164: phone.e164,
    phoneNumberId: phone.id,
    provider: "telnyx",
    numberType: "toll_free",
    voiceStatus: "ready",
    messagingVerificationStatus: "not_started",
    provisionedAt: new Date().toISOString(),
  };

  const state = await loadMctbOnboardingState(workspaceId);
  const nextState = markStepComplete(
    {
      ...state,
      workspaceTollFreeNumber: info,
      trialNumber: info,
    },
    "trial_number",
  );
  await saveMctbOnboardingState(workspaceId, nextState);

  const { provisionMctbPhoneTexmlIngressModeForWorkspace } = await import(
    "@/lib/mctb/texml-ingress/texml-mode-provision"
  );
  const { warmMctbInboundRoutingProfileForWorkspace } = await import(
    "@/lib/mctb/texml-ingress/routing-profile"
  );
  const { initMctbConsentPromptForWorkspace } = await import("@/lib/mctb/consent-prompt/service");

  await provisionMctbPhoneTexmlIngressModeForWorkspace(workspaceId, phone.id).catch(() => undefined);
  await warmMctbInboundRoutingProfileForWorkspace(workspaceId).catch(() => undefined);
  await initMctbConsentPromptForWorkspace(workspaceId).catch(() => undefined);

  await recordFunnelEvent(workspaceId, "MCTB_TRIAL_NUMBER_PROVISIONED", {
    e164: phone.e164,
    phoneNumberId: phone.id,
    provider: "telnyx",
    routing: "mctb_texml_toll_free",
    source,
  });

  await clearMctbIngressProvisionPendingE164(workspaceId).catch(() => undefined);

  phone = await prisma.phoneNumber.findFirst({
    where: { id: phone.id },
    select: { id: true, e164: true },
  });

  return {
    ok: true,
    source,
    trialNumber: info,
    e164: phone?.e164 ?? info.e164,
    phoneNumberId: phone?.id ?? info.phoneNumberId,
  };
}
