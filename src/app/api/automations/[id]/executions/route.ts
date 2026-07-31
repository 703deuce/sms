import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;

    const executions = await getPrisma().automationExecution.findMany({
      where: { flowId: id, workspaceId: auth.workspaceId },
      orderBy: { startedAt: "desc" },
      take: 100,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        steps: { orderBy: { startedAt: "asc" } },
      },
    });

    return NextResponse.json({
      data: executions.map((ex: typeof executions[number]) => ({
        id: ex.id,
        status: ex.status,
        currentNodeId: ex.currentNodeId,
        startedAt: ex.startedAt.toISOString(),
        completedAt: ex.completedAt?.toISOString() ?? null,
        failedAt: ex.failedAt?.toISOString() ?? null,
        error: ex.error,
        flowVersion: ex.flowVersion,
        contact: ex.contact,
        steps: ex.steps.map((s: typeof ex.steps[number]) => ({
          nodeId: s.nodeId,
          status: s.status,
          branchTaken: s.branchTaken,
          error: s.error,
          startedAt: s.startedAt?.toISOString() ?? null,
          completedAt: s.completedAt?.toISOString() ?? null,
        })),
        testMode:
          ex.metadata &&
          typeof ex.metadata === "object" &&
          (ex.metadata as { testMode?: boolean }).testMode,
      })),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
