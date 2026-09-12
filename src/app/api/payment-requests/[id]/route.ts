import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { getPaymentRequestDetail } from "@/lib/payment-requests/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const workspaceId = await resolveWorkspaceId(auth.session);
    const { id } = await ctx.params;
    const detail = await getPaymentRequestDetail(workspaceId, id);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: detail });
  } catch (err) {
    return jsonError(err, 400);
  }
}
