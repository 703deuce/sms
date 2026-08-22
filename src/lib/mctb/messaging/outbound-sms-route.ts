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
import { isMessagingReady, registrationProviderName } from "@/lib/messaging/status";
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
  type MctbSmsSender,
} from "@/lib/agents/missed-call-text-back/sms-sender";
import type { MissedCallTextConfigRecord } from "@/lib/agents/missed-call-text-back/types";
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
  fromE164: string;
  phoneNumberId: string;
  source: MctbSmsSender["source"] | "platform_telnyx_a2p";
  complianceRegime: MessagingComplianceRegime;
  trafficMode: MctbPlatformTrafficMode | "CUSTOMER_PRODUCTION";
};

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
    return {
      allowed: isMessagingReady(reg),
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
  if (!isMessagingReady(reg)) return null;
  if (registrationProviderName(reg) !== "telnyx") return null;

  const auth = await isPhoneAuthorizedForOutboundSms(sender.phoneNumberId);
  if (!auth.allowed) return null;

  return {
    customerWorkspaceId: input.customerWorkspaceId,
    sendWorkspaceId: ownerId,
    fromE164: sender.e164,
    phoneNumberId: sender.phoneNumberId,
    source: "platform_telnyx_a2p",
    complianceRegime: "A2P_10DLC",
    trafficMode: input.trafficMode,
  };
}

export async function resolveMctbOutboundSmsRoute(input: {
  workspaceId: string;
  config: Pick<MissedCallTextConfigRecord, "phoneNumberId" | "smsPhoneNumberId">;
  /** Onboarding demo — routes via platform 571, isolated from customer production. */
  demoMode?: boolean;
  /** Explicit certification run on platform 571 (same adapter path, not customer TFN). */
  certificationMode?: boolean;
}): Promise<MctbOutboundSmsRoute | null> {
  if (input.demoMode) {
    return resolvePlatformTelnyxSmsRoute({
      customerWorkspaceId: input.workspaceId,
      trafficMode: "PLATFORM_DEMO",
    });
  }
  if (input.certificationMode) {
    return resolvePlatformTelnyxSmsRoute({
      customerWorkspaceId: input.workspaceId,
      trafficMode: "CERTIFICATION",
    });
  }

  const sender = await resolveMctbSmsSender({
    workspaceId: input.workspaceId,
    config: input.config,
  });

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
    fromE164: sender.e164,
    phoneNumberId: sender.phoneNumberId,
    source: sender.source,
    complianceRegime: auth.regime || "A2P_10DLC",
    trafficMode: "CUSTOMER_PRODUCTION",
  };
}
