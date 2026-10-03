import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import {
  isPlatformMctbSenderPhoneRecord,
  parseMctbPhoneRole,
} from "@/lib/messaging/compliance/phone-number-class";
import { isNorthAmericaTollFreeE164 } from "@/lib/mctb/provisioning/telnyx-toll-free-ingress-pool";
import { resolveMctbWorkspaceIngressMode } from "@/lib/mctb/provisioning/workspace-ingress-mode";
import {
  isMctbTexmlIngressLocked,
  isPhoneMctbSipIngress,
} from "@/lib/mctb/sip-ingress/sync";

export type WorkspaceMctbIngressInvalidReason =
  | "missing_runtime_phone_number_id"
  | "phone_row_missing"
  | "phone_released"
  | "not_toll_free"
  | "not_telnyx"
  | "missing_provider_number_id"
  | "platform_sender"
  | "canonical_platform_sender"
  | "runtime_onboarding_mismatch"
  | "ingress_not_persisted"
  | "unsupported_ingress_mode";

export type WorkspaceDedicatedMctbIngressAssessment = {
  valid: boolean;
  phoneNumberId?: string;
  e164?: string;
  reason?: WorkspaceMctbIngressInvalidReason;
};

function hasPersistedMctbIngressProvisioning(settingsJson: unknown): boolean {
  if (isMctbTexmlIngressLocked(settingsJson)) return true;
  if (!isPhoneMctbSipIngress(settingsJson)) return false;
  const role = parseMctbPhoneRole(settingsJson);
  return role === "customer_mctb" || role === "customer_production" || role === "customer_voice_only";
}

/**
 * Read-only: does this workspace have a valid dedicated MCTB ingress (not platform SMS sender)?
 * Uses persisted DB/onboarding state — no live Telnyx/TeXML verification on reads.
 */
export async function assessWorkspaceDedicatedMctbIngress(
  workspaceId: string,
): Promise<WorkspaceDedicatedMctbIngressAssessment> {
  const ingressMode = resolveMctbWorkspaceIngressMode();
  const runtime = await loadMissedCallTextConfig(workspaceId);
  const state = await loadMctbOnboardingState(workspaceId);
  const workspaceTollFree = getWorkspaceTollFreeNumber(state);
  const phoneNumberId =
    workspaceTollFree?.phoneNumberId?.trim() || runtime.phoneNumberId?.trim();
  if (!phoneNumberId) {
    return { valid: false, reason: "missing_runtime_phone_number_id" };
  }

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId, workspaceId },
    select: {
      id: true,
      e164: true,
      provider: true,
      providerNumberId: true,
      status: true,
      settingsJson: true,
    },
  });

  if (!phone?.e164) {
    return { valid: false, reason: "phone_row_missing" };
  }
  if (String(phone.status || "").toLowerCase() === "released") {
    return { valid: false, reason: "phone_released" };
  }

  if (isPlatformMctbSenderPhoneRecord({ settingsJson: phone.settingsJson })) {
    return { valid: false, reason: "platform_sender", phoneNumberId: phone.id, e164: phone.e164 };
  }

  const canonical = await resolveCanonicalMctbPlatformSender();
  if (canonical?.phoneNumberId === phone.id) {
    return {
      valid: false,
      reason: "canonical_platform_sender",
      phoneNumberId: phone.id,
      e164: phone.e164,
    };
  }

  if (ingressMode === "toll_free_texml") {
    if (!isNorthAmericaTollFreeE164(phone.e164)) {
      return { valid: false, reason: "not_toll_free", phoneNumberId: phone.id, e164: phone.e164 };
    }
    if (String(phone.provider || "").toLowerCase() !== "telnyx") {
      return { valid: false, reason: "not_telnyx", phoneNumberId: phone.id, e164: phone.e164 };
    }
    if (!phone.providerNumberId) {
      return {
        valid: false,
        reason: "missing_provider_number_id",
        phoneNumberId: phone.id,
        e164: phone.e164,
      };
    }
    if (!hasPersistedMctbIngressProvisioning(phone.settingsJson)) {
      return {
        valid: false,
        reason: "ingress_not_persisted",
        phoneNumberId: phone.id,
        e164: phone.e164,
      };
    }
  } else if (!phone.providerNumberId) {
    return {
      valid: false,
      reason: "missing_provider_number_id",
      phoneNumberId: phone.id,
      e164: phone.e164,
    };
  }

  return { valid: true, phoneNumberId: phone.id, e164: phone.e164 };
}
