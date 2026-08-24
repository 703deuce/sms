import "server-only";

import { getPrisma } from "@/lib/db";

const REMEMBERED_HOURS = 24;

export type EmployeeAuthMode = "strict" | "remembered" | "trusted";

export async function loadEmployeeAuthMode(workspaceId: string): Promise<EmployeeAuthMode> {
  const settings = await getPrisma().smartRoutingWorkspaceSettings.findUnique({
    where: { workspaceId },
    select: { employeeAuthMode: true },
  });
  const mode = settings?.employeeAuthMode?.trim().toLowerCase();
  if (mode === "strict" || mode === "trusted" || mode === "remembered") return mode;
  return "remembered";
}

export async function shouldSkipPinForAuthorizedCaller(input: {
  workspaceId: string;
  authorizedCallerId: string;
  callerPhoneE164: string;
}): Promise<boolean> {
  const mode = await loadEmployeeAuthMode(input.workspaceId);
  if (mode === "strict") return false;

  const prisma = getPrisma();
  const caller = await prisma.smartRoutingAuthorizedCaller.findFirst({
    where: {
      id: input.authorizedCallerId,
      workspaceId: input.workspaceId,
      active: true,
    },
    select: { phoneE164: true, lastAccessAt: true },
  });
  if (!caller) return false;

  const { normalizeE164 } = await import("@/lib/messaging/twilio-mappings");
  try {
    if (normalizeE164(caller.phoneE164) !== normalizeE164(input.callerPhoneE164)) {
      return false;
    }
  } catch {
    return false;
  }

  if (mode === "trusted") return true;

  if (!caller.lastAccessAt) return false;
  const ms = Date.now() - caller.lastAccessAt.getTime();
  return ms <= REMEMBERED_HOURS * 60 * 60 * 1000;
}

export async function touchAuthorizedCallerAccess(authorizedCallerId: string) {
  await getPrisma().smartRoutingAuthorizedCaller.update({
    where: { id: authorizedCallerId },
    data: { lastAccessAt: new Date() },
  });
}
