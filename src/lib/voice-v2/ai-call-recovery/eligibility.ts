import "server-only";

import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

const LANDLINE_NANP_EXCHANGE_BLOCK = new Set([
  "200",
  "201",
  "202",
  "203",
  "204",
  "205",
  "206",
  "207",
  "208",
  "209",
]);

/** Heuristic — prefer existing capability intelligence when available. */
export function isLikelyNonSmsDestination(e164: string): boolean {
  try {
    const n = normalizeE164(e164);
    if (!n.startsWith("+1") || n.length < 12) return false;
    const exchange = n.slice(5, 8);
    return LANDLINE_NANP_EXCHANGE_BLOCK.has(exchange);
  } catch {
    return true;
  }
}

export async function checkRecoveryMessagingEligibility(input: {
  workspaceId: string;
  callerE164: string;
  sendingPhoneNumberId?: string | null;
  consentMode: import("./types").VoiceV2AiCallRecoveryConsentMode;
}): Promise<{
  validDestination: boolean;
  validSendingRoute: boolean;
  notOptedOut: boolean;
  notSuppressed: boolean;
  callerIdKnown: boolean;
  landlineOrNonSmsDestination: boolean;
  sendingE164?: string;
}> {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  let callerE164 = input.callerE164;
  try {
    callerE164 = normalizeE164(callerE164);
  } catch {
    return {
      validDestination: false,
      validSendingRoute: false,
      notOptedOut: true,
      notSuppressed: true,
      callerIdKnown: false,
      landlineOrNonSmsDestination: true,
    };
  }

  const landline = isLikelyNonSmsDestination(callerE164);
  const suppression = await prisma.suppression.findFirst({
    where: { workspaceId: input.workspaceId, phone: callerE164 },
    select: { id: true },
  });

  let sendingE164: string | undefined;
  let validSendingRoute = false;
  if (input.sendingPhoneNumberId) {
    const num = await prisma.phoneNumber.findFirst({
      where: {
        id: input.sendingPhoneNumberId,
        workspaceId: input.workspaceId,
        status: "Active",
      },
      select: { e164: true, a2pStatus: true },
    });
    if (num?.e164) {
      sendingE164 = num.e164;
      validSendingRoute = true;
    }
  }

  if (!validSendingRoute) {
    const { resolveVoiceOutboundSmsFrom } = await import("@/lib/voice/sms/voice-outbound-sms-from");
    const route = await resolveVoiceOutboundSmsFrom({
      workspaceId: input.workspaceId,
      agentId: null,
    });
    if (route.fromE164) {
      sendingE164 = route.fromE164;
      validSendingRoute = true;
    }
  }

  return {
    validDestination: !landline && Boolean(callerE164),
    validSendingRoute: validSendingRoute && input.consentMode !== "DISABLED",
    notOptedOut: !suppression,
    notSuppressed: !suppression,
    callerIdKnown: Boolean(callerE164),
    landlineOrNonSmsDestination: landline,
    sendingE164,
  };
}
