import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { resolveConfiguredMctbPhoneForWorkspace } from "@/lib/agents/missed-call-text-back/sms-sender";
import { messagingOnboarding } from "@/lib/messaging/service";
import { telnyxProvider } from "@/lib/messaging/telnyx/provider";
import { telnyxLocalA2pSettings } from "@/lib/messaging/compliance/phone-number-class";
import { MCTB_DEFAULT_LOCAL_AREA_CODE } from "@/lib/mctb/onboarding/constants";
import { provisionMctbTelnyxSipIngress } from "@/lib/mctb/provisioning/telnyx-sip-ingress";
import {
  loadMctbOnboardingState,
  markStepComplete,
  saveMctbOnboardingState,
} from "@/lib/mctb/onboarding/state";
import type { MctbTrialNumberInfo } from "@/lib/mctb/onboarding/types";

function formatPhoneDisplay(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

/**
 * Self-serve: purchase a Telnyx local DID and wire it into the proven MCTB SIP/LiveKit path.
 * Used for paid customers and optional trial local-number path (not platform 571 demo).
 */
export async function provisionMctbCustomerTelnyxLocalNumber(
  workspaceId: string,
  input?: { areaCode?: string; messageTemplate?: string },
): Promise<{
  ok: boolean;
  trialNumber?: MctbTrialNumberInfo;
  provisionActions?: string[];
  error?: string;
}> {
  const areaCode = input?.areaCode?.trim() || MCTB_DEFAULT_LOCAL_AREA_CODE;
  const prisma = getPrisma();

  const runtime = await loadMissedCallTextConfig(workspaceId);
  const configuredPhoneId = runtime.smsPhoneNumberId || runtime.phoneNumberId;
  if (configuredPhoneId) {
    const configured = await resolveConfiguredMctbPhoneForWorkspace(
      workspaceId,
      configuredPhoneId,
    );
    if (configured) {
      const wired = await provisionMctbTelnyxSipIngress({
        workspaceId,
        phoneNumberId: configured.phoneNumberId,
        messageTemplate: input?.messageTemplate,
      });
      if (!wired.ok) {
        return { ok: false, error: wired.error, provisionActions: wired.actions };
      }
      const info: MctbTrialNumberInfo = {
        e164: configured.e164,
        phoneNumberId: configured.phoneNumberId,
        provider: "telnyx",
        numberType: "local",
        voiceStatus: "ready",
        messagingVerificationStatus: "not_started",
        provisionedAt: new Date().toISOString(),
      };
      return { ok: true, trialNumber: info, provisionActions: wired.actions };
    }
  }

  const existing = await prisma.phoneNumber.findFirst({
    where: {
      workspaceId,
      provider: "telnyx",
      status: { not: "Released" },
      type: { in: ["Local", "local"] },
    },
    orderBy: { purchasedAt: "desc" },
    select: { id: true, e164: true },
  });

  if (existing?.e164) {
    const wired = await provisionMctbTelnyxSipIngress({
      workspaceId,
      phoneNumberId: existing.id,
      messageTemplate: input?.messageTemplate,
    });
    return wired.ok
      ? {
          ok: true,
          trialNumber: {
            e164: existing.e164,
            phoneNumberId: existing.id,
            provider: "telnyx",
            numberType: "local",
            voiceStatus: "ready",
            messagingVerificationStatus: "not_started",
            provisionedAt: new Date().toISOString(),
          },
          provisionActions: wired.actions,
        }
      : { ok: false, error: wired.error };
  }

  try {
    await messagingOnboarding.start(workspaceId).catch(() => undefined);
    const results = await telnyxProvider.searchNumbers(areaCode);
    const candidate = results.find((n) => n.phoneNumber)?.phoneNumber;
    if (!candidate) {
      return { ok: false, error: `no_telnyx_numbers_in_area_${areaCode}` };
    }

    await messagingOnboarding.purchaseNumber(workspaceId, candidate, "telnyx");

    const phoneRow = await prisma.phoneNumber.findFirst({
      where: { workspaceId, e164: candidate },
      select: { id: true, e164: true, settingsJson: true },
    });
    if (!phoneRow) {
      return { ok: false, error: "purchase_row_missing" };
    }

    await prisma.phoneNumber.update({
      where: { id: phoneRow.id },
      data: {
        settingsJson: {
          ...(phoneRow.settingsJson && typeof phoneRow.settingsJson === "object"
            ? (phoneRow.settingsJson as object)
            : {}),
          ...telnyxLocalA2pSettings({ role: "customer_production" }),
          mctbSipIngress: true,
          mctbRole: "customer_mctb",
        } as object,
      },
    });

    const wired = await provisionMctbTelnyxSipIngress({
      workspaceId,
      phoneNumberId: phoneRow.id,
      messageTemplate: input?.messageTemplate,
    });
    if (!wired.ok) {
      return { ok: false, error: wired.error, provisionActions: wired.actions };
    }

    const info: MctbTrialNumberInfo = {
      e164: phoneRow.e164,
      phoneNumberId: phoneRow.id,
      provider: "telnyx",
      numberType: "local",
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

    return {
      ok: true,
      trialNumber: info,
      provisionActions: wired.actions,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function formatMctbLocalNumberDisplay(e164: string): string {
  return formatPhoneDisplay(e164);
}
