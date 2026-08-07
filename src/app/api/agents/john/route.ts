import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { executeJohnAdminTool } from "@/lib/agents/missed-call-text-back/intelligence/owner-tools";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const prisma = getPrisma();

  const config = await loadMissedCallTextConfig(workspaceId);
  const voicePn = config.phoneNumberId
    ? await prisma.phoneNumber.findFirst({
        where: { id: config.phoneNumberId, workspaceId },
        select: { id: true, e164: true, friendlyName: true },
      })
    : null;
  const smsPn = config.smsPhoneNumberId
    ? await prisma.phoneNumber.findFirst({
        where: { id: config.smsPhoneNumberId, workspaceId },
        select: { id: true, e164: true, friendlyName: true },
      })
    : null;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const [missedToday, sentToday, recentEvents, setup] = await Promise.all([
    prisma.missedCallEvent.count({
      where: { workspaceId, detectedAt: { gte: start } },
    }),
    prisma.missedCallEvent.count({
      where: { workspaceId, smsSentAt: { gte: start } },
    }),
    prisma.missedCallEvent.findMany({
      where: { workspaceId },
      orderBy: { detectedAt: "desc" },
      take: 8,
    }),
    prisma.solutionSetup.findFirst({
      where: { workspaceId, solutionType: "missed-call-text-back" },
      select: { id: true, status: true, primaryFlowId: true, name: true },
    }),
  ]);

  const metrics = await executeJohnAdminTool({
    workspaceId,
    tool: "get_missed_call_text_metrics",
    args: {},
  });

  return NextResponse.json({
    data: {
      identity: {
        displayName: "John",
        role: "Missed Call Text Back Agent",
        status: config.enabled ? "active" : "paused",
        health: config.enabled && (smsPn || voicePn) ? "healthy" : "needs_attention",
      },
      phoneNumber: smsPn?.e164 || voicePn?.e164 || null,
      callRouting: voicePn?.e164 || null,
      smsFrom: smsPn?.e164 || null,
      workflow: setup?.name || "Standard MCTB Path",
      workflowId: setup?.primaryFlowId || null,
      config,
      metrics: "today" in metrics ? metrics.today : { missed: missedToday, sent: sentToday },
      recentCalls: recentEvents.map((e: (typeof recentEvents)[number]) => ({
        id: e.id,
        phone: e.callerE164,
        business: e.businessE164,
        status: e.status,
        smsSentAt: e.smsSentAt,
        detectedAt: e.detectedAt,
        suppressionReason: e.suppressionReason,
      })),
      setupId: setup?.id || null,
    },
  });
}
