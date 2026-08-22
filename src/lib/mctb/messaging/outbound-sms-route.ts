/**
 * Provider-aware MCTB outbound SMS routing.
 *
 * Twilio toll-free → TOLL_FREE_VERIFICATION (TFV) on that number.
 * Telnyx local → A2P_10DLC via messagingRegistration on the owning workspace.
 *
 * Never authorize a Telnyx sender with Twilio TFV status, or vice versa.
 * When a customer workspace TFN is not TFV-approved yet, fall back to the
 * platform Telnyx A2P demo line for outbound SMS (live test / cert).
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
import { isPlatformDemoNumber } from "@/lib/mctb/onboarding/demo";
import { loadWorkspaceTfvForPhone } from "@/lib/mctb/tfv/store";

export type MessagingComplianceRegime = "TOLL_FREE_VERIFICATION" | "A2P_10DLC";

export type MctbOutboundSmsRoute = {
  customerWorkspaceId: string;
  /** Workspace whose messagingRegistration performs the provider API send. */
  sendWorkspaceId: string;
  fromE164: string;
  phoneNumberId: string;
  source: MctbSmsSender["source"] | "platform_telnyx_a2p";
  complianceRegime: MessagingComplianceRegime;
  usesPlatformSender: boolean;
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

/** Platform Telnyx A2P sender — shared demo line and cert/live-test SMS fallback. */
export async function resolvePlatformTelnyxSmsRoute(
  customerWorkspaceId: string,
): Promise<MctbOutboundSmsRoute | null> {
  const ownerId = await resolvePlatformDemoOwnerWorkspaceId();
  const sender = await resolvePlatformDemoSmsSender();
  if (!ownerId || !sender) return null;

  const reg = await getRegistrationByWorkspace(ownerId);
  if (!isMessagingReady(reg)) return null;
  if (registrationProviderName(reg) !== "telnyx") return null;

  const auth = await isPhoneAuthorizedForOutboundSms(sender.phoneNumberId);
  if (!auth.allowed) return null;

  return {
    customerWorkspaceId,
    sendWorkspaceId: ownerId,
    fromE164: sender.e164,
    phoneNumberId: sender.phoneNumberId,
    source: "platform_telnyx_a2p",
    complianceRegime: "A2P_10DLC",
    usesPlatformSender: true,
  };
}

export async function resolveMctbOutboundSmsRoute(input: {
  workspaceId: string;
  config: Pick<MissedCallTextConfigRecord, "phoneNumberId" | "smsPhoneNumberId">;
  demoMode?: boolean;
}): Promise<MctbOutboundSmsRoute | null> {
  if (input.demoMode) {
    return resolvePlatformTelnyxSmsRoute(input.workspaceId);
  }

  const sender = await resolveMctbSmsSender({
    workspaceId: input.workspaceId,
    config: input.config,
  });

  if (sender?.phoneNumberId) {
    const auth = await isPhoneAuthorizedForOutboundSms(sender.phoneNumberId);
    if (auth.allowed) {
      const pn = await getPrisma().phoneNumber.findFirst({
        where: { id: sender.phoneNumberId },
        select: { workspaceId: true, e164: true },
      });
      return {
        customerWorkspaceId: input.workspaceId,
        sendWorkspaceId: pn?.workspaceId || input.workspaceId,
        fromE164: sender.e164,
        phoneNumberId: sender.phoneNumberId,
        source: sender.source,
        complianceRegime: auth.regime || "A2P_10DLC",
        usesPlatformSender: isPlatformDemoNumber(sender.e164),
      };
    }
  }

  return resolvePlatformTelnyxSmsRoute(input.workspaceId);
}
