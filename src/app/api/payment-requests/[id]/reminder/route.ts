import { NextResponse } from "next/server";
import { requireSession, resolveWorkspaceId, jsonError } from "@/lib/api-auth";
import { sendPaymentRequestReminder } from "@/lib/payment-requests/service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const workspaceId = await resolveWorkspaceId(auth.session);
    const { id } = await ctx.params;
    const row = await sendPaymentRequestReminder(workspaceId, id, auth.session.userId);
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
