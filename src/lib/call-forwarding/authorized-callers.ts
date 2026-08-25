import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function listCallForwardingAuthorizedCallers(workspaceId: string) {
  return getPrisma().callForwardingAuthorizedCaller.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });
}

export async function findCallForwardingAuthorizedCaller(input: {
  workspaceId: string;
  callerE164: string;
}) {
  const phone = normalizeE164(input.callerE164);
  return getPrisma().callForwardingAuthorizedCaller.findFirst({
    where: { workspaceId: input.workspaceId, phoneE164: phone, active: true },
  });
}

export async function upsertCallForwardingAuthorizedCaller(input: {
  workspaceId: string;
  name: string;
  phoneE164: string;
  active?: boolean;
}) {
  const phone = normalizeE164(input.phoneE164);
  return getPrisma().callForwardingAuthorizedCaller.upsert({
    where: { workspaceId_phoneE164: { workspaceId: input.workspaceId, phoneE164: phone } },
    create: {
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      phoneE164: phone,
      active: input.active ?? true,
    },
    update: {
      name: input.name.trim(),
      active: input.active ?? true,
    },
  });
}

export async function deleteCallForwardingAuthorizedCaller(workspaceId: string, id: string) {
  return getPrisma().callForwardingAuthorizedCaller.deleteMany({
    where: { id, workspaceId },
  });
}
