import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

/**
 * Employee business-callback access is only considered when the call is a direct
 * dial to the private routing DID — not a carrier-forwarded customer leg.
 *
 * A forwarded call may present an authorized employee ANI in edge cases; we
 * always treat forwarded legs as customer inbound routing.
 */
export function isDirectDialToRoutingDid(input: {
  forwardedFrom?: string | null;
}): boolean {
  return !input.forwardedFrom?.trim();
}

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
  forwardedFrom?: string | null;
}): Promise<{ start: boolean; caller?: Awaited<ReturnType<typeof findAuthorizedCallerForWorkspace>> }> {
  if (!isDirectDialToRoutingDid(input)) return { start: false };
  const caller = await findAuthorizedCallerForWorkspace({
    workspaceId: input.workspaceId,
    callerE164: input.callerE164,
  });
  if (!caller) return { start: false };
  return { start: true, caller };
}
