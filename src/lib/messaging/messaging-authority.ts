import type { MessagingRegistration } from "@/lib/domain";
import { getMessagingProviderName } from "./provider-config";
import { looksLikeTwilioMessagingServiceSid } from "./provider-ids";
import {
  isApprovedBrandStatus,
  isApprovedCampaignStatus,
} from "./telnyx/status-map";

function registrationProviderName(
  reg: MessagingRegistration | null | undefined,
): ReturnType<typeof getMessagingProviderName> {
  const stored = (reg?.messagingProvider || "").trim().toLowerCase();
  if (stored === "telnyx" || stored === "twilio" || stored === "mock") {
    return stored;
  }
  return getMessagingProviderName();
}

/**
 * Messaging authority model (single source of truth per concern):
 *
 * 1. Provider A2P approval — Telnyx/Twilio brand, campaign, number attachment.
 *    Runtime sends use ONLY this (+ paused). Local onboarding form fields never
 *    invalidate provider approval after the fact.
 *
 * 2. Product activation — MCTB enabled, entitlements, billing (checked at send sites).
 *
 * 3. Onboarding form completeness — validated at submit/save only, not in background
 *    advance jobs or SMS send paths.
 */

/** Telnyx brand + campaign + number attached — ignores messagingEnabled / form fields. */
export function isTelnyxProviderA2pApproved(
  reg: MessagingRegistration | null | undefined,
): boolean {
  if (!reg || reg.paused) return false;
  if (registrationProviderName(reg) !== "telnyx") return false;
  if (!reg.phoneAttached || !reg.phoneE164) return false;
  if (reg.phoneSid?.startsWith("PENDING:")) return false;

  const profileId =
    reg.messagingProfileId ||
    (looksLikeTwilioMessagingServiceSid(reg.messagingServiceSid)
      ? null
      : reg.messagingServiceSid);
  const campaignId = reg.campaignId || reg.a2pCampaignSid;
  if (!profileId || !campaignId) return false;

  const brandOk =
    reg.brandStatus === "approved" ||
    isApprovedBrandStatus(String(reg.brandStatusRaw || ""));
  const campaignOk =
    reg.campaignStatus === "approved" ||
    isApprovedCampaignStatus(String(reg.campaignStatusRaw || ""));
  return brandOk && campaignOk;
}

function isTwilioProviderA2pApproved(reg: MessagingRegistration): boolean {
  if (!reg.messagingEnabled) return false;
  if (reg.overallStatus !== "ready") return false;
  if (!reg.phoneAttached || !reg.phoneE164) return false;
  if (!reg.messagingServiceSid) return false;
  if (reg.subaccountSid?.startsWith("PENDING:")) return false;
  if (reg.phoneSid?.startsWith("PENDING:")) return false;
  return true;
}

/** Provider-side A2P approval — the only registration check on the runtime SMS path. */
export function isProviderA2pApproved(
  reg: MessagingRegistration | null | undefined,
): boolean {
  if (!reg || reg.paused) return false;
  const provider = registrationProviderName(reg);
  if (provider === "telnyx") return isTelnyxProviderA2pApproved(reg);
  if (provider === "twilio") return isTwilioProviderA2pApproved(reg);
  if (provider === "mock") {
    return Boolean(reg.messagingServiceSid && reg.phoneAttached);
  }
  return false;
}

/** Runtime transactional SMS (MCTB etc.) — provider approval only; product gates are separate. */
export function isMessagingSendAuthorized(
  reg: MessagingRegistration | null | undefined,
): boolean {
  return isProviderA2pApproved(reg);
}

/** @deprecated Prefer isProviderA2pApproved — kept for UI progress labels. */
export function isMessagingReady(reg: MessagingRegistration | null | undefined): boolean {
  return isProviderA2pApproved(reg);
}

/** @deprecated Alias — use isTelnyxProviderA2pApproved */
export function isTelnyxRegistrationProviderReady(
  reg: MessagingRegistration | null | undefined,
): boolean {
  return isTelnyxProviderA2pApproved(reg);
}

/** DB snapshot when Telnyx provider is approved — sync inward only, never downgrade. */
export function telnyxProviderApprovedRegistrationPatch(
  reg: MessagingRegistration,
): Record<string, unknown> {
  return {
    overallStatus: "ready",
    messagingEnabled: true,
    messagingActivationStatus: "approved",
    numberStatus: reg.phoneAttached ? "ready" : reg.numberStatus,
    lastError: null,
    registrationApprovedAt: reg.registrationApprovedAt || new Date(),
  };
}

/** True when onboarding forms are incomplete — blocks NEW submission only, not runtime send. */
export function isOnboardingSubmissionIncomplete(
  reg: MessagingRegistration | null | undefined,
): boolean {
  if (!reg) return true;
  return (
    !reg.certifiedAt ||
    !reg.legalBusinessName ||
    !reg.businessRegistrationId ||
    !reg.websiteUrl ||
    !reg.useCase
  );
}
