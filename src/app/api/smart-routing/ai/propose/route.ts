import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { createAiRoutingProposal } from "@/lib/smart-routing/ai/service";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) return jsonError(new Error("prompt required"), 400);

    const result = await createAiRoutingProposal({
      workspaceId: auth.workspaceId,
      userId: auth.session.userId,
      flowId: body.flowId ? String(body.flowId) : undefined,
      prompt,
      mode: body.mode as "build" | "change" | "explain" | "analyze" | "improve" | undefined,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error, data: result.proposal ?? null }, { status: 503 });
    }

    return NextResponse.json({
      data: {
        proposal: result.proposal,
        message: result.message,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
