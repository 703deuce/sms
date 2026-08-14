import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { duplicateFlow } from "@/lib/smart-routing/flow-service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    const flow = await duplicateFlow(auth.workspaceId, id, auth.session.userId);
    return NextResponse.json({ data: flow }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
