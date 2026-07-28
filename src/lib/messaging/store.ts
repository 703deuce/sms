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
