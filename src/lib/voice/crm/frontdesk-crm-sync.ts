import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import {
  publishAppointmentBooked,
  publishAppointmentCancelled,
} from "@/lib/crm/events";
import { writebackBookingToCrm } from "./call-writeback";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function resolveOrCreateLocalContact(input: {
  workspaceId: string;
  callId: string;
  callerE164?: string | null;
  email?: string | null;
}): Promise<string | null> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { contactId: true, fromE164: true },
  });
  if (call?.contactId) return call.contactId;

  const phoneRaw = (input.callerE164 || call?.fromE164 || "").trim();
  let phone = "";
  if (phoneRaw) {
    try {
      phone = normalizeE164(phoneRaw);
    } catch {
      phone = "";
    }
  }
  const email = input.email?.trim() || "";

  if (phone) {
    const byPhone = await prisma.contact.findFirst({
      where: { workspaceId: input.workspaceId, phone },
      select: { id: true },
    });
    if (byPhone) {
      await prisma.voiceCall.updateMany({
        where: { id: input.callId, workspaceId: input.workspaceId },
        data: { contactId: byPhone.id },
      });
      return byPhone.id;
    }
  }

  if (email) {
    const byEmail = await prisma.contact.findFirst({
      where: { workspaceId: input.workspaceId, email },
      select: { id: true },
    });
    if (byEmail) {
      await prisma.voiceCall.updateMany({
        where: { id: input.callId, workspaceId: input.workspaceId },
        data: { contactId: byEmail.id },
      });
      return byEmail.id;
    }
  }

  if (!phone && !email) return null;

  const created = await prisma.contact.create({
    data: {
      workspaceId: input.workspaceId,
      phone: phone || email || "unknown",
      email: email || null,
      firstName: email ? email.split("@")[0] || "Caller" : "Caller",
      consentSource: "voice_frontdesk",
    },
    select: { id: true },
  });
  await prisma.voiceCall.updateMany({
    where: { id: input.callId, workspaceId: input.workspaceId },
    data: { contactId: created.id },
  });
  return created.id;
}

/**
 * Book → local contact writeback + CRM event bus (Zoho note/task/deal when configured).
 */
export async function syncFrontDeskBookingToCrm(input: {
  workspaceId: string;
  callId: string;
  appointmentId: string;
  callerE164?: string | null;
  email?: string | null;
  businessName?: string | null;
}): Promise<{ ok: boolean; contactId?: string | null; detail?: string }> {
  const prisma = getPrisma();
  const appt = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
    select: {
      id: true,
      contactId: true,
      serviceName: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      metadata: true,
    },
  });
  if (!appt) return { ok: false, detail: "appointment_not_found" };

  const meta = asRecord(appt.metadata);
  const email =
    input.email?.trim() ||
    String(meta.inviteeEmail || "").trim() ||
    null;

  const contactId =
    appt.contactId ||
    (await resolveOrCreateLocalContact({
      workspaceId: input.workspaceId,
      callId: input.callId,
      callerE164: input.callerE164,
      email,
    }));

  if (contactId && !appt.contactId) {
    await prisma.voiceAppointment.update({
      where: { id: appt.id },
      data: { contactId },
    });
  }

  await writebackBookingToCrm({
    workspaceId: input.workspaceId,
    callId: input.callId,
    appointmentId: input.appointmentId,
    collectedFields: email ? { sys_email: email } : {},
    serviceName: input.businessName || appt.serviceName,
  }).catch(() => ({ ok: false, detail: "writeback_failed" }));

  const serviceLabel = appt.serviceName || input.businessName || "Appointment";
  await publishAppointmentBooked({
    workspaceId: input.workspaceId,
    contactId,
    appointmentId: appt.id,
    callId: input.callId,
    serviceName: serviceLabel,
    startsAt: appt.startsAt,
    endsAt: appt.endsAt,
    timezone: appt.timezone,
    dealName: `${serviceLabel} — voice booking`,
    dealId: appt.id,
    opportunityName: `${serviceLabel} — voice booking`,
  }).catch(() => undefined);

  return { ok: true, contactId };
}

/**
 * Cancel → CRM note/task update via appointment.cancelled event.
 */
export async function syncFrontDeskCancelToCrm(input: {
  workspaceId: string;
  callId: string;
  appointmentId: string;
  contactId?: string | null;
  serviceName?: string | null;
  startsAt?: Date | null;
}): Promise<{ ok: boolean }> {
  const prisma = getPrisma();
  const appt = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
    select: {
      id: true,
      contactId: true,
      serviceName: true,
      startsAt: true,
      callId: true,
    },
  });
  if (!appt) return { ok: false };

  const contactId = input.contactId || appt.contactId || null;
  const serviceName = input.serviceName || appt.serviceName || "Appointment";
  const startsAt = input.startsAt || appt.startsAt;

  await publishAppointmentCancelled({
    workspaceId: input.workspaceId,
    contactId,
    appointmentId: appt.id,
    callId: input.callId || appt.callId,
    serviceName,
    startsAt,
    reason: "Canceled by caller on phone",
  }).catch(() => undefined);

  return { ok: true };
}
