import "server-only";

import { getPrisma } from "@/lib/db";
import { isPhoneAuthorizedForOutboundSms } from "@/lib/mctb/messaging/outbound-sms-route";
import { resolveMctbPlatformOwnerWorkspaceId } from "@/lib/mctb/platform-owner-workspace";
import { HP_CERTIFIED_SMS_E164 } from "@/lib/messaging/preferred-sending-number";
import { resolveVoiceOutboundSmsFromE164 } from "@/lib/voice/sms/voice-outbound-sms-from";
import type { QuickSendSmsInput } from "@/lib/sms/send-quick";

export type AppointmentOutboundSmsRoute = {
  customerWorkspaceId: string;
  sendWorkspaceId: string;
  fromE164: string;
  phoneNumberId: string;
};

/**
 * Appointment SMS uses the platform HP-certified number (ws_1 Telnyx A2P).
 * Customer workspaces do not need their own A2P registration for reminders/workflows.
 */
export async function resolveAppointmentOutboundSmsRoute(
  customerWorkspaceId: string,
): Promise<AppointmentOutboundSmsRoute | null> {
  const ownerId = resolveMctbPlatformOwnerWorkspaceId();
  const fromE164 = resolveVoiceOutboundSmsFromE164() || HP_CERTIFIED_SMS_E164;
  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { workspaceId: ownerId, e164: fromE164, status: "Active" },
    select: { id: true, e164: true },
  });
  if (!pn?.e164) return null;

  const auth = await isPhoneAuthorizedForOutboundSms(pn.id);
  if (!auth.allowed) return null;

  return {
    customerWorkspaceId,
    sendWorkspaceId: ownerId,
    fromE164: pn.e164,
    phoneNumberId: pn.id,
  };
}

export async function sendAppointmentSms(
  input: Omit<QuickSendSmsInput, "senderRoute" | "from" | "demoBypass">,
) {
  const route = await resolveAppointmentOutboundSmsRoute(input.workspaceId);
  const { sendQuickSms } = await import("@/lib/sms/send-quick");

  if (!route) {
    return sendQuickSms(input);
  }

  return sendQuickSms({
    ...input,
    from: route.fromE164,
    senderRoute: {
      sendWorkspaceId: route.sendWorkspaceId,
      fromE164: route.fromE164,
      phoneNumberId: route.phoneNumberId,
    },
  });
}
