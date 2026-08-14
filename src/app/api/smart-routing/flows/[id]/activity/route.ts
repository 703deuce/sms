import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { listFlowActivity } from "@/lib/smart-routing/webhook-handler";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    const sessions = await listFlowActivity(auth.workspaceId, id);
    return NextResponse.json({ data: sessions });
  } catch (err) {
    return jsonError(err, 500);
  }
}
