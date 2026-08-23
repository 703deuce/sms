import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getAiRoutingProposal } from "@/lib/smart-routing/ai/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const proposal = await getAiRoutingProposal(auth.workspaceId, id);
    if (!proposal) return jsonError(new Error("Proposal not found"), 404);
    return NextResponse.json({ data: proposal });
  } catch (err) {
    return jsonError(err);
  }
}
