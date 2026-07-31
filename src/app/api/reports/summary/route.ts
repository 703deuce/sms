import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { loadDashboardMetrics } from "@/lib/workspace-data";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const prisma = getPrisma();
    const workspaceId = auth.workspaceId;

    const [
      metrics,
      campaigns,
      contactsByStatus,
      conversations,
      usage,
      auditLogs,
      messages,
    ] = await Promise.all([
      loadDashboardMetrics(workspaceId),
      prisma.campaign.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.contact.groupBy({
        by: ["status"],
        where: { workspaceId },
        _count: true,
      }),
      prisma.conversation.groupBy({
        by: ["status"],
        where: { workspaceId },
        _count: true,
      }),
      prisma.usageRecord.findMany({
        where: { workspaceId },
        orderBy: { periodStart: "desc" },
        take: 12,
      }),
      prisma.auditLog.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.campaignMessage.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    const automations = await prisma.automationFlow.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      data: {
        metrics,
        campaigns,
        contactsByStatus,
        conversations,
        usage,
        auditLogs,
        messages,
        automations,
        links: {
          clicks: campaigns.reduce((s: number, c: { clicks?: number }) => s + (c.clicks || 0), 0),
          optOuts: campaigns.reduce((s: number, c: { optOuts?: number }) => s + (c.optOuts || 0), 0),
        },
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
