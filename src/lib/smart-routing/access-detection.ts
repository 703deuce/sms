import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

/**
 * Business Callback ingress: caller must match an authorized employee record.
 * Called number (Callback Number) is the workspace discriminator — not forwarding metadata.
 */
export async function findAuthorizedCallerForWorkspace(input: {
  workspaceId: string;
  callerE164: string;
}) {
  const prisma = getPrisma();
  const phone = normalizeE164(input.callerE164);
  const row = await prisma.smartRoutingAuthorizedCaller.findFirst({
    where: {
      workspaceId: input.workspaceId,
      phoneE164: phone,
      active: true,
      outboundEnabled: true,
    },
  });
  if (!row) return null;
  if (row.lockedUntil && row.lockedUntil > new Date()) return null;
  return row;
}

export async function shouldStartEmployeeAccess(input: {
  workspaceId: string;
  callerE164: string;
}): Promise<{
  start: boolean;
  caller?: Awaited<ReturnType<typeof findAuthorizedCallerForWorkspace>>;
}> {
  const caller = await findAuthorizedCallerForWorkspace({
    workspaceId: input.workspaceId,
    callerE164: input.callerE164,
  });
  if (!caller) return { start: false };
  return { start: true, caller };
}
