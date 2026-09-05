import "server-only";

import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { createAppointmentCheckoutSession } from "@/lib/appointments/payment-checkout";
import { loadAppointmentPlatformConfig, publicBookingUrl } from "@/lib/appointments/settings";
import type { PaymentRequirement } from "@/lib/appointments/types";

function paymentSucceeded(meta: AppointmentMetadata): boolean {
  const status = String(meta.paymentStatus || "").toLowerCase();
  return status === "succeeded" || status === "paid";
}

export async function resolveAppointmentPaymentLink(
  workspaceId: string,
  appointmentId: string,
  meta: AppointmentMetadata,
  serviceName: string | null,
): Promise<string> {
  if (paymentSucceeded(meta)) return "";

  const stored =
    typeof meta.paymentCheckoutUrl === "string" ? meta.paymentCheckoutUrl : "";
  if (stored) return stored;

  const prisma = getPrisma();
  const service = serviceName
    ? await prisma.voiceService.findFirst({
        where: { workspaceId, name: serviceName },
        select: { id: true, config: true },
      })
    : null;
  const typeConfig = (service?.config || {}) as { payment?: PaymentRequirement };
  const payment = typeConfig.payment;
  if (!payment || payment.mode === "none") return "";

  const checkout = await createAppointmentCheckoutSession({
    workspaceId,
    appointmentId,
    payment,
    customerEmail: meta.inviteeEmail,
    description: serviceName || "Appointment payment",
    idempotencyKey: `appt-pay-wf:${workspaceId}:${appointmentId}`,
  });

  if (checkout.url) {
    await prisma.voiceAppointment.update({
      where: { id: appointmentId },
      data: {
        metadata: { ...meta, paymentCheckoutUrl: checkout.url } as object,
      },
    });
    return checkout.url;
  }
  return "";
}

export async function resolveAppointmentBookingLink(
  workspaceId: string,
  serviceId?: string | null,
): Promise<string> {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true },
  });
  if (!workspace?.slug) return "";
  return publicBookingUrl(workspace.slug, serviceId || undefined);
}

export async function customerHasFutureAppointment(
  workspaceId: string,
  contactId: string | null | undefined,
  excludeAppointmentId: string,
): Promise<boolean> {
  if (!contactId) return false;
  const count = await getPrisma().voiceAppointment.count({
    where: {
      workspaceId,
      contactId,
      id: { not: excludeAppointmentId },
      startsAt: { gt: new Date() },
      status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
    },
  });
  return count > 0;
}

export function isPaymentOutstanding(meta: AppointmentMetadata): boolean {
  if (paymentSucceeded(meta)) return false;
  const status = String(meta.paymentStatus || "").toLowerCase();
  return (
    status === "pending" ||
    status === "failed" ||
    (meta.balanceDueCents ?? 0) > 0 ||
    (meta.amountDueCents ?? 0) > 0
  );
}
