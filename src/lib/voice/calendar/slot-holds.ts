/**
 * Appointment slot holds — temporary reservation while the caller confirms.
 * Converted on successful book_appointment; auto-expire via expiresAt.
 */

import { createId } from "@/lib/supabase/id";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type SlotHoldRow = {
  id: string;
  workspaceId: string;
  agentId?: string | null;
  callId?: string | null;
  contactId?: string | null;
  phone?: string | null;
  serviceName?: string | null;
  staffName?: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone?: string | null;
  status: string;
  expiresAt: Date;
  convertedAppointmentId?: string | null;
  metadata?: unknown;
};

export async function expireStaleHolds(workspaceId: string) {
  const prisma = getPrisma();
  const now = new Date();
  await prisma.appointmentSlotHold.updateMany({
    where: {
      workspaceId,
      status: "held",
      expiresAt: { lt: now },
    },
    data: { status: "expired", updatedAt: now },
  });
}

export async function findActiveHoldConflict(input: {
  workspaceId: string;
  startsAt: Date;
  endsAt: Date;
  excludeHoldId?: string;
  excludeCallId?: string;
  excludePhone?: string;
}): Promise<SlotHoldRow | null> {
  await expireStaleHolds(input.workspaceId);
  const prisma = getPrisma();
  const rows = (await prisma.appointmentSlotHold.findMany({
    where: {
      workspaceId: input.workspaceId,
      status: "held",
      expiresAt: { gt: new Date() },
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
      ...(input.excludeHoldId ? { id: { not: input.excludeHoldId } } : {}),
    },
    take: 20,
  })) as SlotHoldRow[];

  for (const row of rows) {
    if (input.excludeCallId && row.callId === input.excludeCallId) continue;
    if (
      input.excludePhone &&
      row.phone &&
      normalizeE164(row.phone) === normalizeE164(input.excludePhone)
    ) {
      continue;
    }
    return row;
  }
  return null;
}

export async function holdAppointmentSlot(input: {
  workspaceId: string;
  agentId?: string;
  callId?: string;
  contactId?: string;
  phone?: string;
  serviceName?: string;
  staffName?: string;
  startsAt: Date;
  endsAt: Date;
  timezone?: string;
  expiresInSeconds?: number;
  metadata?: Record<string, unknown>;
}): Promise<SlotHoldRow> {
  if (Number.isNaN(input.startsAt.getTime()) || Number.isNaN(input.endsAt.getTime())) {
    throw new Error("startsAt and endsAt required for slot hold");
  }
  if (input.endsAt.getTime() <= input.startsAt.getTime()) {
    throw new Error("endsAt must be after startsAt");
  }

  const prisma = getPrisma();
  await expireStaleHolds(input.workspaceId);

  const phone = input.phone ? normalizeE164(input.phone) : "";
  const conflict = await findActiveHoldConflict({
    workspaceId: input.workspaceId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    excludeCallId: input.callId,
    excludePhone: phone || undefined,
  });
  if (conflict) {
    throw new Error("That time is temporarily held for another caller");
  }

  // Also block confirmed appointments
  const apptClash = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId: input.workspaceId,
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
      status: { not: "cancelled" },
    },
  });
  if (apptClash) {
    throw new Error("That time is no longer available");
  }

  // Refresh existing hold for same call/phone+slot
  const existing = (await prisma.appointmentSlotHold.findFirst({
    where: {
      workspaceId: input.workspaceId,
      status: "held",
      expiresAt: { gt: new Date() },
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      ...(input.callId
        ? { callId: input.callId }
        : phone
          ? { phone }
          : {}),
    },
  })) as SlotHoldRow | null;

  const expiresIn = Math.max(30, Math.min(900, Number(input.expiresInSeconds || 180)));
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  if (existing) {
    return (await prisma.appointmentSlotHold.update({
      where: { id: existing.id },
      data: {
        expiresAt,
        agentId: input.agentId || existing.agentId,
        contactId: input.contactId || existing.contactId,
        serviceName: input.serviceName || existing.serviceName,
        staffName: input.staffName || existing.staffName,
        timezone: input.timezone || existing.timezone,
        metadata: input.metadata || existing.metadata,
        updatedAt: new Date(),
      },
    })) as SlotHoldRow;
  }

  return (await prisma.appointmentSlotHold.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      agentId: input.agentId || null,
      callId: input.callId || null,
      contactId: input.contactId || null,
      phone: phone || null,
      serviceName: input.serviceName || null,
      staffName: input.staffName || null,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: input.timezone || null,
      status: "held",
      expiresAt,
      metadata: input.metadata || {},
    },
  })) as SlotHoldRow;
}

export async function releaseAppointmentHold(input: {
  workspaceId: string;
  holdId?: string;
  callId?: string;
  startsAt?: Date;
}): Promise<{ released: number }> {
  const prisma = getPrisma();
  const now = new Date();
  if (input.holdId) {
    const row = await prisma.appointmentSlotHold.findFirst({
      where: { id: input.holdId, workspaceId: input.workspaceId },
    });
    if (!row) throw new Error("Hold not found");
    if (row.status !== "held") return { released: 0 };
    await prisma.appointmentSlotHold.update({
      where: { id: row.id },
      data: { status: "released", updatedAt: now },
    });
    return { released: 1 };
  }

  const where: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    status: "held",
  };
  if (input.callId) where.callId = input.callId;
  if (input.startsAt) where.startsAt = input.startsAt;
  const result = await prisma.appointmentSlotHold.updateMany({
    where,
    data: { status: "released", updatedAt: now },
  });
  return { released: Number(result.count || 0) };
}

export async function convertHoldToAppointment(input: {
  workspaceId: string;
  appointmentId: string;
  callId?: string;
  phone?: string;
  startsAt?: Date;
  holdId?: string;
}) {
  const prisma = getPrisma();
  const now = new Date();
  let hold: SlotHoldRow | null = null;
  if (input.holdId) {
    hold = (await prisma.appointmentSlotHold.findFirst({
      where: { id: input.holdId, workspaceId: input.workspaceId },
    })) as SlotHoldRow | null;
  } else {
    hold = (await prisma.appointmentSlotHold.findFirst({
      where: {
        workspaceId: input.workspaceId,
        status: "held",
        expiresAt: { gt: now },
        ...(input.callId ? { callId: input.callId } : {}),
        ...(input.phone ? { phone: normalizeE164(input.phone) } : {}),
        ...(input.startsAt ? { startsAt: input.startsAt } : {}),
      },
      orderBy: { createdAt: "desc" },
    })) as SlotHoldRow | null;
  }
  if (!hold) return null;
  return prisma.appointmentSlotHold.update({
    where: { id: hold.id },
    data: {
      status: "converted",
      convertedAppointmentId: input.appointmentId,
      updatedAt: now,
    },
  });
}
