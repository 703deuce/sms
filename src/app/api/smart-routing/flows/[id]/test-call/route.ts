import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { startTestCall } from "@/lib/smart-routing/test-service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    const body = (await request.json()) as { testNumber?: string };
    if (!body.testNumber?.trim()) {
      return NextResponse.json({ error: "testNumber required" }, { status: 400 });
    }
    const result = await startTestCall({
      workspaceId: auth.workspaceId,
      flowId: id,
      testNumber: body.testNumber.trim(),
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
