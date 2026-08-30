import { NextResponse } from "next/server";
import { handleNarrowVoiceToolRequest } from "@/lib/voice/tools/narrow-tool-route";
import { executeSearchBusinessDetails } from "@/lib/voice/tools/search-business-details";

export async function POST(request: Request) {
  return handleNarrowVoiceToolRequest(request, "search_business_details", async (input) => {
    const query = String(input.body.query || input.body.question || input.body.topic || "");
    return executeSearchBusinessDetails({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: input.callId,
      query,
    });
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, tool: "search_business_details" });
}
