import { resolveInternalUserId } from "@/lib/server/internal-user";
import { resolveActorContext } from "./impersonation";

export async function resolvePowerDialerUserIds(workspaceId: string) {
  const actorUserId = await resolveInternalUserId();
  const ctx = await resolveActorContext(workspaceId, actorUserId);
  return ctx;
}
