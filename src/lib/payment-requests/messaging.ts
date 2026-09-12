import "server-only";

import { getPrisma } from "@/lib/db";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { isMessagingReady, isMessagingSendAuthorized } from "@/lib/messaging/status";
import { resolveAppointmentOutboundSmsRoute } from "@/lib/appointments/sms-sender";
import { formatMoneyMinor } from "@/lib/payment-requests/format";

export type PaymentRequestMessagingMode = "platform" | "business";

export type ResolvedPaymentRequestMessage = {
  mode: PaymentRequestMessagingMode;
  modeLabel: string;
  body: string;
  canSend: boolean;
  blockReason?: string;
};

export async function resolvePaymentRequestMessaging(
  workspaceId: string,
  input: {
    businessDisplayName: string;
    amountMinor: number;
    currency: string;
    description: string;
    customerNote?: string | null;
    publicUrl: string;
  },
): Promise<ResolvedPaymentRequestMessage> {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });
  const businessName = input.businessDisplayName || workspace?.name || "Your business";

  const platformRoute = await resolveAppointmentOutboundSmsRoute(workspaceId);
  const reg = await getRegistrationByWorkspace(workspaceId);
  const businessReady = isMessagingReady(reg) && isMessagingSendAuthorized(reg);

  const amount = formatMoneyMinor(input.amountMinor, input.currency);
  const note = input.customerNote?.trim();
  const noteSuffix = note ? ` — ${note}` : "";

  if (platformRoute) {
    const body = `Transovo: ${businessName} sent you a payment request for ${amount} for ${input.description}${noteSuffix}. Pay securely: ${input.publicUrl}`;
    return {
      mode: "platform",
      modeLabel: "Transovo messaging",
      body,
      canSend: true,
    };
  }

  if (businessReady) {
    const body = `${businessName}: Payment request for ${amount} — ${input.description}${noteSuffix}. Pay securely: ${input.publicUrl}`;
    return {
      mode: "business",
      modeLabel: `${businessName} messaging`,
      body,
      canSend: true,
    };
  }

  const body = `${businessName}: Payment request for ${amount} — ${input.description}${noteSuffix}. Pay securely: ${input.publicUrl}`;
  return {
    mode: "business",
    modeLabel: `${businessName} messaging`,
    body,
    canSend: false,
    blockReason: "Messaging is not ready to send SMS for this workspace",
  };
}
