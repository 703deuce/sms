import "server-only";

import type { QuickSendSmsInput } from "@/lib/sms/send-quick";

export type AppointmentOutboundSmsRoute = {
  customerWorkspaceId: string;
  sendWorkspaceId: string;
  fromE164: string;
  phoneNumberId: string;
};

/**
 * Appointment Reminders SMS uses the **same** Transovo platform toll-free sender as
 * Missed Call Text Back (MCTB `senderMode=PLATFORM`). Customer business lines are never used.
 */
export async function resolveAppointmentOutboundSmsRoute(
  customerWorkspaceId: string,
  recipientE164?: string,
): Promise<AppointmentOutboundSmsRoute | null> {
  const { resolvePlatformMctbSenderRoute } = await import(
    "@/lib/mctb/messaging/outbound-sms-route"
  );
  const route = await resolvePlatformMctbSenderRoute(customerWorkspaceId, recipientE164);
  if (!route) return null;

  return {
    customerWorkspaceId,
    sendWorkspaceId: route.sendWorkspaceId,
    fromE164: route.fromE164,
    phoneNumberId: route.phoneNumberId,
  };
}

export async function sendAppointmentSms(
  input: Omit<QuickSendSmsInput, "senderRoute" | "from" | "demoBypass">,
) {
  const route = await resolveAppointmentOutboundSmsRoute(input.workspaceId, input.to);
  if (!route) {
    throw new Error(
      "Transovo platform SMS sender is not available. Appointment messages must send from the same platform toll-free number as Missed Call Text Back (platform sender), not your business line.",
    );
  }

  const { sendQuickSms } = await import("@/lib/sms/send-quick");
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
