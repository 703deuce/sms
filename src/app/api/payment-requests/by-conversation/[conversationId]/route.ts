import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { listPaymentRequestsForConversation } from "@/lib/payment-requests/service";

type Ctx = { params: Promise<{ conversationId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const workspaceId = await resolveWorkspaceId(auth.session);
    const { conversationId } = await ctx.params;
    const rows = await listPaymentRequestsForConversation(workspaceId, conversationId);
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 400);
  }
}
