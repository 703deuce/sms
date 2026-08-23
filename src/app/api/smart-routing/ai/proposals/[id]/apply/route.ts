import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { applyAiRoutingProposal } from "@/lib/smart-routing/ai/service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await applyAiRoutingProposal({
      workspaceId: auth.workspaceId,
      proposalId: id,
      userId: auth.session.userId,
      publish: Boolean(body.publish),
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, rebased: result.rebased ?? false, flowId: result.flowId },
        { status: result.rebased ? 409 : 400 },
      );
    }
    return NextResponse.json({ data: { ok: true, flowId: result.flowId } });
  } catch (err) {
    return jsonError(err);
  }
}
