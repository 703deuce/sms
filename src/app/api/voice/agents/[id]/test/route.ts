import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { initiateOutboundCall } from "@/lib/voice/call-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      testNumber?: string;
      direction?: string;
      agentVersionId?: string;
      dynamicVariables?: Record<string, unknown>;
    };

    const agent = await getPrisma().voiceAgent.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const testNumber = (body.testNumber || "").trim();
    if (!testNumber) {
      return NextResponse.json({ error: "testNumber is required" }, { status: 400 });
    }

    const testRun = await getPrisma().voiceTestRun.create({
      data: {
        workspaceId: auth.workspaceId,
        agentId: id,
        agentVersionId: body.agentVersionId || agent.publishedVersionId,
        testNumber,
        direction: body.direction || "outbound",
        status: "running",
      },
    });

    const result = await initiateOutboundCall({
      workspaceId: auth.workspaceId,
      agentId: id,
      toPhone: testNumber,
      isTest: true,
      dynamicVariables: body.dynamicVariables,
    });

    if (result.dial.mode === "mock") {
      const { completeMockCall } = await import("@/lib/voice/call-service");
      await completeMockCall(result.call.id);
    }

    await getPrisma().voiceTestRun.update({
      where: { id: testRun.id },
      data: { callId: result.call.id, status: "completed", completedAt: new Date() },
    });

    return NextResponse.json({
      data: { testRunId: testRun.id, callId: result.call.id, mode: result.dial.mode },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
