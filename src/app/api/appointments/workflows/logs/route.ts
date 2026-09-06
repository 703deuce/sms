import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
    const prisma = getPrisma();
    const rows = await prisma.appointmentWorkflowStepExecution.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        execution: {
          select: {
            appointmentId: true,
            status: true,
            workflow: { select: { name: true } },
          },
        },
      },
    });
    return NextResponse.json({
      data: rows.map((r) => ({
        id: r.id,
        workflowName: r.execution?.workflow?.name || "Workflow",
        appointmentId: r.execution?.appointmentId,
        stepId: r.stepId,
        status: r.state,
        channel: r.channel,
        scheduledFor: r.scheduledFor?.toISOString(),
        executedAt: r.executedAt?.toISOString(),
        error: r.failureReason,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
