import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { syncPowerDialerAttemptToIntegrations } from "@/lib/server/phone/power-dialer/crm-sync-bridge";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(_request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const prisma = getPrisma();
    const log = await prisma.powerDialerIntegrationSyncLog.findFirst({
      where: { id, workspaceId },
    });
    if (!log?.attemptId) throw new Error("Sync log cannot be retried");
    const attempt = await prisma.powerDialerAttempt.findFirst({
      where: { id: log.attemptId, workspaceId },
    });
    if (!attempt) throw new Error("Attempt not found");
    await prisma.powerDialerIntegrationSyncLog.update({
      where: { id: log.id },
      data: { status: "pending", errorMessage: null, finishedAt: null },
    });
    const result = await syncPowerDialerAttemptToIntegrations({
      workspaceId,
      attemptId: attempt.id,
      contactId: attempt.contactId,
      humanCallId: attempt.humanCallId,
      disposition: attempt.disposition || "Retry",
      notes: attempt.notes || undefined,
      callbackAt: attempt.callbackAt,
      triggerCrm: true,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
