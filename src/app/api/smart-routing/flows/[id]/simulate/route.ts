import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { simulateFlowPath } from "@/lib/smart-routing/test-service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    const body = (await request.json()) as { digits?: string[] };
    const result = await simulateFlowPath(
      auth.workspaceId,
      id,
      body.digits ?? [],
    );
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
