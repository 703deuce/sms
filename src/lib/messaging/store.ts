import type { MessagingRegistration, MessagingStepStatus, Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";

export async function getRegistrationByWorkspace(workspaceId: string) {
  return getPrisma().messagingRegistration.findUnique({ where: { workspaceId } });
}

export async function ensureRegistrationRow(workspaceId: string) {
  const existing = await getRegistrationByWorkspace(workspaceId);
  if (existing) return existing;
  return getPrisma().messagingRegistration.create({
    data: { workspaceId },
  });
}

export async function updateRegistration(
  workspaceId: string,
  data: Prisma.MessagingRegistrationUpdateInput,
) {
  return getPrisma().messagingRegistration.update({
    where: { workspaceId },
    data,
  });
}

/** CAS update that only applies while this worker still holds the advance lock token. */
export async function updateRegistrationIfLocked(
  workspaceId: string,
  lockToken: string,
  data: Prisma.MessagingRegistrationUpdateInput,
) {
  const result = await getPrisma().messagingRegistration.updateMany({
    where: { workspaceId, lastError: lockToken },
    data: data as Prisma.MessagingRegistrationUpdateManyMutationInput,
  });
  if (result.count !== 1) {
    throw new Error("LOST_ADVANCE_LOCK");
  }
  return getRegistrationByWorkspace(workspaceId);
}

export async function appendRegistrationEvent(input: {
  workspaceId: string;
  registrationId: string;
  eventType: string;
  message?: string;
  payload?: Prisma.InputJsonValue;
}) {
  return getPrisma().messagingRegistrationEvent.create({
    data: {
      workspaceId: input.workspaceId,
      registrationId: input.registrationId,
      eventType: input.eventType,
      message: input.message,
      payload: input.payload,
    },
  });
}

export async function listRegistrationEvents(workspaceId: string, limit = 50) {
  return getPrisma().messagingRegistrationEvent.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export function setStepStatuses(
  patch: Partial<Record<keyof MessagingRegistration, MessagingStepStatus | string | boolean | Date | null | string[]>>,
) {
  return patch;
}
