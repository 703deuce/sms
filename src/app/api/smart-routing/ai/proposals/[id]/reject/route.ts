import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { rejectAiRoutingProposal } from "@/lib/smart-routing/ai/service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    await rejectAiRoutingProposal(auth.workspaceId, id, auth.session.userId);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return jsonError(err);
  }
}
