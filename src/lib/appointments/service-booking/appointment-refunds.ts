import "server-only";

export async function refundAppointmentPayment(input: {
  workspaceId: string;
  appointmentId: string;
  amountCents?: number;
  refundToWallet?: boolean;
  contactId?: string;
  reason?: string;
}) {
  const { refundMerchantAppointmentPayment } = await import("@/lib/merchant-payments/service");
  const result = await refundMerchantAppointmentPayment({
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    amountCents: input.amountCents,
    reason: input.reason,
  });

  if (input.refundToWallet && input.contactId && input.amountCents) {
    const { creditWallet } = await import("./phase2/client-wallet");
    await creditWallet(input.workspaceId, input.contactId, input.amountCents, {
      note: `Refund for appointment ${input.appointmentId}`,
    });
  }

  const { restorePackageCreditsForAppointment } = await import("./package-lifecycle");
  await restorePackageCreditsForAppointment(input.workspaceId, input.appointmentId, "cancel");

  return result;
}
