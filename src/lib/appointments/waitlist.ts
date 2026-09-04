import "server-only";

import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";

export type WaitlistInput = {
  workspaceId: string;
  contactId?: string;
  appointmentTypeId?: string;
  serviceName?: string;
  preferredDate?: string;
  preferredTimeStart?: string;
  preferredTimeEnd?: string;
  staffPreference?: string;
  locationId?: string;
  phone?: string;
  email?: string;
};

export async function joinWaitlist(input: WaitlistInput) {
  const prisma = getPrisma();
  return prisma.appointmentWaitlistEntry.create({
    data: {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      appointmentTypeId: input.appointmentTypeId,
      serviceName: input.serviceName,
      preferredDate: input.preferredDate,
      preferredTimeStart: input.preferredTimeStart,
      preferredTimeEnd: input.preferredTimeEnd,
      staffPreference: input.staffPreference,
      locationId: input.locationId,
      phone: input.phone,
      email: input.email,
      status: "active",
    },
  });
}

export async function notifyWaitlistOnSlotAvailable(input: {
  workspaceId: string;
  serviceName: string;
  startsAt: Date;
}) {
  const prisma = getPrisma();
  const entries = await prisma.appointmentWaitlistEntry.findMany({
    where: {
      workspaceId: input.workspaceId,
      status: "active",
      OR: [
        { serviceName: input.serviceName },
        { serviceName: null },
      ],
    },
    take: 20,
  });

  if (!entries.length) return;

  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  for (const entry of entries) {
    await enqueueJob({
      jobType: "appointment_waitlist_notify",
      workspaceId: input.workspaceId,
      payload: {
        waitlistEntryId: entry.id,
        serviceName: input.serviceName,
        startsAt: input.startsAt.toISOString(),
      },
      idempotencyKey: `waitlist-notify:${entry.id}:${input.startsAt.toISOString()}`,
    });
  }
}

export async function processWaitlistNotification(payload: {
  waitlistEntryId: string;
  serviceName: string;
  startsAt: string;
}) {
  const prisma = getPrisma();
  const entry = await prisma.appointmentWaitlistEntry.findUnique({
    where: { id: payload.waitlistEntryId },
  });
  if (!entry || entry.status !== "active") return;

  const phone = entry.phone;
  if (!phone) return;

  const { sendQuickSms } = await import("@/lib/sms/send-quick");
  const when = new Date(payload.startsAt).toLocaleString();
  await sendQuickSms({
    workspaceId: entry.workspaceId,
    to: phone,
    body: `A slot opened up for ${payload.serviceName} on ${when}. Book now before it's taken!`,
  });

  await prisma.appointmentWaitlistEntry.update({
    where: { id: entry.id },
    data: { status: "notified", updatedAt: new Date() },
  });
}
