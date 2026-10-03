import "server-only";

import { getPrisma } from "@/lib/db";
import { updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { setActiveCallHandler } from "@/lib/call-handling/set-active-call-handler";
import { ensureMctbPlatformSenderDefault } from "@/lib/mctb/ensure-platform-sender-default";
import {
  loadMctbOnboardingState,
  markStepComplete,
  recordFunnelEvent,
  saveMctbOnboardingState,
} from "@/lib/mctb/onboarding/state";
import type { MctbTrialNumberInfo } from "@/lib/mctb/onboarding/types";
import { routePhoneToMctbCallHandlingIngress } from "@/lib/mctb/texml-ingress/provision";
import { verifyMctbTexmlIngressRoute } from "@/lib/mctb/texml-ingress/texml-route";
import { assessWorkspaceDedicatedMctbIngress } from "@/lib/mctb/provisioning/workspace-ingress-validity";
import { purchaseTelnyxTollFreeForMctbIngress } from "@/lib/mctb/provisioning/purchase-telnyx-toll-free-ingress";
import {
  isPlatformMctbSenderPhoneRecord,
  parseMctbPhoneRole,
  tollFreeComplianceSettings,
} from "@/lib/messaging/compliance/phone-number-class";
import { importTelnyxNumbersIntoWorkspace } from "@/lib/voice/telnyx/number-import";
import {
  isNorthAmericaTollFreeE164,
  pickTelnyxTollFreeIngressE164,
} from "@/lib/mctb/provisioning/telnyx-toll-free-ingress-pool";
import {
  clearMctbIngressProvisionPendingE164,
  readMctbIngressProvisionPendingE164,
  writeMctbIngressProvisionPendingE164,
  withMctbWorkspaceIngressProvisionLock,
} from "@/lib/mctb/provisioning/workspace-ingress-provision-lock";
import { syncCanonicalMctbWorkspaceIngress } from "@/lib/mctb/provisioning/sync-canonical-workspace-ingress";

export type ProvisionMctbWorkspaceTollFreeIngressResult = {
  ok: boolean;
  trialNumber?: MctbTrialNumberInfo;
  e164?: string;
  phoneNumberId?: string;
  error?: string;
  source?: "existing" | "pool" | "purchased";
};

/** Injectable boundaries for automated provisioning proofs (tests only). */
export type MctbTollFreeIngressProvisionTestDeps = {
  pickTelnyxTollFreeIngressE164?: (workspaceId: string) => Promise<string | null>;
  purchaseTelnyxTollFree?: (workspaceId: string) => Promise<string | null>;
  importTelnyxNumbersIntoWorkspace?: typeof importTelnyxNumbersIntoWorkspace;
  routePhoneToMctbCallHandlingIngress?: typeof routePhoneToMctbCallHandlingIngress;
  verifyMctbTexmlIngressRoute?: typeof verifyMctbTexmlIngressRoute;
  setActiveCallHandler?: typeof setActiveCallHandler;
};

let tollFreeIngressProvisionTestDeps: MctbTollFreeIngressProvisionTestDeps | null = null;

export function setMctbTollFreeIngressProvisionTestDeps(
  deps: MctbTollFreeIngressProvisionTestDeps | null,
): void {
  tollFreeIngressProvisionTestDeps = deps;
}

export function getMctbTollFreeIngressProvisionTestDeps(): MctbTollFreeIngressProvisionTestDeps | null {
  return tollFreeIngressProvisionTestDeps;
}

async function workspaceIngressAlreadyReady(
  workspaceId: string,
): Promise<{ ready: boolean; phoneNumberId?: string; e164?: string }> {
  const assessment = await assessWorkspaceDedicatedMctbIngress(workspaceId);
  if (!assessment.valid || !assessment.phoneNumberId || !assessment.e164) {
    return { ready: false };
  }
  return {
    ready: true,
    phoneNumberId: assessment.phoneNumberId,
    e164: assessment.e164,
  };
}

async function purchaseTelnyxTollFreeDefault(workspaceId: string): Promise<string | null> {
  return purchaseTelnyxTollFreeForMctbIngress(workspaceId);
}

async function purchaseTelnyxTollFree(workspaceId: string): Promise<string | null> {
  const fn =
    tollFreeIngressProvisionTestDeps?.purchaseTelnyxTollFree ?? purchaseTelnyxTollFreeDefault;
  return fn(workspaceId);
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
  await syncCanonicalMctbWorkspaceIngress(workspaceId).catch(() => undefined);
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

  const prisma = getPrisma();

  if (!e164) {
    const pickFn =
      tollFreeIngressProvisionTestDeps?.pickTelnyxTollFreeIngressE164 ??
      pickTelnyxTollFreeIngressE164;
    e164 = await pickFn(workspaceId);
    source = e164 ? "pool" : undefined;
    if (e164) {
      const pickedRow = await prisma.phoneNumber.findFirst({
        where: { workspaceId, e164 },
        select: { settingsJson: true },
      });
      if (
        pickedRow &&
        isPlatformMctbSenderPhoneRecord({ settingsJson: pickedRow.settingsJson })
      ) {
        e164 = null;
        source = undefined;
      }
    }
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

  const importFn =
    tollFreeIngressProvisionTestDeps?.importTelnyxNumbersIntoWorkspace ??
    importTelnyxNumbersIntoWorkspace;
  try {
    await importFn({
      workspaceId,
      e164s: [e164],
      attachConnection: false,
    });
  } catch (err) {
    console.warn("[mctb] toll_free_ingress_import_failed", workspaceId, e164, err);
    return {
      ok: false,
      error: "ingress_import_failed",
      e164,
    };
  }

  let phone = await prisma.phoneNumber.findFirst({
    where: { workspaceId, e164 },
    select: { id: true, e164: true, providerNumberId: true, settingsJson: true },
  });

  if (!phone?.providerNumberId) {
    return { ok: false, error: "ingress_phone_row_missing" };
  }
  if (
    parseMctbPhoneRole(phone.settingsJson) === "platform_mctb_sender" ||
    isPlatformMctbSenderPhoneRecord({ settingsJson: phone.settingsJson })
  ) {
    if (source === "pool") {
      const purchased = await purchaseTelnyxTollFree(workspaceId);
      if (!purchased) {
        return { ok: false, error: "refuse_platform_sender_as_ingress", e164: phone.e164 };
      }
      await writeMctbIngressProvisionPendingE164(workspaceId, purchased);
      e164 = purchased;
      source = "purchased";
      await importFn({ workspaceId, e164s: [e164], attachConnection: false });
      phone = await prisma.phoneNumber.findFirst({
        where: { workspaceId, e164 },
        select: { id: true, e164: true, providerNumberId: true, settingsJson: true },
      });
      if (!phone?.providerNumberId) {
        return { ok: false, error: "ingress_phone_row_missing" };
      }
      if (isPlatformMctbSenderPhoneRecord({ settingsJson: phone.settingsJson })) {
        return { ok: false, error: "refuse_platform_sender_as_ingress", e164: phone.e164 };
      }
    } else {
      return { ok: false, error: "refuse_platform_sender_as_ingress", e164: phone.e164 };
    }
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

  const routeFn =
    tollFreeIngressProvisionTestDeps?.routePhoneToMctbCallHandlingIngress ??
    routePhoneToMctbCallHandlingIngress;
  const route = await routeFn({
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

  const setHandlerFn =
    tollFreeIngressProvisionTestDeps?.setActiveCallHandler ?? setActiveCallHandler;
  await setHandlerFn({
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
