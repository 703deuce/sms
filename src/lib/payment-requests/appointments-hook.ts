/**
 * Future Appointments → Request Payment integration.
 * Call from calendar/appointment UI when manual payment requests ship.
 */
import { createPaymentRequestFromAppointment } from "@/lib/payment-requests/service";

export type AppointmentPaymentRequestPrefill = {
  workspaceId: string;
  appointmentId: string;
  customerPhoneE164: string;
  amountMinor: number;
  description: string;
  createdByUserId?: string;
};

export async function requestPaymentForAppointment(input: AppointmentPaymentRequestPrefill) {
  return createPaymentRequestFromAppointment(input);
}
