import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { parseAutomationDefinition } from "@/lib/automations/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; executionId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id, executionId } = await params;

    const execution = await getPrisma().automationExecution.findFirst({
      where: { id: executionId, flowId: id, workspaceId: auth.workspaceId },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        flow: { select: { name: true, definition: true, publishedDefinition: true } },
        steps: { orderBy: { startedAt: "asc" } },
      },
    });
    if (!execution) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const def = parseAutomationDefinition(
      execution.flow.publishedDefinition ?? execution.flow.definition,
    );

    const path = execution.steps.map((s: typeof execution.steps[number]) => {
      const node = def.nodes.find((n) => n.id === s.nodeId);
      return {
        nodeId: s.nodeId,
        label: node?.data.label || s.nodeId,
        blockType: node?.data.blockType,
        status: s.status,
        branchTaken: s.branchTaken,
        error: s.error,
        startedAt: s.startedAt?.toISOString() ?? null,
        completedAt: s.completedAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({
      data: {
        id: execution.id,
        status: execution.status,
        startedAt: execution.startedAt.toISOString(),
        completedAt: execution.completedAt?.toISOString() ?? null,
        error: execution.error,
        currentNodeId: execution.currentNodeId,
        contact: execution.contact,
        path,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
