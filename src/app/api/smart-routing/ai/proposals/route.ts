import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  getAiRoutingProposal,
  listAiRoutingHistory,
} from "@/lib/smart-routing/ai/service";
import { listActiveRecommendations } from "@/lib/smart-routing/ai/recommendations";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const proposalId = url.searchParams.get("id");

    if (proposalId) {
      const proposal = await getAiRoutingProposal(auth.workspaceId, proposalId);
      if (!proposal) return jsonError(new Error("Proposal not found"), 404);
      return NextResponse.json({ data: proposal });
    }

    const history = await listAiRoutingHistory(auth.workspaceId);
    const recommendations = await listActiveRecommendations(auth.workspaceId);
    return NextResponse.json({ data: { history, recommendations } });
  } catch (err) {
    return jsonError(err);
  }
}
