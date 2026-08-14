import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { validateFlow } from "@/lib/smart-routing/flow-service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    const result = await validateFlow(auth.workspaceId, id);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
