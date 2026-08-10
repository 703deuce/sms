import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { initiateOutboundCall } from "@/lib/voice/call-service";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  isOutboundLeadQualificationAgent,
  triggerOutboundQualificationCall,
} from "@/lib/voice/outbound/trigger-qualification-call";

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
      contactId?: string;
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

    const agentConfig = parseVoiceAgentConfig(agent.draftConfig);
    if (isOutboundLeadQualificationAgent(agentConfig)) {
      const result = await triggerOutboundQualificationCall({
        workspaceId: auth.workspaceId,
        agentId: id,
        destinationPhone: testNumber,
        contactId: body.contactId,
        triggerSource: "voice_testing_lab",
        requireTestModeEnv: false,
      });

      await getPrisma().voiceTestRun.update({
        where: { id: testRun.id },
        data: {
          callId: result.callId,
          status: result.status === "failed" ? "failed" : "completed",
          completedAt: new Date(),
        },
      });

      if (result.status === "failed") {
        return NextResponse.json(
          { error: result.error || "Outbound qualification call failed to start", data: result },
          { status: 502 },
        );
      }

      return NextResponse.json({
        data: {
          testRunId: testRun.id,
          callId: result.callId,
          mode: "livekit_outbound_qualification",
          roomName: result.roomName,
        },
      });
    }

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
