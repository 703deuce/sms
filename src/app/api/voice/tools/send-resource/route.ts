import { NextResponse } from "next/server";
import { handleNarrowVoiceToolRequest } from "@/lib/voice/tools/narrow-tool-route";
import { executeSendResource } from "@/lib/voice/tools/send-resource";

export async function POST(request: Request) {
  return handleNarrowVoiceToolRequest(request, "send_resource", async (input) => {
    const resourceType = String(
      input.body.resource_type || input.body.resourceType || "",
    );
    return executeSendResource({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: input.callId,
      resourceType,
      forceResend: Boolean(input.body.force_resend || input.body.resend),
    });
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, tool: "send_resource" });
}
