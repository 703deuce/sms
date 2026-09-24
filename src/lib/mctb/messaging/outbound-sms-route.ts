/**
 * Provider-aware MCTB outbound SMS routing.
 *
 * Twilio toll-free → TOLL_FREE_VERIFICATION (TFV) on that number.
 * Telnyx local → A2P_10DLC via messagingRegistration on the owning workspace.
 *
 * Never authorize a Telnyx sender with Twilio TFV status, or vice versa.
 *
 * Platform demo (+15714073615): outbound only for explicit PLATFORM_DEMO or CERTIFICATION sessions.
 */
import { getPrisma } from "@/lib/db";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { isMessagingReady, isMessagingSendAuthorized, registrationProviderName } from "@/lib/messaging/status";
import {
  isPhoneMessagingApproved,
  isTfvApproved,
  parseMessagingComplianceFromSettings,
  type TollFreeVerificationStatus,
} from "@/lib/messaging/compliance/messaging-compliance";
import {
  classifyProductionNumber,
  isPlatformDemoPhoneRecord,
} from "@/lib/messaging/compliance/phone-number-class";
import {
  resolveMctbSmsSender,
  resolveConfiguredMctbPhoneForWorkspace,
  type MctbSmsSender,
} from "@/lib/agents/missed-call-text-back/sms-sender";
import type {
  MissedCallTextConfigRecord,
  MctbSenderMode,
} from "@/lib/agents/missed-call-text-back/types";
import { resolveCanonicalMctbPlatformSender } from "@/lib/mctb/messaging/platform-sender-config";
import {
  resolvePlatformDemoOwnerWorkspaceId,
  resolvePlatformDemoSmsSender,
} from "@/lib/mctb/onboarding/platform-demo";
import { loadWorkspaceTfvForPhone } from "@/lib/mctb/tfv/store";

export type MessagingComplianceRegime = "TOLL_FREE_VERIFICATION" | "A2P_10DLC";

/** Isolated platform traffic on Transovo-owned +15714073615 — not customer production. */
export type MctbPlatformTrafficMode = "PLATFORM_DEMO" | "CERTIFICATION";

export type MctbOutboundSmsRoute = {
  customerWorkspaceId: string;
  /** Workspace whose messagingRegistration performs the provider API send. */
  sendWorkspaceId: string;
  senderMode: "PLATFORM" | "WORKSPACE";
  fromE164: string;
  phoneNumberId: string;
  provider: string | null;
  source: MctbSmsSender["source"] | "platform_telnyx_a2p" | "platform_mctb_sender";
  complianceRegime: MessagingComplianceRegime;
  trafficMode: MctbPlatformTrafficMode | "CUSTOMER_PRODUCTION";
};

/**
 * MCTB/recovery often sends from a workspace-owned local DID (e.g. 571 A2P) while
 * messagingRegistration still points at another number (e.g. toll-free). When the
 * routed phone is provider-approved, outbound send must not be blocked by workspace-level
 * campaign status on a different E.164.
 */
export async function isPhoneAuthorizedForOutboundSms(phoneNumberId: string): Promise<{
  allowed: boolean;
  regime: MessagingComplianceRegime | null;
  provider: string | null;
}> {
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { id: phoneNumberId },
    select: {
      id: true,
      e164: true,
      workspaceId: true,
      provider: true,
      type: true,
      settingsJson: true,
      a2pStatus: true,
    },
  });
  if (!pn?.e164) return { allowed: false, regime: null, provider: null };

  const provider = String(pn.provider || "").toLowerCase();
  const numberClass = classifyProductionNumber(pn);

  if (numberClass === "TWILIO_TOLL_FREE") {
    const compliance = parseMessagingComplianceFromSettings(pn.settingsJson);
    if (compliance?.type === "TOLL_FREE_VERIFICATION") {
      return {
        allowed: isTfvApproved(compliance.status as TollFreeVerificationStatus),
        regime: "TOLL_FREE_VERIFICATION",
        provider: provider || "twilio",
      };
    }
    const tfv = await loadWorkspaceTfvForPhone(pn.workspaceId, pn.id);
    if (tfv) {
      return {
        allowed: isTfvApproved(tfv.status),
        regime: "TOLL_FREE_VERIFICATION",
        provider: provider || "twilio",
      };
    }
    return {
      allowed: isPhoneMessagingApproved(pn),
      regime: "TOLL_FREE_VERIFICATION",
      provider: provider || "twilio",
    };
  }

  const reg = await getRegistrationByWorkspace(pn.workspaceId);
  if (reg?.phoneE164 === pn.e164 && isMessagingReady(reg)) {
    return { allowed: true, regime: "A2P_10DLC", provider: provider || "telnyx" };
  }
  if (isPlatformDemoPhoneRecord({ e164: pn.e164, settingsJson: pn.settingsJson })) {
    const ownerReg = await getRegistrationByWorkspace(pn.workspaceId);
    return {
      allowed: isMessagingSendAuthorized(ownerReg),
      regime: "A2P_10DLC",
      provider: provider || "telnyx",
    };
  }
  return {
    allowed: isPhoneMessagingApproved(pn),
    regime: "A2P_10DLC",
    provider: provider || "telnyx",
  };
}

/**
 * Platform Telnyx A2P route — only for explicit PLATFORM_DEMO or CERTIFICATION traffic.
 * Uses the platform owner's Telnyx registration (real TELNYX_LOCAL_A2P adapter path).
 */
