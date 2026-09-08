import "server-only";

import { createPlatformAppointment } from "@/lib/appointments/booking-platform";
import { createAppointmentCheckoutSession } from "@/lib/appointments/payment-checkout";
import type { PaymentRequirement } from "@/lib/appointments/types";

export type BookingSessionLine = {
  serviceId?: string;
  serviceName: string;
  startsAt: string;
  durationMinutes?: number;
  staffId?: string;
  locationId?: string;
};

export type BookingSessionInput = {
  workspaceId: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  smsConsent?: boolean;
  bookingAnswers?: Record<string, string>;
  lines: BookingSessionLine[];
  payment?: PaymentRequirement;
};

export async function checkoutBookingSession(input: BookingSessionInput) {
  const created: Array<{ appointmentId: string; startsAt: string; serviceName: string }> = [];
  const conflicts: Array<{ startsAt: string; reason: string }> = [];

  for (const line of input.lines) {
    try {
      const result = await createPlatformAppointment(input.workspaceId, {
        serviceId: line.serviceId,
        serviceName: line.serviceName,
        startsAt: line.startsAt,
        phone: input.phone,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        smsConsent: input.smsConsent,
        bookingAnswers: input.bookingAnswers,
        staffId: line.staffId,
        locationId: line.locationId,
        durationMinutes: line.durationMinutes,
        source: "public_booking",
        status:
          input.payment?.mode && input.payment.mode !== "none" ? "pending_payment" : "awaiting_confirmation",
      });
      if (result.appointmentId) {
        created.push({
          appointmentId: String(result.appointmentId),
          startsAt: line.startsAt,
          serviceName: line.serviceName,
        });
      }
    } catch (err) {
      conflicts.push({
        startsAt: line.startsAt,
        reason: err instanceof Error ? err.message : "unavailable",
      });
    }
  }

  let checkoutUrl: string | null = null;
  if (created.length && input.payment?.mode && input.payment.mode !== "none") {
    const checkout = await createAppointmentCheckoutSession({
      workspaceId: input.workspaceId,
      appointmentId: created[0].appointmentId,
      payment: input.payment,
      customerEmail: input.email,
      description: `Booking session (${created.length} appointments)`,
    });
    checkoutUrl = checkout.url;
  }

  return { created, conflicts, checkoutUrl, sessionSize: input.lines.length };
}
