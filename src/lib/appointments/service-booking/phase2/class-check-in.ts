import "server-only";

import { getPrisma } from "@/lib/db";
import { generateSecureToken } from "../crypto";

export async function createClassCheckIn(
  workspaceId: string,
  input: {
    contactId: string;
    enrollmentId?: string;
    occurrenceId?: string;
    expiresInHours?: number;
    metadata?: Record<string, unknown>;
  },
) {
  const prisma = getPrisma();
  const token = generateSecureToken(24);
  const expiresAt =
    input.expiresInHours != null
      ? new Date(Date.now() + input.expiresInHours * 3_600_000)
      : new Date(Date.now() + 24 * 3_600_000);

  return prisma.classCheckIn.create({
    data: {
      workspaceId,
      contactId: input.contactId,
      enrollmentId: input.enrollmentId,
      occurrenceId: input.occurrenceId,
      token,
      status: "pending",
      expiresAt,
      metadata: input.metadata,
    },
  });
}

export async function checkInByToken(token: string) {
  const prisma = getPrisma();
  const record = await prisma.classCheckIn.findUnique({ where: { token } });
  if (!record) throw new Error("Check-in token not found");
  if (record.status === "checked_in") {
    return { alreadyCheckedIn: true, record };
  }
  if (record.expiresAt && record.expiresAt < new Date()) {
    await prisma.classCheckIn.update({
      where: { id: record.id },
      data: { status: "expired" },
    });
    throw new Error("Check-in token expired");
  }

  const updated = await prisma.classCheckIn.update({
    where: { id: record.id },
    data: { status: "checked_in", checkedInAt: new Date() },
  });

  if (record.enrollmentId) {
    await prisma.classEnrollment.updateMany({
      where: { id: record.enrollmentId, workspaceId: record.workspaceId },
      data: { attendance: "present" },
    });
  }

  return { alreadyCheckedIn: false, record: updated };
}

export async function listClassCheckIns(
  workspaceId: string,
  filters?: { occurrenceId?: string; contactId?: string },
) {
  const prisma = getPrisma();
  return prisma.classCheckIn.findMany({
    where: {
      workspaceId,
      ...(filters?.occurrenceId ? { occurrenceId: filters.occurrenceId } : {}),
      ...(filters?.contactId ? { contactId: filters.contactId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getClassCheckInQrPayload(workspaceId: string, checkInId: string) {
  const prisma = getPrisma();
  const record = await prisma.classCheckIn.findFirst({
    where: { id: checkInId, workspaceId },
  });
  if (!record) throw new Error("Check-in not found");
  return {
    type: "class_check_in",
    workspaceId,
    token: record.token,
    checkInId: record.id,
  };
}