export async function resolvePlatformTelnyxSmsRoute(input: {
  customerWorkspaceId: string;
  trafficMode: MctbPlatformTrafficMode;
}): Promise<MctbOutboundSmsRoute | null> {
  const ownerId = await resolvePlatformDemoOwnerWorkspaceId();
  const sender = await resolvePlatformDemoSmsSender();
  if (!ownerId || !sender) return null;

  const reg = await getRegistrationByWorkspace(ownerId);
  if (!isMessagingSendAuthorized(reg)) return null;
  if (registrationProviderName(reg) !== "telnyx") return null;

  const auth = await isPhoneAuthorizedForOutboundSms(sender.phoneNumberId);
  if (!auth.allowed) return null;

  return {
    customerWorkspaceId: input.customerWorkspaceId,
    sendWorkspaceId: ownerId,
    senderMode: "PLATFORM",
    fromE164: sender.e164,
    phoneNumberId: sender.phoneNumberId,
    provider: registrationProviderName(reg) || "telnyx",
    source: "platform_telnyx_a2p",
    complianceRegime: "A2P_10DLC",
    trafficMode: input.trafficMode,
  };
}

async function resolvePlatformMctbSenderRoute(
  customerWorkspaceId: string,
  consumerE164ForOptOutCheck?: string,
): Promise<MctbOutboundSmsRoute | null> {
  const platform = await resolveCanonicalMctbPlatformSender();
  if (!platform) {
    console.log(
      JSON.stringify({
        source: "mctb-platform-sender",
        event: "platform_sender_not_configured",
        customerWorkspaceId,
      }),
    );
    return null;
  }

  if (consumerE164ForOptOutCheck) {
    const { isPlatformMctbSenderOptedOut } = await import(
      "@/lib/mctb/messaging/platform-sender-suppression"
    );
    if (await isPlatformMctbSenderOptedOut(platform, consumerE164ForOptOutCheck)) {
      console.log(
        JSON.stringify({
          source: "mctb-platform-sender",
          event: "platform_opt_out",
          customerWorkspaceId,
          consumerE164: consumerE164ForOptOutCheck,
        }),
      );
      return null;
    }
  }

  const auth = await isPhoneAuthorizedForOutboundSms(platform.phoneNumberId);
  if (!auth.allowed) {
    console.log(
      JSON.stringify({
        source: "mctb-platform-sender",
        event: "platform_sender_not_authorized",
        customerWorkspaceId,
        phoneNumberId: platform.phoneNumberId,
        regime: auth.regime,
        provider: auth.provider,
      }),
    );
    return null;
  }

  return {
    customerWorkspaceId,
    sendWorkspaceId: platform.workspaceId,
    senderMode: "PLATFORM",
    fromE164: platform.e164,
    phoneNumberId: platform.phoneNumberId,
    provider: auth.provider || platform.provider,
    source: "platform_mctb_sender",
    complianceRegime: auth.regime || "TOLL_FREE_VERIFICATION",
    trafficMode: "CUSTOMER_PRODUCTION",
  };
}

export async function resolveMctbOutboundSmsRoute(input: {
  workspaceId: string;
  config: Pick<
    MissedCallTextConfigRecord,
    "phoneNumberId" | "smsPhoneNumberId" | "senderMode"
  >;
  /** Recipient E.164 — used for platform-sender-wide STOP checks in PLATFORM mode. */
  recipientE164?: string;
  /** Onboarding demo — routes via platform 571, isolated from customer production. */
  demoMode?: boolean;
  /** Explicit certification run on platform 571 (same adapter path, not customer TFN). */
  certificationMode?: boolean;
}): Promise<MctbOutboundSmsRoute | null> {
  if (input.demoMode || input.certificationMode) {
    // Platform demo retired — certification and Try It use workspace-owned numbers.
  }

  const mode: MctbSenderMode = input.config.senderMode || "WORKSPACE";
  if (mode === "PLATFORM") {
    return resolvePlatformMctbSenderRoute(input.workspaceId, input.recipientE164);
  }

  const senderCandidates: MctbSmsSender[] = [];
  const primary = await resolveMctbSmsSender({
    workspaceId: input.workspaceId,
    config: input.config,
  });
  if (primary) senderCandidates.push(primary);

  if (
    input.config.smsPhoneNumberId &&
    input.config.smsPhoneNumberId !== input.config.phoneNumberId
  ) {
    const alt = await resolveConfiguredMctbPhoneForWorkspace(
      input.workspaceId,
      input.config.smsPhoneNumberId,
    );
    if (alt) {
      senderCandidates.push({ ...alt, source: "sms_phone_number_id" });
    }
  }

  let sender: MctbSmsSender | null = null;
  for (const candidate of senderCandidates) {
    const auth = await isPhoneAuthorizedForOutboundSms(candidate.phoneNumberId);
    if (auth.allowed) {
      sender = candidate;
      break;
    }
  }
  sender = sender || senderCandidates[0] || null;

  if (!sender?.phoneNumberId) return null;

  const auth = await isPhoneAuthorizedForOutboundSms(sender.phoneNumberId);
  if (!auth.allowed) return null;

  const pn = await getPrisma().phoneNumber.findFirst({
    where: { id: sender.phoneNumberId },
    select: { workspaceId: true, e164: true },
  });
  if (!pn) return null;

  return {
    customerWorkspaceId: input.workspaceId,
    sendWorkspaceId: pn.workspaceId,
    senderMode: "WORKSPACE",
    fromE164: sender.e164,
    phoneNumberId: sender.phoneNumberId,
    provider: auth.provider,
    source: sender.source,
    complianceRegime: auth.regime || "A2P_10DLC",
    trafficMode: "CUSTOMER_PRODUCTION",
  };
}
