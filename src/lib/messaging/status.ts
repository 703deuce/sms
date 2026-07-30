import type { MessagingRegistration, MessagingStepStatus } from "@/lib/domain";
import type { RegistrationProgressStep } from "./types";
import { getMessagingProviderName } from "./provider-config";
import { looksLikeTwilioMessagingServiceSid } from "./provider-ids";

export function registrationProviderName(
  reg: MessagingRegistration | null | undefined,
): ReturnType<typeof getMessagingProviderName> {
  const stored = (reg?.messagingProvider || "").trim().toLowerCase();
  if (stored === "telnyx" || stored === "twilio" || stored === "mock") {
    return stored;
  }
  return getMessagingProviderName();
}

export function isMessagingReady(reg: MessagingRegistration | null | undefined): boolean {
  if (!reg) return false;
  if (reg.paused) return false;
  if (!reg.messagingEnabled) return false;
  if (reg.overallStatus !== "ready") return false;
  if (!reg.phoneAttached || !reg.phoneE164) return false;
  if (reg.phoneSid?.startsWith("PENDING:")) return false;

  const provider = registrationProviderName(reg);
  if (provider === "telnyx") {
    const profileId =
      (reg as MessagingRegistration & { messagingProfileId?: string | null }).messagingProfileId ||
      (looksLikeTwilioMessagingServiceSid(reg.messagingServiceSid)
        ? null
        : reg.messagingServiceSid);
    const campaignId =
      (reg as MessagingRegistration & { campaignId?: string | null }).campaignId ||
      reg.a2pCampaignSid;
    if (!profileId || !campaignId) return false;
    if (reg.brandStatus !== "approved") return false;
    if (reg.campaignStatus !== "approved") return false;
    return true;
  }

  // Twilio / mock path
  if (!reg.messagingServiceSid) return false;
  if (reg.subaccountSid?.startsWith("PENDING:")) return false;
  return true;
}

export function buildProgressSteps(reg: MessagingRegistration): RegistrationProgressStep[] {
  return [
    { key: "overview", label: "Overview", status: reg.overallStatus === "not_started" ? "not_started" : "approved" },
    {
      key: "business",
      label: "Business details",
      status: reg.legalBusinessName ? (reg.profileStatus === "not_started" ? "action_required" : reg.profileStatus) : "action_required",
    },
    {
      key: "use_case",
      label: "SMS use case",
      status: reg.useCase ? (reg.campaignStatus === "not_started" ? "action_required" : reg.campaignStatus) : "action_required",
    },
    {
      key: "review",
      label: "Review & certify",
      status: reg.certifiedAt
        ? (["submitted", "in_review", "approved", "ready"] as MessagingStepStatus[]).includes(reg.overallStatus)
          ? reg.overallStatus === "ready"
            ? "approved"
            : "submitted"
          : "submitted"
        : "action_required",
    },
    { key: "status", label: "Registration status", status: reg.brandStatus },
    { key: "number", label: "Phone number", status: reg.numberStatus },
    {
      key: "ready",
      label: "Ready to send",
      status: isMessagingReady(reg) ? "ready" : ("not_started" as MessagingStepStatus),
    },
  ];
}

export function toPublicRegistration(reg: MessagingRegistration) {
  // Omit encrypted token from API responses
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { subaccountAuthTokenEnc, ...safe } = reg;
  const provider = registrationProviderName(reg);
  return {
    ...safe,
    progress: buildProgressSteps(reg),
    ready: isMessagingReady(reg),
    liveMode: provider === "twilio" || provider === "telnyx",
    messagingProvider: provider,
  };
}
