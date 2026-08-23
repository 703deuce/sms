import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { publishFlow } from "@/lib/smart-routing/flow-service";
import { hasWorkspaceProductFeature } from "@/lib/products/feature-entitlements";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const entitled = await hasWorkspaceProductFeature(auth.workspaceId, "smart_routing");
    if (!entitled) {
      return jsonError(new Error("Smart Routing subscription required to publish flows"), 403);
    }
    const { id } = await ctx.params;
    const version = await publishFlow(auth.workspaceId, id, auth.session.userId);
    return NextResponse.json({ data: version });
  } catch (err) {
    return jsonError(err, 400);
  }
}
