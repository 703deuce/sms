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

  const { randomBytes } = await import("crypto");
  const token = randomBytes(16).toString("base64url");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } = await import(
    "@/lib/appointments/settings"
  );
  const platform = await loadAppointmentPlatformConfig(entry.workspaceId);
  const offers = (platform as { waitlistOffers?: import("@/lib/appointments/scheduling-capabilities").WaitlistOffer[] }).waitlistOffers || [];
  offers.push({
    token,
    waitlistEntryId: entry.id,
    serviceName: payload.serviceName,
    startsAt: payload.startsAt,
    expiresAt: expiresAt.toISOString(),
    status: "open",
  });
  await saveAppointmentPlatformConfig(entry.workspaceId, { waitlistOffers: offers } as object);

  const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const acceptUrl = `${base}/waitlist/accept/${token}`;

  const { sendAppointmentSms } = await import("@/lib/appointments/sms-sender");
  const when = new Date(payload.startsAt).toLocaleString();
  await sendAppointmentSms({
    workspaceId: entry.workspaceId,
    to: phone,
    body: `A slot opened for ${payload.serviceName} on ${when}. Accept within 24h: ${acceptUrl}`,
  });

  await prisma.appointmentWaitlistEntry.update({
    where: { id: entry.id },
    data: { status: "notified", updatedAt: new Date() },
  });

  const { emitWaitlistSlotAvailable } = await import("@/lib/appointments/workflow-scanners");
  await emitWaitlistSlotAvailable(
    entry.workspaceId,
    `waitlist:${entry.id}`,
    entry.id,
  ).catch(() => undefined);
}

export async function acceptWaitlistOffer(token: string) {
  const { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } = await import(
    "@/lib/appointments/settings"
  );
  const prisma = getPrisma();

  const workspaces = await prisma.workspace.findMany({ select: { id: true }, take: 200 });
  for (const ws of workspaces) {
    const platform = await loadAppointmentPlatformConfig(ws.id);
    const offers = (platform as { waitlistOffers?: import("@/lib/appointments/scheduling-capabilities").WaitlistOffer[] }).waitlistOffers || [];
    const offer = offers.find((o) => o.token === token && o.status === "open");
    if (!offer) continue;
    if (new Date(offer.expiresAt) < new Date()) {
      return { error: "Offer expired" };
    }

    const entry = await prisma.appointmentWaitlistEntry.findUnique({ where: { id: offer.waitlistEntryId } });
    if (!entry?.phone) return { error: "Waitlist entry not found" };

    const claimed = await prisma.appointmentWaitlistEntry.updateMany({
      where: {
        id: entry.id,
        status: { in: ["active", "notified"] },
      },
      data: { status: "claiming", updatedAt: new Date() },
    });
    if (!claimed.count) {
      return { error: "This offer was already claimed" };
    }

    const { createPlatformAppointment } = await import("@/lib/appointments/booking-platform");
    try {
      const result = await createPlatformAppointment(ws.id, {
        serviceName: offer.serviceName,
        startsAt: offer.startsAt,
        phone: entry.phone,
        email: entry.email || undefined,
        firstName: "Waitlist",
        lastName: "Guest",
        smsConsent: true,
        source: "waitlist",
        status: "scheduled",
        notes: "Accepted waitlist offer",
      });

      const workspace = await prisma.workspace.findUnique({
        where: { id: ws.id },
        select: { displayName: true, name: true },
      });
      const appointment = await prisma.voiceAppointment.findFirst({
        where: { id: result.appointmentId, workspaceId: ws.id },
        select: { serviceName: true, startsAt: true, staffName: true, metadata: true },
      });
      const platformConfig = await loadAppointmentPlatformConfig(ws.id);
      const timezone = (platformConfig as { timezone?: string }).timezone || "America/New_York";

      await prisma.appointmentWaitlistEntry.update({
        where: { id: entry.id },
        data: { status: "filled", updatedAt: new Date() },
      });

      const updatedOffers = offers.map((o) =>
        o.token === token ? { ...o, status: "accepted" as const } : o,
      );
      await saveAppointmentPlatformConfig(ws.id, { waitlistOffers: updatedOffers } as object);

      return {
        appointmentId: result.appointmentId,
        workspaceId: ws.id,
        businessName: workspace?.displayName || workspace?.name || "Your business",
        serviceName: appointment?.serviceName || offer.serviceName,
        startsAt: appointment?.startsAt?.toISOString() || offer.startsAt,
        staffName: appointment?.staffName || null,
        timezone,
      };
    } catch (err) {
      await prisma.appointmentWaitlistEntry.updateMany({
        where: { id: entry.id, status: "claiming" },
        data: { status: "notified", updatedAt: new Date() },
      });
      throw err;
    }
  }
  return { error: "Offer not found" };
}

/** Attempt automatic waitlist booking when slot opens and autoFill enabled. */
export async function autoFillWaitlistSlot(input: {
  workspaceId: string;
  serviceName: string;
  startsAt: Date;
  autoBook?: boolean;
}) {
  const prisma = getPrisma();
  const platform = await loadAppointmentPlatformConfig(input.workspaceId);
  const autoFill = (platform as { waitlistAutoFill?: boolean }).waitlistAutoFill !== false;
  if (!autoFill || !input.autoBook) return null;

  const { rankWaitlistEntries } = await import(
    "@/lib/appointments/service-booking/phase2/waitlist-priority"
  );
  const ranked = await rankWaitlistEntries(input.workspaceId);
  let entry = null;
  for (const row of ranked) {
    const candidate = await prisma.appointmentWaitlistEntry.findFirst({
      where: {
        id: row.entryId,
        workspaceId: input.workspaceId,
        status: "active",
        OR: [{ serviceName: input.serviceName }, { serviceName: null }],
      },
    });
    if (candidate?.phone) {
      entry = candidate;
      break;
    }
  }
  if (!entry) return null;

  const { createPlatformAppointment } = await import("@/lib/appointments/booking-platform");
  const result = await createPlatformAppointment(input.workspaceId, {
    serviceName: input.serviceName,
    startsAt: input.startsAt.toISOString(),
    phone: entry.phone,
    email: entry.email || undefined,
    firstName: "Waitlist",
    lastName: "Guest",
    smsConsent: true,
    source: "admin",
    status: "scheduled",
    notes: "Auto-filled from waitlist",
  });

  await prisma.appointmentWaitlistEntry.update({
    where: { id: entry.id },
    data: { status: "filled", updatedAt: new Date() },
  });

  return result;
}
