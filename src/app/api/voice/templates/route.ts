import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AGENT_TEMPLATE_CATALOG, DEFAULT_ACTIVE_TEMPLATE, runtimeTemplateStatus } from "@/lib/voice/templates/catalog";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    data: AGENT_TEMPLATE_CATALOG.map((t) => ({
      ...t,
      runtimeStatus: runtimeTemplateStatus(t),
    })),
    runtime: "livekit_python",
    worker: process.env.LIVEKIT_AGENT_NAME?.trim() || "transovo-voice-runtime",
    defaultActiveTemplate: DEFAULT_ACTIVE_TEMPLATE,
    composedReceptionistBlocked: process.env.ALLOW_COMPOSED_RECEPTIONIST !== "1",
  });
}
