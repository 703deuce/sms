/**
 * Post-booking verification — never claim booked without proof.
 */

import { getPrisma } from "@/lib/db";

export type BookingVerificationStatus =
  | "attempted"
  | "accepted"
  | "completed"
  | "delivered"
  | "failed"
  | "unknown";

export type BookingVerification = {
  appointmentId?: string | null;
  calendarExternalId?: string | null;
  calendarEventVerified: boolean;
  customerAttached: boolean;
  timezone?: string | null;
  smsAttempted: boolean;
  smsStatus: BookingVerificationStatus;
  outcomeStored: boolean;
  overall: BookingVerificationStatus;
  details: string[];
};

export async function verifyAppointmentBooking(input: {
  workspaceId: string;
  appointmentId?: string | null;
  callId?: string | null;
  smsAlreadySent?: boolean;
}): Promise<BookingVerification> {
  const prisma = getPrisma();
  const details: string[] = [];
  let appointment = null;
  if (input.appointmentId) {
    appointment = await prisma.voiceAppointment.findFirst({
      where: { id: input.appointmentId, workspaceId: input.workspaceId },
    });
  } else if (input.callId) {
    appointment = await prisma.voiceAppointment.findFirst({
      where: { callId: input.callId, workspaceId: input.workspaceId },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!appointment) {
    return {
      appointmentId: input.appointmentId || null,
      calendarExternalId: null,
      calendarEventVerified: false,
      customerAttached: false,
      smsAttempted: Boolean(input.smsAlreadySent),
      smsStatus: input.smsAlreadySent ? "attempted" : "unknown",
      outcomeStored: false,
      overall: "failed",
      details: ["No voice_appointments row found after booking attempt"],
    };
  }

  details.push(`Appointment row ${appointment.id} exists`);
  const calendarEventVerified = Boolean(appointment.externalId);
  if (calendarEventVerified) {
    details.push(`Calendar externalId ${appointment.externalId}`);
  } else {
    details.push("No calendar externalId — may be internal-only booking");
  }

  const customerAttached = Boolean(
    appointment.contactId ||
      (appointment.metadata &&
        typeof appointment.metadata === "object" &&
        ((appointment.metadata as { phone?: string }).phone ||
          (appointment.metadata as { name?: string }).name)),
  );
  if (customerAttached) details.push("Customer/contact attached");
  else details.push("Customer identity incomplete on appointment");

  let outcomeStored = false;
  if (input.callId) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: input.callId, workspaceId: input.workspaceId },
      select: { appointmentBooked: true, metadata: true },
    });
    outcomeStored = Boolean(call?.appointmentBooked);
    if (outcomeStored) details.push("Call outcome appointmentBooked=true");
  }

  const smsAttempted = Boolean(input.smsAlreadySent);
  const smsStatus: BookingVerificationStatus = smsAttempted
    ? "attempted"
    : "unknown";

  let overall: BookingVerificationStatus = "completed";
  if (!appointment.id) overall = "failed";
  else if (!calendarEventVerified && !customerAttached) overall = "accepted";
  else if (!outcomeStored) overall = "accepted";

  // Persist verification on appointment metadata
  await prisma.voiceAppointment
    .update({
      where: { id: appointment.id },
      data: {
        metadata: {
          ...((appointment.metadata as object) || {}),
          bookingVerification: {
            calendarEventVerified,
            customerAttached,
            smsAttempted,
            smsStatus,
            outcomeStored,
            overall,
            verifiedAt: new Date().toISOString(),
            details,
          },
        },
      },
    })
    .catch(() => undefined);

  return {
    appointmentId: appointment.id,
    calendarExternalId: appointment.externalId,
    calendarEventVerified,
    customerAttached,
    timezone: appointment.timezone,
    smsAttempted,
    smsStatus,
    outcomeStored,
    overall,
    details,
  };
}
