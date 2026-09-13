import { NextResponse } from "next/server";
import { handleNarrowVoiceToolRequest } from "@/lib/voice/tools/narrow-tool-route";
import { executeSendResource } from "@/lib/voice/tools/send-resource";
import { resolveSendResourceContext } from "@/lib/voice/tools/resolve-send-resource-input";

export async function POST(request: Request) {
  return handleNarrowVoiceToolRequest(request, "send_resource", async (input) => {
    return executeSendResource(
      resolveSendResourceContext({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        callId: input.callId,
        body: input.body,
        callerE164: input.inboundAni,
        conversationId: input.conversationId,
        callControlId: input.callControlId,
      }),
    );
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, tool: "send_resource" });
}
